import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHexPosition } from '@/components/map-viewer/MapViewer';
import { WesnothBattleManager } from '@/lib/combat/battle-manager';
import { WesnothCombatCore } from '@/lib/combat/combat-core';
import type { CombatContext } from '@/lib/combat/types';
import { soundManager } from '@/lib/sound-manager';
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

export interface CombatStrikeState {
  attackerId: string;
  defenderId: string;
  weaponName: string;
  range: 'melee' | 'ranged';
  isHit: boolean;
  strikeIndex: number;
  timestamp: number;
}

let logCounter = 0;
export const createLog = (text: string): ActionLog => ({
  id: `${++logCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  text,
});

export interface PendingAdvancement {
  unitId: string;
  unitName: string;
  options: string[]; // e.g. ["Elvish Captain", "Elvish Hero"]
  currentType: string;
}

function advanceUnitState(
  u: TacticalUnitState,
  newTypeId: string,
  overflowXp: number,
): TacticalUnitState {
  const newUnitType = getUnitById(newTypeId);
  if (!newUnitType) return u;

  const baseState = WesnothBattleManager.initializeUnitState(
    newUnitType,
    u.traits.filter((t) => !t.startsWith('resistance_')),
    u.gender,
  );

  return {
    ...u,
    ...baseState,
    id: u.id,
    side: u.side,
    x: u.x,
    y: u.y,
    moves: newUnitType.movement,
    maxMoves: newUnitType.movement,
    hasAttacked: u.hasAttacked,
    xp: overflowXp,
    maxXp: baseState.maxXp,
    maxHp: baseState.maxHp,
    hp: baseState.maxHp,
    statuses: {
      poisoned: false,
      slowed: false,
      petrified: false,
    },
  };
}

function applyXpAndCheckLevelUp(
  u: TacticalUnitState,
  xpGained: number,
  onAutoAdvanceLog: (msg: string) => void,
): {
  unit: TacticalUnitState;
  pendingChoice?: { unitId: string; options: string[] };
} {
  const newXp = u.xp + xpGained;
  if (newXp >= u.maxXp) {
    const unitType = getUnitById(u.unitTypeId);
    const advancesTo = unitType?.advancesTo || [];
    const validAdvances = advancesTo.filter((id) => id && id !== 'null');

    if (validAdvances.length === 0) {
      // Max level reached
      return {
        unit: {
          ...u,
          xp: u.maxXp,
        },
      };
    }

    if (u.side === 2) {
      // CPU units auto-advance to first option
      const newTypeId = validAdvances[0];
      const advancedUnit = advanceUnitState(u, newTypeId, newXp - u.maxXp);
      onAutoAdvanceLog(
        `✨ CPU ${u.name} advanced to ${getUnitById(newTypeId)?.name}!`,
      );
      return { unit: advancedUnit };
    }

    if (validAdvances.length === 1) {
      // Player unit auto-advances if only one option
      const newTypeId = validAdvances[0];
      const advancedUnit = advanceUnitState(u, newTypeId, newXp - u.maxXp);
      onAutoAdvanceLog(
        `✨ ${u.name} advanced to ${getUnitById(newTypeId)?.name}!`,
      );
      return { unit: advancedUnit };
    }

    // Player unit has multiple choice
    return {
      unit: {
        ...u,
        xp: newXp, // temporarily hold newXp
      },
      pendingChoice: {
        unitId: u.id,
        options: validAdvances,
      },
    };
  }

  return {
    unit: {
      ...u,
      xp: newXp,
    },
  };
}

function applyTurnStartHealing(
  unitsList: TacticalUnitState[],
  side: number,
  grid: string[][],
  cols: number,
  rows: number,
): { nextUnits: TacticalUnitState[]; logs: ActionLog[] } {
  const healers = unitsList.filter((u) => {
    if (u.side !== side) return false;
    const type = getUnitById(u.unitTypeId);
    return (
      type?.abilities?.some((a) => a === 'heals' || a.startsWith('heals_')) ??
      false
    );
  });

  const healLogs: ActionLog[] = [];
  const nextUnits = unitsList.map((u) => {
    if (u.side !== side) return u;

    const cell = grid[u.y][u.x];
    const inVillage = isVillage(cell);
    const type = getUnitById(u.unitTypeId);
    const hasRegenerate = type?.abilities?.includes('regenerates') ?? false;

    // 0. Regeneration healing/curing
    if (hasRegenerate) {
      if (u.statuses.poisoned) {
        healLogs.push(
          createLog(
            `✨ ${side === 1 ? '' : 'CPU '}${u.name} regenerated and was cured of poison.`,
          ),
        );
        return {
          ...u,
          statuses: { ...u.statuses, poisoned: false },
        };
      }

      if (u.hp < u.maxHp) {
        const healAmount = 8;
        const healed = Math.min(u.maxHp, u.hp + healAmount) - u.hp;
        if (healed > 0) {
          healLogs.push(
            createLog(
              `💚 ${side === 1 ? '' : 'CPU '}${u.name} regenerated +${healed} HP.`,
            ),
          );
          return {
            ...u,
            hp: Math.min(u.maxHp, u.hp + healAmount),
          };
        }
      }
      return u;
    }

    // 1. Village healing/curing
    if (inVillage) {
      if (u.statuses.poisoned) {
        healLogs.push(
          createLog(
            `✨ ${side === 1 ? '' : 'CPU '}${u.name} was cured of poison at the Village.`,
          ),
        );
        return {
          ...u,
          statuses: { ...u.statuses, poisoned: false },
        };
      }

      if (u.hp < u.maxHp) {
        const healAmount = 8;
        const healed = Math.min(u.maxHp, u.hp + healAmount) - u.hp;
        healLogs.push(
          createLog(
            `💚 ${side === 1 ? '' : 'CPU '}${u.name} healed +${healed} HP at the Village.`,
          ),
        );
        return {
          ...u,
          hp: Math.min(u.maxHp, u.hp + healAmount),
        };
      }
      return u;
    }

    // 2. Healer healing/curing
    if (healers.length > 0) {
      const adj = getAdjacentHexes(u.x, u.y, cols, rows);
      const adjacentHealers = healers.filter(
        (h) => h.id !== u.id && adj.some((a) => a.x === h.x && a.y === h.y),
      );

      if (adjacentHealers.length > 0) {
        let maxHealPower = 0;
        let hasCures = false;

        for (const h of adjacentHealers) {
          const type = getUnitById(h.unitTypeId);
          if (type?.abilities) {
            for (const ability of type.abilities) {
              if (ability.startsWith('heals_')) {
                const amt = parseInt(ability.split('_')[1], 10);
                if (!Number.isNaN(amt) && amt > maxHealPower) {
                  maxHealPower = amt;
                }
              } else if (ability === 'heals') {
                if (4 > maxHealPower) maxHealPower = 4;
              }
              if (ability === 'cures') {
                hasCures = true;
              }
            }
          }
        }

        // Handle poison curing/slowing
        if (u.statuses.poisoned) {
          if (hasCures) {
            healLogs.push(
              createLog(
                `✨ ${side === 1 ? '' : 'CPU '}${u.name} was cured of poison by the healer.`,
              ),
            );
            return {
              ...u,
              statuses: { ...u.statuses, poisoned: false },
            };
          } else {
            // Poison is slowed by heals but not cured
            healLogs.push(
              createLog(
                `✨ ${side === 1 ? '' : 'CPU '}${u.name}'s poison was slowed by the healer.`,
              ),
            );
            return u;
          }
        }

        // Handle HP healing
        if (u.hp < u.maxHp && maxHealPower > 0) {
          const healed = Math.min(u.maxHp, u.hp + maxHealPower) - u.hp;
          if (healed > 0) {
            const healerNames = adjacentHealers
              .map((h) => {
                const type = getUnitById(h.unitTypeId);
                return type?.name || h.name;
              })
              .join(' & ');
            healLogs.push(
              createLog(
                `💚 ${side === 1 ? '' : 'CPU '}${u.name} healed +${healed} HP from the ${healerNames}'s presence.`,
              ),
            );
            return {
              ...u,
              hp: Math.min(u.maxHp, u.hp + maxHealPower),
            };
          }
        }
        return u;
      }
    }

    // 3. Poison damage if not in a village and not next to any healer
    if (u.statuses.poisoned) {
      const dmg = 8;
      const nextHp = Math.max(1, u.hp - dmg);
      const lostHp = u.hp - nextHp;
      if (lostHp > 0) {
        healLogs.push(
          createLog(
            `☠ ${side === 1 ? '' : 'CPU '}${u.name} suffered -${lostHp} HP from poison.`,
          ),
        );
      }
      return {
        ...u,
        hp: nextHp,
      };
    }

    return u;
  });

  return { nextUnits, logs: healLogs };
}

interface UseTacticalPuzzleStateProps {
  stage: PuzzleStage;
  initialPlayerSquad?: TacticalUnitState[] | null;
  onVictory: (xpGained: number, survivors: TacticalUnitState[]) => void;
  onDefeat: (reason: string) => void;
}

export function useTacticalPuzzleState({
  stage,
  initialPlayerSquad,
  onVictory,
  onDefeat,
}: UseTacticalPuzzleStateProps) {
  const [units, setUnits] = useState<TacticalUnitState[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<number>(1);
  const [turn, setTurn] = useState<number>(1);
  const [hoveredHex, setHoveredHex] = useState<HoveredHexState | null>(null);

  // Level-up choice selection state
  const [pendingAdvancement, setPendingAdvancement] =
    useState<PendingAdvancement | null>(null);

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

  // Combat timeouts tracking for cleanup
  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, []);

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

  // Combat Strike state (for individual hits/misses animation)
  const [combatStrike, setCombatStrike] = useState<CombatStrikeState | null>(
    null,
  );

  const grid = stage.grid;
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  // Reset stage helper
  const resetState = useCallback(() => {
    let nextNonLeaderIdx = 0;
    const playerSquad = initialPlayerSquad || [];
    const leaderUnit = playerSquad.find((u) => u.isLeader);
    const nonLeaderUnits = playerSquad.filter((u) => !u.isLeader);

    const initialized: TacticalUnitState[] = stage.startingUnits
      .map((placement, index) => {
        if (placement.side === 2) {
          // Enemy Unit
          const unitType = getUnitById(placement.unitTypeId);
          if (!unitType)
            throw new Error(`Unit type ${placement.unitTypeId} not found`);

          const baseState = WesnothBattleManager.initializeUnitState(
            unitType,
            [],
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
        } else {
          // Player Unit
          if (initialPlayerSquad && initialPlayerSquad.length > 0) {
            // Using carried over squad
            let squadUnit: (typeof initialPlayerSquad)[0] | undefined;
            if (placement.isLeader) {
              squadUnit = leaderUnit;
            } else {
              squadUnit = nonLeaderUnits[nextNonLeaderIdx++];
            }

            if (!squadUnit) return null; // Defeated in previous stage

            const unitType = getUnitById(squadUnit.unitTypeId);
            if (!unitType)
              throw new Error(`Unit type ${squadUnit.unitTypeId} not found`);

            return {
              ...squadUnit,
              x: placement.x,
              y: placement.y,
              moves: unitType.movement,
              maxMoves: unitType.movement,
              hasAttacked: false,
              statuses: {
                poisoned: false,
                slowed: false,
                petrified: false,
              },
            } as TacticalUnitState;
          } else {
            // Default setup (Tutorial or first stage)
            const unitType = getUnitById(placement.unitTypeId);
            if (!unitType)
              throw new Error(`Unit type ${placement.unitTypeId} not found`);

            const baseState = WesnothBattleManager.initializeUnitState(
              unitType,
              [],
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
          }
        }
      })
      .filter((u): u is TacticalUnitState => u !== null);

    setUnits(initialized);
    setSelectedUnitId(null);
    setActiveSide(1);
    setTurn(1);
    setHistory([]);
    setActionLogs([createLog(`Stage "${stage.name}" initialized. Turn 1.`)]);
    setPendingCombat(null);
    setCombatEffect(null);
    setCombatStrike(null);
    setPendingAdvancement(null);
  }, [stage, initialPlayerSquad]);

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
    if (
      history.length === 0 ||
      activeMovement ||
      activeSide !== 1 ||
      pendingAdvancement
    )
      return;
    const prev = history[history.length - 1];
    setUnits(prev);
    setHistory((prevStack) => prevStack.slice(0, -1));
    setSelectedUnitId(null);
    setActionLogs((prevLogs) => [createLog('Movement undone.'), ...prevLogs]);
  }, [history, activeMovement, activeSide, pendingAdvancement]);

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
                          u.statuses.slowed,
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
        totalCost += getUnitMovementCost(
          unitType,
          terrainKeys,
          unit.statuses.slowed,
        );
      }

      setActionLogs((prev) => [
        createLog(
          `${unit.name} (${unitType?.name}) moved to (${targetX + 1}, ${targetY + 1}) spending ${totalCost} movement.`,
        ),
        ...prev,
      ]);

      soundManager.playUi('click');

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
        attackerId: attId,
        defenderId: defId,
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

      // Clear any pre-existing timeouts before scheduling new ones
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];

      // Play each strike in the simulation sequentially
      result.logs.forEach((strike, idx) => {
        const strikeTimer = setTimeout(() => {
          soundManager.playAttack(strike.weaponName, strike.isHit);

          const isTargetDefender = strike.defenderId === defender.id;
          const targetRace = isTargetDefender ? defType.race : attType.race;

          if (strike.isHit) {
            soundManager.playHit(targetRace);
          }

          if (strike.isDead) {
            const dieTimer = setTimeout(() => {
              soundManager.playDie(targetRace);
            }, 120);
            timeoutIdsRef.current.push(dieTimer);
          }

          const isMainAttacker = strike.attackerId === attId;
          const resolvedRange = isMainAttacker
            ? result.attackerWeapon?.range || 'melee'
            : result.defenderWeapon?.range || 'melee';

          setCombatStrike({
            attackerId: strike.attackerId ?? '',
            defenderId: strike.defenderId ?? '',
            weaponName: strike.weaponName,
            range: resolvedRange,
            isHit: strike.isHit,
            strikeIndex: idx,
            timestamp: Date.now(),
          });
        }, idx * 220); // 220ms stagger between strikes
        timeoutIdsRef.current.push(strikeTimer);
      });

      const animationDuration = Math.max(500, result.logs.length * 220 + 80);

      const recoilTimer = setTimeout(() => {
        setCombatEffect((prev) => (prev ? { ...prev, stage: 'recoil' } : null));

        const endTimer = setTimeout(() => {
          setCombatEffect(null);
          setCombatStrike(null);

          let nextLevelUpChoice: { unitId: string; options: string[] } | null =
            null;
          const levelUpLogs: string[] = [];
          const logAutoAdvance = (msg: string) => {
            levelUpLogs.push(msg);
            soundManager.playLevelUp();
          };

          const nextUnits = units
            .map((u) => {
              if (u.id === attId) {
                const updatedHpStatus = {
                  ...u,
                  hp: result.attacker.hp,
                  statuses: { ...result.attacker.statuses },
                  hasAttacked: true,
                };
                const { unit, pendingChoice } = applyXpAndCheckLevelUp(
                  updatedHpStatus,
                  result.attackerXpGained,
                  logAutoAdvance,
                );
                if (pendingChoice) {
                  nextLevelUpChoice = pendingChoice;
                }
                return unit;
              }
              if (u.id === defId) {
                const updatedHpStatus = {
                  ...u,
                  hp: result.defender.hp,
                  statuses: { ...result.defender.statuses },
                };
                const { unit, pendingChoice } = applyXpAndCheckLevelUp(
                  updatedHpStatus,
                  result.defenderXpGained,
                  logAutoAdvance,
                );
                if (pendingChoice) {
                  nextLevelUpChoice = pendingChoice;
                }
                return unit;
              }
              return u;
            })
            .filter((u) => u.hp > 0);

          // Check for plague kills
          let spawnedPlagueUnit: TacticalUnitState | null = null;
          if (result.winner === 'attacker') {
            const hasPlague =
              result.attackerWeapon?.specials?.includes('plague');
            const defenderIsUndead =
              defType.race === 'undead' || defender.traits.includes('undead');
            const inVillage = isVillage(grid[defender.y][defender.x]);
            if (hasPlague && !defenderIsUndead && !inVillage) {
              const corpseType = getUnitById('Walking Corpse');
              if (corpseType) {
                const baseState = WesnothBattleManager.initializeUnitState(
                  corpseType,
                  [],
                );
                spawnedPlagueUnit = {
                  ...baseState,
                  id: `plague_${Date.now()}_Walking_Corpse`,
                  side: attacker.side,
                  x: defender.x,
                  y: defender.y,
                  moves: 0,
                  maxMoves: corpseType.movement,
                  isLeader: false,
                  hasAttacked: true,
                };
              }
            }
          } else if (result.winner === 'defender') {
            const hasPlague =
              result.defenderWeapon?.specials?.includes('plague');
            const attackerIsUndead =
              attType.race === 'undead' || attacker.traits.includes('undead');
            const inVillage = isVillage(grid[attacker.y][attacker.x]);
            if (hasPlague && !attackerIsUndead && !inVillage) {
              const corpseType = getUnitById('Walking Corpse');
              if (corpseType) {
                const baseState = WesnothBattleManager.initializeUnitState(
                  corpseType,
                  [],
                );
                spawnedPlagueUnit = {
                  ...baseState,
                  id: `plague_${Date.now()}_Walking_Corpse`,
                  side: defender.side,
                  x: attacker.x,
                  y: attacker.y,
                  moves: 0,
                  maxMoves: corpseType.movement,
                  isLeader: false,
                  hasAttacked: true,
                };
              }
            }
          }

          if (spawnedPlagueUnit) {
            nextUnits.push(spawnedPlagueUnit);
            levelUpLogs.push(
              `🧟 A Walking Corpse rose from the remains of ${result.winner === 'attacker' ? defender.name : attacker.name}!`,
            );
          }

          setUnits(nextUnits);

          if (levelUpLogs.length > 0) {
            setActionLogs((prev) => [
              ...levelUpLogs.map((msg) => createLog(msg)),
              ...prev,
            ]);
          }

          if (nextLevelUpChoice) {
            const choice = nextLevelUpChoice as {
              unitId: string;
              options: string[];
            };
            const choiceUnit = units.find((u) => u.id === choice.unitId);
            if (choiceUnit) {
              setPendingAdvancement({
                unitId: choice.unitId,
                unitName: choiceUnit.name,
                options: choice.options,
                currentType: choiceUnit.unitTypeId,
              });
            }
          }

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
        }, animationDuration - 250);
        timeoutIdsRef.current.push(endTimer);
      }, 250);
      timeoutIdsRef.current.push(recoilTimer);
    },
    [units, grid],
  );

  // Select Attacker Weapon (for Combat Forecast dialog selection)
  const selectAttackerWeapon = useCallback(
    (attWepIdx: number) => {
      setPendingCombat((prev) => {
        if (!prev) return null;
        const attacker = units.find((u) => u.id === prev.attackerId);
        const defender = units.find((u) => u.id === prev.defenderId);
        if (!attacker || !defender) return prev;

        const attType = getUnitById(attacker.unitTypeId);
        const defType = getUnitById(defender.unitTypeId);
        if (!attType || !defType) return prev;

        const attAttacks = WesnothBattleManager.getModifiedAttacks(
          attType,
          attacker,
        );
        const defAttacks = WesnothBattleManager.getModifiedAttacks(
          defType,
          defender,
        );

        const aWep = attAttacks[attWepIdx];
        if (!aWep) return prev;

        // Find defender counter index with matching range
        const defWepIdx = defAttacks.findIndex((w) => w.range === aWep.range);

        return {
          ...prev,
          attackerWeaponIndex: attWepIdx,
          defenderWeaponIndex: defWepIdx,
        };
      });
    },
    [units],
  );

  // End Turn function
  const endTurn = useCallback(() => {
    if (activeSide !== 1 || activeMovement || pendingAdvancement) return;

    setActiveSide(2); // CPU Side
    setSelectedUnitId(null);
    setHistory([]);

    const { nextUnits, logs: healLogs } = applyTurnStartHealing(
      units,
      2,
      grid,
      cols,
      rows,
    );
    const finalCpuStartUnits = nextUnits.map((u) => {
      if (u.side === 2) {
        return {
          ...u,
          moves: u.maxMoves,
          hasAttacked: false,
        };
      }
      if (u.side === 1) {
        return {
          ...u,
          statuses: {
            ...u.statuses,
            slowed: false,
          },
        };
      }
      return u;
    });

    setUnits(finalCpuStartUnits);
    setActionLogs((prev) => [
      createLog('CPU Turn starts...'),
      ...healLogs,
      ...prev,
    ]);
  }, [activeSide, activeMovement, grid, units, pendingAdvancement, cols, rows]);

  // CPU AI Behavior
  useEffect(() => {
    if (
      activeSide !== 2 ||
      activeMovement ||
      combatEffect ||
      pendingAdvancement
    )
      return;

    const cpuUnits = units.filter((u) => u.side === 2 && !u.hasAttacked);
    if (cpuUnits.length === 0) {
      // Return turn to player
      setActiveSide(1);
      setTurn((t) => t + 1);

      const { nextUnits, logs: healLogs } = applyTurnStartHealing(
        units,
        1,
        grid,
        cols,
        rows,
      );
      const finalPlayerStartUnits = nextUnits.map((u) => {
        if (u.side === 1) {
          return {
            ...u,
            moves: u.maxMoves,
            hasAttacked: false,
          };
        }
        if (u.side === 2) {
          return {
            ...u,
            statuses: {
              ...u.statuses,
              slowed: false,
            },
          };
        }
        return u;
      });

      setUnits(finalPlayerStartUnits);
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
            activeCpu.statuses.slowed,
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
    pendingAdvancement,
  ]);

  // Check Game Over Conditions
  useEffect(() => {
    if (units.length === 0) return;
    if (pendingAdvancement) return; // Wait for level-up choice resolution before checking victory

    const cpuRemaining = units.some((u) => u.side === 2);
    if (!cpuRemaining) {
      const totalXp = units
        .filter((u) => u.side === 1)
        .reduce((acc, u) => acc + u.xp, 0);
      onVictory(
        totalXp,
        units.filter((u) => u.side === 1),
      );
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
  }, [units, turn, stage.turnLimit, pendingAdvancement, onVictory, onDefeat]);

  // Click handler on hex cell
  const handleHexClick = useCallback(
    (cIdx: number, rIdx: number) => {
      if (
        activeSide !== 1 ||
        activeMovement ||
        combatEffect ||
        pendingAdvancement
      )
        return;

      const occupant = units.find((u) => u.x === cIdx && u.y === rIdx);

      // 1. Select player unit (including exhausted)
      if (occupant && occupant.side === 1) {
        setSelectedUnitId(occupant.id);
        setPendingCombat(null);
        soundManager.playUi('select');
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
        soundManager.playUi('select');
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
      pendingAdvancement,
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
      attAttacks,
      attackerWeaponIndex: pendingCombat.attackerWeaponIndex,
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

  const resolveAdvancement = useCallback(
    (unitId: string, chosenTypeId: string) => {
      setUnits((prevUnits) => {
        return prevUnits.map((u) => {
          if (u.id === unitId) {
            const overflowXp = Math.max(0, u.xp - u.maxXp);
            const advanced = advanceUnitState(u, chosenTypeId, overflowXp);
            setActionLogs((prev) => [
              createLog(
                `✨ ${u.name} advanced to ${getUnitById(chosenTypeId)?.name}!`,
              ),
              ...prev,
            ]);
            soundManager.playLevelUp();
            return advanced;
          }
          return u;
        });
      });
      setPendingAdvancement(null);
    },
    [],
  );

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
    combatStrike,
    selectedUnit,
    reachableHexes,
    adjacentEnemies,
    combatForecast,
    moveUnit,
    executeCombat,
    selectAttackerWeapon,
    endTurn,
    handleUndo,
    handleHexClick,
    resetState,
    pendingAdvancement,
    resolveAdvancement,
  };
}
