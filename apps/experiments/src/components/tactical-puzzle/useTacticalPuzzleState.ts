import { useCallback, useEffect, useMemo, useState } from 'react';
import { getHexPosition } from '@/components/map-viewer/MapViewer';
import { WesnothBattleManager } from '@/lib/combat/battle-manager';
import { WesnothCombatCore } from '@/lib/combat/combat-core';
import type { CombatContext } from '@/lib/combat/types';
import {
  type ActiveMovement,
  calculateReachableHexes,
  findPath,
  getAdjacentHexes,
  getTerrainKeysForCell,
  getUnitMovementCost,
  isVillage,
  type TacticalUnitState,
} from '@/lib/tactical-puzzle/pathfinder';
import type { PuzzleStage } from '@/lib/tactical-puzzle/stages';
import { getUnitById } from '@/lib/wesnoth-data';

export interface ActionLog {
  id: string;
  text: string;
}

export interface HoveredHexState {
  x: number;
  y: number;
  code: string;
  terrainName: string;
}

export interface CombatEffectState {
  attackerId: string;
  defenderId: string;
  attackerWeaponName: string | null;
  attackerX: number;
  attackerY: number;
  defenderX: number;
  defenderY: number;
  stage: 'none' | 'strike' | 'recoil';
  message?: string;
}

let logCounter = 0;
export const createLog = (text: string): ActionLog => ({
  id: `${++logCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  text,
});

interface UseTacticalPuzzleStateProps {
  stage: PuzzleStage;
  onVictory: (xpGained: number) => void;
  onDefeat: (reason: string) => void;
}

export function useTacticalPuzzleState({
  stage,
  onVictory,
  onDefeat,
}: UseTacticalPuzzleStateProps) {
  const [units, setUnits] = useState<TacticalUnitState[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<number>(1);
  const [turn, setTurn] = useState<number>(1);
  const [hoveredHex, setHoveredHex] = useState<HoveredHexState | null>(null);

  // Undo history stack
  const [history, setHistory] = useState<TacticalUnitState[][]>([]);

  // Logs of actions
  const [actionLogs, setActionLogs] = useState<ActionLog[]>([
    createLog('Game started. Your turn!'),
  ]);

  // Movement animation state
  const [activeMovement, setActiveMovement] = useState<ActiveMovement | null>(
    null,
  );

  // Combat Prediction State
  const [pendingCombat, setPendingCombat] = useState<{
    attackerId: string;
    defenderId: string;
    attackerWeaponIndex: number;
    defenderWeaponIndex: number;
  } | null>(null);

  // Combat Visual Effect State
  const [combatEffect, setCombatEffect] = useState<CombatEffectState | null>(
    null,
  );

  const grid = stage.grid;
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  // Reset stage helper
  const resetState = useCallback(() => {
    const initialized: TacticalUnitState[] = stage.startingUnits.map(
      (placement, index) => {
        const unitType = getUnitById(placement.unitTypeId);
        if (!unitType)
          throw new Error(`Unit type ${placement.unitTypeId} not found`);

        // Initialize combat base state
        const baseState = WesnothBattleManager.initializeUnitState(
          unitType,
          [],
          'male',
        );
        return {
          ...baseState,
          id: `unit_${index}_${placement.unitTypeId.replace(/\s+/g, '_')}`,
          side: placement.side,
          x: placement.x,
          y: placement.y,
          moves: unitType.movement,
          maxMoves: unitType.movement,
          isLeader: !!placement.isLeader,
          hasAttacked: false,
        };
      },
    );
    setUnits(initialized);
    setSelectedUnitId(null);
    setActiveSide(1);
    setTurn(1);
    setHistory([]);
    setActionLogs([createLog(`Stage "${stage.name}" initialized. Turn 1.`)]);
    setPendingCombat(null);
    setCombatEffect(null);
  }, [stage]);

  // Initial unit loading & stage change
  useEffect(() => {
    resetState();
  }, [resetState]);

  // Reachable hexes calculation for active unit
  const reachableHexes = useMemo(() => {
    if (!selectedUnitId || activeMovement || activeSide !== 1) return {};
    const unit = units.find((u) => u.id === selectedUnitId);
    if (!unit || unit.side !== 1 || unit.hasAttacked) return {};
    return calculateReachableHexes(unit, units, grid);
  }, [selectedUnitId, units, grid, activeMovement, activeSide]);

  // Selected Unit Info Helper
  const selectedUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || null;
  }, [selectedUnitId, units]);

  // Highlight targets (enemies adjacent to the selected unit)
  const adjacentEnemies = useMemo(() => {
    if (
      !selectedUnit ||
      selectedUnit.side !== 1 ||
      selectedUnit.hasAttacked ||
      activeSide !== 1
    )
      return [];
    const adj = getAdjacentHexes(selectedUnit.x, selectedUnit.y, cols, rows);
    return units.filter(
      (u) => u.side === 2 && adj.some((a) => a.x === u.x && a.y === u.y),
    );
  }, [selectedUnit, units, cols, rows, activeSide]);

  // Save state to undo history
  const pushToHistory = useCallback((currentUnits: TacticalUnitState[]) => {
    setHistory((prev) => [...prev, currentUnits.map((u) => ({ ...u }))]);
  }, []);

  // Handle undo movement
  const handleUndo = useCallback(() => {
    if (history.length === 0 || activeMovement || activeSide !== 1) return;
    const prev = history[history.length - 1];
    setUnits(prev);
    setHistory((prevStack) => prevStack.slice(0, -1));
    setSelectedUnitId(null);
    setActionLogs((prevLogs) => [createLog('Movement undone.'), ...prevLogs]);
  }, [history, activeMovement, activeSide]);

  // Movement animation tick loop
  useEffect(() => {
    if (!activeMovement) return;

    let active = true;
    let lastTime = performance.now();

    const animate = (time: number) => {
      if (!active) return;
      const delta = time - lastTime;
      lastTime = time;

      setActiveMovement((prev) => {
        if (!prev) return null;

        const nextProgress = prev.segmentProgress + delta * 0.005; // speed multiplier
        if (nextProgress >= 1.0) {
          // Move to next tile on path
          const nextIndex = prev.currentStepIndex + 1;
          if (nextIndex >= prev.path.length - 1) {
            // Reached destination!
            const dest = prev.path[prev.path.length - 1];
            setUnits((prevUnits) =>
              prevUnits.map((u) =>
                u.id === prev.unitId
                  ? {
                      ...u,
                      x: dest.x,
                      y: dest.y,
                      moves:
                        u.moves -
                        getUnitMovementCost(
                          getUnitById(u.unitTypeId),
                          getTerrainKeysForCell(grid[dest.y][dest.x]),
                        ),
                      visualX: undefined,
                      visualY: undefined,
                      isMoving: false,
                    }
                  : u,
              ),
            );

            // Handle capturing village
            const cell = grid[dest.y][dest.x];
            if (isVillage(cell)) {
              // Village captured feedback (no gold in this pure battle version)
            }

            return null;
          }

          return {
            ...prev,
            currentStepIndex: nextIndex,
            segmentProgress: 0,
          };
        }

        // Lerp position
        const currentTile = prev.path[prev.currentStepIndex];
        const nextTile = prev.path[prev.currentStepIndex + 1];
        const currentPos = getHexPosition(currentTile.x, currentTile.y);
        const nextPos = getHexPosition(nextTile.x, nextTile.y);

        const visualX =
          currentPos.x + (nextPos.x - currentPos.x) * nextProgress;
        const visualY =
          currentPos.y + (nextPos.y - currentPos.y) * nextProgress;

        setUnits((prevUnits) =>
          prevUnits.map((u) =>
            u.id === prev.unitId
              ? { ...u, visualX, visualY, isMoving: true }
              : u,
          ),
        );

        return {
          ...prev,
          segmentProgress: nextProgress,
        };
      });

      requestAnimationFrame(animate);
    };

    const animId = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(animId);
    };
  }, [activeMovement, grid]);

  // Execute Unit Move
  const moveUnit = useCallback(
    (unitId: string, targetX: number, targetY: number) => {
      if (activeMovement || activeSide !== 1) return;
      const unit = units.find((u) => u.id === unitId);
      if (!unit) return;

      const path = findPath(
        unit.x,
        unit.y,
        targetX,
        targetY,
        unit,
        units,
        grid,
      );
      if (!path || path.length < 2) return;

      // Push current state to undo history
      pushToHistory(units);

      // Calculate move cost
      let totalCost = 0;
      const unitType = getUnitById(unit.unitTypeId);
      for (let i = 1; i < path.length; i++) {
        const terrainKeys = getTerrainKeysForCell(grid[path[i].y][path[i].x]);
        totalCost += getUnitMovementCost(unitType, terrainKeys);
      }

      setActionLogs((prev) => [
        createLog(
          `${unit.name} (${unitType?.name}) moved to (${targetX + 1}, ${targetY + 1}) spending ${totalCost} movement.`,
        ),
        ...prev,
      ]);

      setActiveMovement({
        unitId,
        path,
        currentStepIndex: 0,
        segmentProgress: 0,
      });
    },
    [units, activeMovement, activeSide, grid, pushToHistory],
  );

  // Combat Execution
  const executeCombat = useCallback(
    (attId: string, defId: string, attWepIdx: number, defWepIdx: number) => {
      const attacker = units.find((u) => u.id === attId);
      const defender = units.find((u) => u.id === defId);
      if (!attacker || !defender) return;

      const attType = getUnitById(attacker.unitTypeId);
      const defType = getUnitById(defender.unitTypeId);
      if (!attType || !defType) return;

      // Clear history stack
      setHistory([]);
      setPendingCombat(null);

      const context: CombatContext = {
        terrainId: getTerrainKeysForCell(grid[defender.y][defender.x])[0],
        timeOfDayId: 'morning',
        lawfulBonus: 25,
      };

      const result = WesnothBattleManager.runSimulation(attType, defType, {
        attackerTraits: attacker.traits,
        defenderTraits: defender.traits,
        attackerWeaponIndex: attWepIdx,
        defenderWeaponIndex: defWepIdx,
        terrainId: context.terrainId,
        timeOfDayId: context.timeOfDayId,
        attackerHpOverride: attacker.hp,
        defenderHpOverride: defender.hp,
        attackerSlowed: attacker.statuses.slowed,
        defenderSlowed: defender.statuses.slowed,
        attackerPoisoned: attacker.statuses.poisoned,
        defenderPoisoned: defender.statuses.poisoned,
      });

      const attPos = getHexPosition(attacker.x, attacker.y);
      const defPos = getHexPosition(defender.x, defender.y);
      const attWep = attType.attacks[attWepIdx] || null;

      setCombatEffect({
        attackerId: attId,
        defenderId: defId,
        attackerWeaponName: attWep ? attWep.name : null,
        attackerX: attPos.x,
        attackerY: attPos.y,
        defenderX: defPos.x,
        defenderY: defPos.y,
        stage: 'strike',
      });

      setTimeout(() => {
        setCombatEffect((prev) => (prev ? { ...prev, stage: 'recoil' } : null));

        setTimeout(() => {
          setCombatEffect(null);

          setUnits((prevUnits) => {
            return prevUnits
              .map((u) => {
                if (u.id === attId) {
                  return {
                    ...u,
                    hp: result.attacker.hp,
                    statuses: { ...result.attacker.statuses },
                    xp: Math.min(u.maxXp, u.xp + result.attackerXpGained),
                    hasAttacked: true,
                  };
                }
                if (u.id === defId) {
                  return {
                    ...u,
                    hp: result.defender.hp,
                    statuses: { ...result.defender.statuses },
                    xp: Math.min(u.maxXp, u.xp + result.defenderXpGained),
                  };
                }
                return u;
              })
              .filter((u) => u.hp > 0);
          });

          const newLogs: ActionLog[] = [];
          for (const log of result.logs) {
            newLogs.push(createLog(`Combat: ${log.logMessage}`));
          }
          if (result.winner === 'attacker') {
            newLogs.push(
              createLog(`☠ ${defender.name} (${defType.name}) was defeated!`),
            );
          } else if (result.winner === 'defender') {
            newLogs.push(
              createLog(`☠ ${attacker.name} (${attType.name}) was defeated!`),
            );
          }
          setActionLogs((prev) => [...newLogs.reverse(), ...prev]);
          setSelectedUnitId(null);
        }, 250);
      }, 250);
    },
    [units, grid],
  );

  // End Turn function
  const endTurn = useCallback(() => {
    if (activeSide !== 1 || activeMovement) return;

    setActiveSide(2); // CPU Side
    setSelectedUnitId(null);
    setHistory([]);

    const nextUnits = units.map((u) => {
      if (u.side === 2) {
        const cell = grid[u.y][u.x];
        if (isVillage(cell)) {
          if (u.statuses.poisoned) {
            return {
              ...u,
              moves: u.maxMoves,
              hasAttacked: false,
              statuses: {
                ...u.statuses,
                poisoned: false,
              },
            };
          }
          const healAmount = 8;
          const newHp = Math.min(u.maxHp, u.hp + healAmount);
          return {
            ...u,
            moves: u.maxMoves,
            hasAttacked: false,
            hp: newHp,
          };
        }
        return {
          ...u,
          moves: u.maxMoves,
          hasAttacked: false,
        };
      }
      return u;
    });

    const healLogs: ActionLog[] = [];
    units.forEach((u) => {
      if (u.side === 2) {
        const cell = grid[u.y][u.x];
        if (isVillage(cell)) {
          if (u.statuses.poisoned) {
            healLogs.push(
              createLog(`✨ CPU ${u.name} was cured of poison at the Village.`),
            );
          } else if (u.hp < u.maxHp) {
            const healed = Math.min(u.maxHp, u.hp + 8) - u.hp;
            healLogs.push(
              createLog(
                `💚 CPU ${u.name} healed +${healed} HP at the Village.`,
              ),
            );
          }
        }
      }
    });

    setUnits(nextUnits);
    setActionLogs((prev) => [
      createLog('CPU Turn starts...'),
      ...healLogs,
      ...prev,
    ]);
  }, [activeSide, activeMovement, grid, units]);

  // CPU AI Behavior
  useEffect(() => {
    if (activeSide !== 2 || activeMovement || combatEffect) return;

    const cpuUnits = units.filter((u) => u.side === 2 && !u.hasAttacked);
    if (cpuUnits.length === 0) {
      // Return turn to player
      setActiveSide(1);
      setTurn((t) => t + 1);

      const nextUnits = units.map((u) => {
        if (u.side === 1) {
          const cell = grid[u.y][u.x];
          if (isVillage(cell)) {
            if (u.statuses.poisoned) {
              return {
                ...u,
                moves: u.maxMoves,
                hasAttacked: false,
                statuses: {
                  ...u.statuses,
                  poisoned: false,
                },
              };
            }
            const healAmount = 8;
            const newHp = Math.min(u.maxHp, u.hp + healAmount);
            return {
              ...u,
              moves: u.maxMoves,
              hasAttacked: false,
              hp: newHp,
            };
          }
          return {
            ...u,
            moves: u.maxMoves,
            hasAttacked: false,
          };
        }
        return u;
      });

      const healLogs: ActionLog[] = [];
      units.forEach((u) => {
        if (u.side === 1) {
          const cell = grid[u.y][u.x];
          if (isVillage(cell)) {
            if (u.statuses.poisoned) {
              healLogs.push(
                createLog(`✨ ${u.name} was cured of poison at the Village.`),
              );
            } else if (u.hp < u.maxHp) {
              const healed = Math.min(u.maxHp, u.hp + 8) - u.hp;
              healLogs.push(
                createLog(`💚 ${u.name} healed +${healed} HP at the Village.`),
              );
            }
          }
        }
      });

      setUnits(nextUnits);
      setActionLogs((prev) => [
        createLog(`Turn ${turn + 1}: Player Turn`),
        ...healLogs,
        ...prev,
      ]);
      return;
    }

    const activeCpu = cpuUnits[0];
    const cpuType = getUnitById(activeCpu.unitTypeId);
    if (!cpuType) return;

    const playerUnits = units.filter((u) => u.side === 1);
    if (playerUnits.length === 0) return; // Player defeated

    let closestPlayer: TacticalUnitState | null = null;
    let shortestDist = Infinity;
    let bestPath: { x: number; y: number }[] | null = null;

    for (const p of playerUnits) {
      const path = findPath(
        activeCpu.x,
        activeCpu.y,
        p.x,
        p.y,
        activeCpu,
        units,
        grid,
        true, // ignoreMovesLimit = true
      );
      if (path && path.length < shortestDist) {
        shortestDist = path.length;
        closestPlayer = p;
        bestPath = path;
      }
    }

    const timer = setTimeout(() => {
      if (!closestPlayer || !bestPath) {
        setUnits((prev) =>
          prev.map((u) =>
            u.id === activeCpu.id ? { ...u, hasAttacked: true } : u,
          ),
        );
        return;
      }

      const targetPlayer = closestPlayer;
      const adj = getAdjacentHexes(activeCpu.x, activeCpu.y, cols, rows);
      const isPlayerAdjacent = adj.some(
        (a) => a.x === targetPlayer.x && a.y === targetPlayer.y,
      );

      if (isPlayerAdjacent) {
        const attWepIdx = 0;
        const defWepIdx =
          targetPlayer.activeWeaponIndex !== -1
            ? targetPlayer.activeWeaponIndex
            : 0;
        setActionLogs((prev) => [
          createLog(`CPU ${activeCpu.name} attacks ${targetPlayer.name}!`),
          ...prev,
        ]);
        executeCombat(activeCpu.id, targetPlayer.id, attWepIdx, defWepIdx);
      } else {
        let targetIndex = 0;
        let accumulatedCost = 0;
        const path = bestPath;

        for (let i = 1; i < path.length - 1; i++) {
          const tile = path[i];
          const cost = getUnitMovementCost(
            cpuType,
            getTerrainKeysForCell(grid[tile.y][tile.x]),
          );
          if (accumulatedCost + cost <= activeCpu.moves) {
            accumulatedCost += cost;
            targetIndex = i;
          } else {
            break;
          }
        }

        while (targetIndex > 0) {
          const dest = path[targetIndex];
          const isOccupied = units.some(
            (u) => u.x === dest.x && u.y === dest.y && u.id !== activeCpu.id,
          );
          if (!isOccupied) {
            break;
          }
          targetIndex--;
        }

        if (targetIndex > 0) {
          const dest = path[targetIndex];
          const pathSlice = path.slice(0, targetIndex + 1);

          setActionLogs((prev) => [
            createLog(
              `CPU ${activeCpu.name} moves towards ${targetPlayer.name}.`,
            ),
            ...prev,
          ]);

          setActiveMovement({
            unitId: activeCpu.id,
            path: pathSlice,
            currentStepIndex: 0,
            segmentProgress: 0,
          });

          setTimeout(() => {
            setUnits((prevUnits) => {
              const adjToDest = getAdjacentHexes(dest.x, dest.y, cols, rows);
              const playerAdjacent = prevUnits.some(
                (u) =>
                  u.side === 1 &&
                  adjToDest.some((a) => a.x === u.x && a.y === u.y),
              );

              return prevUnits.map((u) => {
                if (u.id === activeCpu.id) {
                  return {
                    ...u,
                    moves: 0,
                    hasAttacked: !playerAdjacent,
                  };
                }
                return u;
              });
            });
          }, pathSlice.length * 300);
        } else {
          setUnits((prev) =>
            prev.map((u) =>
              u.id === activeCpu.id ? { ...u, hasAttacked: true } : u,
            ),
          );
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [
    activeSide,
    units,
    activeMovement,
    combatEffect,
    grid,
    cols,
    rows,
    turn,
    executeCombat,
  ]);

  // Check Game Over Conditions
  useEffect(() => {
    if (units.length === 0) return;

    const cpuRemaining = units.some((u) => u.side === 2);
    if (!cpuRemaining) {
      const totalXp = units
        .filter((u) => u.side === 1)
        .reduce((acc, u) => acc + u.xp, 0);
      onVictory(totalXp);
      return;
    }

    const playerRemaining = units.some((u) => u.side === 1);
    if (!playerRemaining) {
      onDefeat('All your units were defeated.');
      return;
    }

    if (turn > stage.turnLimit) {
      onDefeat('You exceeded the turn limit.');
    }
  }, [units, turn, stage.turnLimit, onVictory, onDefeat]);

  // Click handler on hex cell
  const handleHexClick = useCallback(
    (cIdx: number, rIdx: number) => {
      if (activeSide !== 1 || activeMovement || combatEffect) return;

      const occupant = units.find((u) => u.x === cIdx && u.y === rIdx);

      // 1. Select player unit (including exhausted)
      if (occupant && occupant.side === 1) {
        setSelectedUnitId(occupant.id);
        setPendingCombat(null);
        return;
      }

      // 2. Move selected unit to cell
      if (selectedUnitId && reachableHexes[`${cIdx}_${rIdx}`] !== undefined) {
        moveUnit(selectedUnitId, cIdx, rIdx);
        return;
      }

      // 3. Initiate attack if clicking adjacent enemy with an active player unit selected
      if (
        selectedUnit &&
        selectedUnit.side === 1 &&
        occupant &&
        occupant.side === 2
      ) {
        const isAdjacent = getAdjacentHexes(
          selectedUnit.x,
          selectedUnit.y,
          cols,
          rows,
        ).some((a) => a.x === cIdx && a.y === rIdx);

        if (isAdjacent && !selectedUnit.hasAttacked) {
          // Setup pending combat
          const attType = getUnitById(selectedUnit.unitTypeId);
          const defType = getUnitById(occupant.unitTypeId);
          if (attType && defType) {
            const context: CombatContext = {
              terrainId: getTerrainKeysForCell(grid[occupant.y][occupant.x])[0],
              timeOfDayId: 'morning',
              lawfulBonus: 25,
            };
            const resolved = WesnothBattleManager.autoSelectWeapons(
              selectedUnit,
              occupant,
              selectedUnit.traits.includes('fearless')
                ? attType.attacks
                : WesnothBattleManager.getModifiedAttacks(
                    attType,
                    selectedUnit,
                  ),
              occupant.traits.includes('fearless')
                ? defType.attacks
                : WesnothBattleManager.getModifiedAttacks(defType, occupant),
              context.terrainId,
              context,
            );

            setPendingCombat({
              attackerId: selectedUnit.id,
              defenderId: occupant.id,
              attackerWeaponIndex: resolved.attackerWeaponIndex,
              defenderWeaponIndex: resolved.defenderWeaponIndex,
            });
          }
          return;
        }
      }

      // 4. Select enemy unit for profile viewing
      if (occupant && occupant.side === 2) {
        setSelectedUnitId(occupant.id);
        setPendingCombat(null);
        return;
      }

      // 5. Clicked empty non-reachable tile, clear selection
      setSelectedUnitId(null);
      setPendingCombat(null);
    },
    [
      activeSide,
      activeMovement,
      combatEffect,
      units,
      selectedUnitId,
      reachableHexes,
      moveUnit,
      selectedUnit,
      cols,
      rows,
      grid,
    ],
  );

  // Combat Prediction calculations for preview card
  const combatForecast = useMemo(() => {
    if (!pendingCombat) return null;
    const attacker = units.find((u) => u.id === pendingCombat.attackerId);
    const defender = units.find((u) => u.id === pendingCombat.defenderId);
    if (!attacker || !defender) return null;

    const attType = getUnitById(attacker.unitTypeId);
    const defType = getUnitById(defender.unitTypeId);
    if (!attType || !defType) return null;

    const context: CombatContext = {
      terrainId: getTerrainKeysForCell(grid[defender.y][defender.x])[0],
      timeOfDayId: 'morning',
      lawfulBonus: 25,
    };

    const attAttacks = WesnothBattleManager.getModifiedAttacks(
      attType,
      attacker,
    );
    const defAttacks = WesnothBattleManager.getModifiedAttacks(
      defType,
      defender,
    );

    const attWep = attAttacks[pendingCombat.attackerWeaponIndex];
    const defWep =
      pendingCombat.defenderWeaponIndex !== -1
        ? defAttacks[pendingCombat.defenderWeaponIndex]
        : null;

    const defDefense = WesnothBattleManager.resolveTerrainValues(
      defType,
      context.terrainId,
    ).defenseChanceToHit;

    const attDefense = WesnothBattleManager.resolveTerrainValues(
      attType,
      getTerrainKeysForCell(grid[attacker.y][attacker.x])[0],
    ).defenseChanceToHit;

    // Attacker calculations
    const attCthRes = WesnothCombatCore.calculateCTH(
      attacker,
      defender,
      attWep,
      defDefense,
    );
    const attDmgRes = WesnothCombatCore.calculateDamage(
      attacker,
      defender,
      attWep,
      defWep,
      context,
      true,
    );
    const attStrikes = WesnothCombatCore.calculateSwarmBlows(
      attWep,
      attacker.hp,
      attacker.maxHp,
    );
    const attEV = (attCthRes.cth / 100) * attDmgRes.damage * attStrikes;

    // Defender calculations
    let defCth = 0;
    let defDmg = 0;
    let defStrikes = 0;
    let defEV = 0;

    if (defWep) {
      const defCthRes = WesnothCombatCore.calculateCTH(
        defender,
        attacker,
        defWep,
        attDefense,
      );
      const defDmgRes = WesnothCombatCore.calculateDamage(
        defender,
        attacker,
        defWep,
        attWep,
        context,
        false,
      );
      defCth = defCthRes.cth;
      defDmg = defDmgRes.damage;
      defStrikes = WesnothCombatCore.calculateSwarmBlows(
        defWep,
        defender.hp,
        defender.maxHp,
      );
      defEV = (defCth / 100) * defDmg * defStrikes;
    }

    return {
      attacker,
      defender,
      attWep,
      defWep,
      attCth: attCthRes.cth,
      attDmg: attDmgRes.damage,
      attStrikes,
      attEV: attEV.toFixed(1),
      defCth,
      defDmg,
      defStrikes,
      defEV: defEV.toFixed(1),
    };
  }, [pendingCombat, units, grid]);

  return {
    units,
    setUnits,
    selectedUnitId,
    setSelectedUnitId,
    activeSide,
    setActiveSide,
    turn,
    setTurn,
    hoveredHex,
    setHoveredHex,
    history,
    actionLogs,
    activeMovement,
    pendingCombat,
    setPendingCombat,
    combatEffect,
    selectedUnit,
    reachableHexes,
    adjacentEnemies,
    combatForecast,
    moveUnit,
    executeCombat,
    endTurn,
    handleUndo,
    handleHexClick,
    resetState,
  };
}
