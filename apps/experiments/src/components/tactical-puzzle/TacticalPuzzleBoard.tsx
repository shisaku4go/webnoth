import { Application, extend, useTick } from '@pixi/react';
import { Badge } from '@webnoth/ui/components/badge';
import { Button } from '@webnoth/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@webnoth/ui/components/card';
import { Separator } from '@webnoth/ui/components/separator';
import type { WesnothUnitType } from '@webnoth/wesnoth-data';
import { terrains } from '@webnoth/wesnoth-data/terrains';
import { ChevronRight, Info, RotateCcw, Swords, Undo } from 'lucide-react';
import {
  Assets,
  Container,
  type FederatedPointerEvent,
  Graphics,
  Polygon,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getHexPosition,
  getTerrainName,
  parseCell,
} from '@/components/map-viewer/MapViewer';
import { getPlayerColor } from '@/components/movement-simulator/MovementBoard';
import { wesnothAssetUrl } from '@/lib/asset-url';
import { WesnothBattleManager } from '@/lib/combat/battle-manager';
import { WesnothCombatCore } from '@/lib/combat/combat-core';
import type { CombatContext } from '@/lib/combat/types';
import type { PuzzleStage } from '@/lib/tactical-puzzle/stages';
import {
  getEffectiveMoveCosts,
  getMovetypeByName,
  getUnitById,
} from '@/lib/wesnoth-data';

interface ActionLog {
  id: string;
  text: string;
}

let logCounter = 0;
const createLog = (text: string): ActionLog => ({
  id: `${++logCounter}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
  text,
});

extend({ Sprite, Container, Graphics, Text });

const HEX_HIT_AREA = new Polygon([18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36]);

function isVillage(cell: string): boolean {
  const { baseCode, overlayCode } = parseCell(cell);
  return baseCode.startsWith('V') || (overlayCode?.startsWith('V') ?? false);
}

const ALIAS_TO_MOVEMENT_KEY: Record<string, string> = {
  Wdt: 'deep_water',
  Wst: 'shallow_water',
  Wrt: 'reef',
  Ss: 'swamp_water',
  Gt: 'flat',
  Ds: 'sand',
  Ft: 'forest',
  Ht: 'hills',
  Mt: 'mountains',
  Vt: 'village',
  Ct: 'castle',
  Ut: 'cave',
  At: 'frozen',
  Qt: 'unwalkable',
  Xt: 'impassable',
  Tf: 'fungus',
};

// Helper: Get adjacent hex coordinates
export function getAdjacentHexes(
  col: number,
  row: number,
  maxCols: number,
  maxRows: number,
): { x: number; y: number }[] {
  const isOdd = col % 2 !== 0;
  const candidates = isOdd
    ? [
        { x: col, y: row - 1 },
        { x: col, y: row + 1 },
        { x: col - 1, y: row },
        { x: col - 1, y: row + 1 },
        { x: col + 1, y: row },
        { x: col + 1, y: row + 1 },
      ]
    : [
        { x: col, y: row - 1 },
        { x: col, y: row + 1 },
        { x: col - 1, y: row - 1 },
        { x: col - 1, y: row },
        { x: col + 1, y: row - 1 },
        { x: col + 1, y: row },
      ];

  return candidates.filter(
    (c) => c.x >= 0 && c.x < maxCols && c.y >= 0 && c.y < maxRows,
  );
}

// Get movement keys for terrain code
function getTerrainKeysForCode(code: string): string[] {
  let terrain = terrains.find((t) => t.code === code);
  if (!terrain && !code.startsWith('^')) {
    terrain = terrains.find((t) => t.code === `^${code}`);
  } else if (!terrain && code.startsWith('^')) {
    terrain = terrains.find((t) => t.code === code.substring(1));
  }

  if (!terrain) {
    const directKey = ALIAS_TO_MOVEMENT_KEY[code];
    if (directKey) return [directKey];
    return [];
  }

  const keys: string[] = [];
  const codesToCheck = [...(terrain.aliasOf ?? [])];
  codesToCheck.push(terrain.code);

  for (const c of codesToCheck) {
    const key = ALIAS_TO_MOVEMENT_KEY[c];
    if (key) {
      keys.push(key);
    }
  }

  return keys;
}

function getTerrainKeysForCell(cell: string): string[] {
  const { baseCode, overlayCode } = parseCell(cell);
  const keys: string[] = [];

  const baseKeys = getTerrainKeysForCode(baseCode);
  keys.push(...baseKeys);

  if (overlayCode) {
    const overlayKeys = getTerrainKeysForCode(`^${overlayCode}`);
    keys.push(...overlayKeys);
  }

  return keys.length === 0 ? ['flat'] : keys;
}

function getUnitMovementCost(
  unitType: ReturnType<typeof getUnitById>,
  terrainKeys: string[],
): number {
  if (!unitType) return Infinity;

  const movetype = getMovetypeByName(unitType.movementType);
  const isFlying =
    movetype?.flying === true ||
    [
      'drakefly',
      'drakeglide',
      'flamefly',
      'fly',
      'lightfly',
      'spirit',
    ].includes(unitType.movementType);
  const baseCosts = getEffectiveMoveCosts(unitType);

  let maxCost = 0;

  if (terrainKeys.length === 0) return Infinity;

  for (const key of terrainKeys) {
    if (key === 'impassable') return Infinity;

    let cost = baseCosts[key];
    if (cost === undefined) {
      if (isFlying) cost = 1;
      else return Infinity;
    }

    if (cost >= 99) return Infinity;
    maxCost = Math.max(maxCost, cost);
  }

  return maxCost;
}

function isAdjacentToEnemy(
  col: number,
  row: number,
  side: number,
  allUnits: TacticalUnitState[],
  maxCols: number,
  maxRows: number,
): boolean {
  const adj = getAdjacentHexes(col, row, maxCols, maxRows);
  for (const n of adj) {
    const occupant = allUnits.find((u) => u.x === n.x && u.y === n.y);
    if (occupant && occupant.side !== side) {
      const occupantType = getUnitById(occupant.unitTypeId);
      if (occupantType && occupantType.level > 0) {
        return true;
      }
    }
  }
  return false;
}

// Pathfinder: reachable hexes
function calculateReachableHexes(
  unit: TacticalUnitState,
  allUnits: TacticalUnitState[],
  grid: string[][],
): Record<string, number> {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  if (cols === 0) return {};

  const startKey = `${unit.x}_${unit.y}`;
  const maxMovesLeft: Record<string, number> = {
    [startKey]: unit.moves,
  };

  const queue: { x: number; y: number; movesLeft: number }[] = [
    { x: unit.x, y: unit.y, movesLeft: unit.moves },
  ];

  const unitPositions = new Map<string, TacticalUnitState>();
  for (const u of allUnits) {
    unitPositions.set(`${u.x}_${u.y}`, u);
  }

  const unitType = getUnitById(unit.unitTypeId);
  const hasSkirmisher = unitType?.abilities?.includes('skirmisher') ?? false;

  while (queue.length > 0) {
    queue.sort((a, b) => b.movesLeft - a.movesLeft);
    const curr = queue.shift();
    if (!curr) continue;
    const currKey = `${curr.x}_${curr.y}`;

    if (curr.movesLeft < (maxMovesLeft[currKey] ?? -1)) continue;
    if (curr.movesLeft <= 0) continue;

    const neighbors = getAdjacentHexes(curr.x, curr.y, cols, rows);
    for (const nb of neighbors) {
      const nbKey = `${nb.x}_${nb.y}`;
      const occupant = unitPositions.get(nbKey);

      if (occupant && occupant.side !== unit.side) continue;

      const cell = grid[nb.y][nb.x];
      const terrainKeys = getTerrainKeysForCell(cell);
      const cost = getUnitMovementCost(unitType, terrainKeys);
      if (cost === Infinity) continue;

      let nextMovesLeft = Math.max(0, curr.movesLeft - cost);

      if (
        !hasSkirmisher &&
        nextMovesLeft > 0 &&
        isAdjacentToEnemy(nb.x, nb.y, unit.side, allUnits, cols, rows)
      ) {
        nextMovesLeft = 0;
      }

      const prevBest = maxMovesLeft[nbKey] ?? -1;
      if (nextMovesLeft > prevBest) {
        maxMovesLeft[nbKey] = nextMovesLeft;
        queue.push({ x: nb.x, y: nb.y, movesLeft: nextMovesLeft });
      }
    }
  }

  return maxMovesLeft;
}

// Pathfinder: find path
function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  unit: TacticalUnitState,
  allUnits: TacticalUnitState[],
  grid: string[][],
  ignoreMovesLimit = false,
): { x: number; y: number }[] | null {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  if (cols === 0) return null;

  const unitType = getUnitById(unit.unitTypeId);
  const hasSkirmisher = unitType?.abilities?.includes('skirmisher') ?? false;

  interface Node {
    x: number;
    y: number;
    movesLeft: number;
    parent: Node | null;
  }

  const startMoves = ignoreMovesLimit ? 999 : unit.moves;

  const queue: Node[] = [
    { x: startX, y: startY, movesLeft: startMoves, parent: null },
  ];

  const maxMovesLeft: Record<string, number> = {
    [`${startX}_${startY}`]: startMoves,
  };

  let bestTargetNode: Node | null = null;

  while (queue.length > 0) {
    queue.sort((a, b) => b.movesLeft - a.movesLeft);
    const curr = queue.shift();
    if (!curr) break;

    if (curr.x === targetX && curr.y === targetY) {
      if (!bestTargetNode || curr.movesLeft > bestTargetNode.movesLeft) {
        bestTargetNode = curr;
      }
    }

    if (curr.movesLeft <= 0) continue;

    const neighbors = getAdjacentHexes(curr.x, curr.y, cols, rows);
    for (const nb of neighbors) {
      const nbKey = `${nb.x}_${nb.y}`;
      const occupant = allUnits.find((u) => u.x === nb.x && u.y === nb.y);
      if (occupant && occupant.side !== unit.side) {
        if (!(nb.x === targetX && nb.y === targetY)) {
          continue;
        }
      }

      const cell = grid[nb.y][nb.x];
      const terrainKeys = getTerrainKeysForCell(cell);
      const cost = getUnitMovementCost(unitType, terrainKeys);
      if (cost === Infinity) continue;

      let nextMovesLeft = Math.max(0, curr.movesLeft - cost);

      if (
        !ignoreMovesLimit &&
        !hasSkirmisher &&
        nextMovesLeft > 0 &&
        isAdjacentToEnemy(nb.x, nb.y, unit.side, allUnits, cols, rows) &&
        !(nb.x === targetX && nb.y === targetY)
      ) {
        nextMovesLeft = 0;
      }

      const prevBest = maxMovesLeft[nbKey] ?? -1;
      if (nextMovesLeft > prevBest) {
        maxMovesLeft[nbKey] = nextMovesLeft;
        queue.push({
          x: nb.x,
          y: nb.y,
          movesLeft: nextMovesLeft,
          parent: curr,
        });
      }
    }
  }

  if (!bestTargetNode) return null;

  const path: { x: number; y: number }[] = [];
  let currNode: Node | null = bestTargetNode;
  while (currNode) {
    path.push({ x: currNode.x, y: currNode.y });
    currNode = currNode.parent;
  }
  return path.reverse();
}

export interface TacticalUnitState {
  id: string;
  unitTypeId: string;
  side: number; // 1 = Player, 2 = CPU
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  alignment: 'lawful' | 'chaotic' | 'neutral' | 'liminal';
  traits: string[];
  statuses: {
    poisoned: boolean;
    slowed: boolean;
    petrified: boolean;
  };
  activeWeaponIndex: number;
  xp: number;
  maxXp: number;
  name: string;
  gender: string;
  level: number;
  moves: number;
  maxMoves: number;
  isLeader: boolean;
  hasAttacked: boolean;
  // Animation/visual rendering coordinates
  visualX?: number;
  visualY?: number;
  isMoving?: boolean;
}

interface ActiveMovement {
  unitId: string;
  path: { x: number; y: number }[];
  currentStepIndex: number;
  segmentProgress: number;
}

interface TacticalPuzzleBoardProps {
  stage: PuzzleStage;
  onVictory: (xpGained: number) => void;
  onDefeat: (reason: string) => void;
  onReset: () => void;
}

export function TacticalPuzzleBoard({
  stage,
  onVictory,
  onDefeat,
  onReset,
}: TacticalPuzzleBoardProps) {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<TacticalUnitState[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<number>(1);
  const [turn, setTurn] = useState<number>(1);
  const [hoveredHex, setHoveredHex] = useState<{
    x: number;
    y: number;
    code: string;
    terrainName: string;
  } | null>(null);

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
  const [combatEffect, setCombatEffect] = useState<{
    attackerId: string;
    defenderId: string;
    attackerWeaponName: string | null;
    attackerX: number;
    attackerY: number;
    defenderX: number;
    defenderY: number;
    stage: 'none' | 'strike' | 'recoil';
    message?: string;
  } | null>(null);

  const grid = stage.grid;
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  // Initial unit loading
  useEffect(() => {
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

  // Asset pre-loading
  useEffect(() => {
    let active = true;
    setLoading(true);

    const imageUrls = new Set<string>();

    // Load terrain images
    for (let r = 0; r < grid.length; r++) {
      for (const cell of grid[r]) {
        const { baseCode, overlayCode } = parseCell(cell);
        const base = terrains.find((t) => t.code === baseCode);
        if (base?.symbolImage) {
          imageUrls.add(wesnothAssetUrl(`terrain/${base.symbolImage}.png`));
        }
        if (overlayCode) {
          const overlay = terrains.find((t) => t.code === `^${overlayCode}`);
          if (overlay?.symbolImage) {
            imageUrls.add(
              wesnothAssetUrl(`terrain/${overlay.symbolImage}.png`),
            );
          }
        }
      }
    }

    // Load unit images
    for (const uPlacement of stage.startingUnits) {
      const type = getUnitById(uPlacement.unitTypeId);
      if (type) {
        imageUrls.add(wesnothAssetUrl(type.image));
        // Preload all animation frames
        if (type.animations) {
          for (const anim of type.animations) {
            for (const f of anim.frames ?? []) {
              if (f.image) {
                imageUrls.add(wesnothAssetUrl(f.image));
              }
            }
          }
        }
      }
    }

    const urls = Array.from(imageUrls);
    Promise.all(
      urls.map((url) =>
        Assets.load(url).catch((err) => {
          console.warn(`Failed to load texture: ${url}`, err);
          return null;
        }),
      ),
    ).then((results) => {
      if (!active) return;
      const map: Record<string, Texture> = {};
      urls.forEach((url, i) => {
        if (results[i]) {
          map[url] = results[i];
        }
      });
      setTextures(map);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [grid, stage.startingUnits]);

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
  const handleUndo = () => {
    if (history.length === 0 || activeMovement || activeSide !== 1) return;
    const prev = history[history.length - 1];
    setUnits(prev);
    setHistory((prevStack) => prevStack.slice(0, -1));
    setSelectedUnitId(null);
    setActionLogs((prevLogs) => [createLog('Movement undone.'), ...prevLogs]);
  };

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
              // Village captured feedback (no gold in this pure battle version, but captures the village)
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
  const moveUnit = (unitId: string, targetX: number, targetY: number) => {
    if (activeMovement || activeSide !== 1) return;
    const unit = units.find((u) => u.id === unitId);
    if (!unit) return;

    const path = findPath(unit.x, unit.y, targetX, targetY, unit, units, grid);
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
  };

  // Combat Execution
  const executeCombat = useCallback(
    (attId: string, defId: string, attWepIdx: number, defWepIdx: number) => {
      const attacker = units.find((u) => u.id === attId);
      const defender = units.find((u) => u.id === defId);
      if (!attacker || !defender) return;

      const attType = getUnitById(attacker.unitTypeId);
      const defType = getUnitById(defender.unitTypeId);
      if (!attType || !defType) return;

      // Clear history stack - action is irreversible!
      setHistory([]);
      setPendingCombat(null);

      // Context resolution (Dawn/Dusk/Morning schedule default is morning (+25% lawful))
      const context: CombatContext = {
        terrainId: getTerrainKeysForCell(grid[defender.y][defender.x])[0],
        timeOfDayId: 'morning',
        lawfulBonus: 25, // +25% lawful bonus, -25% chaotic bonus
      };

      // Run the actual combat simulation using WesnothBattleManager
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

      // Play combat graphics animation
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

          // Apply results to state
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
              .filter((u) => u.hp > 0); // Remove dead units
          });

          // Add combat logs
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
    setActionLogs((prev) => [createLog('CPU Turn starts...'), ...prev]);
  }, [activeSide, activeMovement]);

  // CPU AI Behavior
  useEffect(() => {
    if (activeSide !== 2 || activeMovement || combatEffect) return;

    // Get all CPU units
    const cpuUnits = units.filter((u) => u.side === 2 && !u.hasAttacked);
    if (cpuUnits.length === 0) {
      // All CPU units done, return turn to Player
      setActiveSide(1);
      setTurn((t) => t + 1);
      setUnits((prevUnits) =>
        prevUnits.map((u) => ({
          ...u,
          moves: u.maxMoves,
          hasAttacked: false,
        })),
      );
      setActionLogs((prev) => [
        createLog(`Turn ${turn + 1}: Player Turn`),
        ...prev,
      ]);
      return;
    }

    // Process one CPU unit
    const activeCpu = cpuUnits[0];
    const cpuType = getUnitById(activeCpu.unitTypeId);
    if (!cpuType) return;

    // Find closest player unit
    const playerUnits = units.filter((u) => u.side === 1);
    if (playerUnits.length === 0) return; // Player already defeated

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
        // No path to any player, just skip unit
        setUnits((prev) =>
          prev.map((u) =>
            u.id === activeCpu.id ? { ...u, hasAttacked: true } : u,
          ),
        );
        return;
      }

      const targetPlayer = closestPlayer;
      // Check if player is already adjacent
      const adj = getAdjacentHexes(activeCpu.x, activeCpu.y, cols, rows);
      const isPlayerAdjacent = adj.some(
        (a) => a.x === targetPlayer.x && a.y === targetPlayer.y,
      );

      if (isPlayerAdjacent) {
        // Attack immediately!
        const attWepIdx = 0; // Simple AI default weapon
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
        // Can we move towards them?
        // Find how far we can move along the path
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

        // Adjust targetIndex backwards if the destination cell is occupied by any unit
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
          // Move unit
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

          // Check if destination is adjacent to any player unit to determine if we can attack
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
                    // If adjacent to a player, do NOT set hasAttacked to true, so it can attack in the next tick
                    hasAttacked: !playerAdjacent,
                  };
                }
                return u;
              });
            });
          }, pathSlice.length * 300);
        } else {
          // Cannot move even 1 tile, skip unit
          setUnits((prev) =>
            prev.map((u) =>
              u.id === activeCpu.id ? { ...u, hasAttacked: true } : u,
            ),
          );
        }
      }
    }, 600); // 600ms AI actions delay

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

    // Check Player victory (all CPU units eliminated)
    const cpuRemaining = units.some((u) => u.side === 2);
    if (!cpuRemaining) {
      // Calculate XP gained by all units
      const totalXp = units
        .filter((u) => u.side === 1)
        .reduce((acc, u) => acc + u.xp, 0);
      onVictory(totalXp);
      return;
    }

    // Check Player defeat (all player units eliminated)
    const playerRemaining = units.some((u) => u.side === 1);
    if (!playerRemaining) {
      onDefeat('All your units were defeated.');
      return;
    }

    // Check turn limit
    if (turn > stage.turnLimit) {
      onDefeat('You exceeded the turn limit.');
    }
  }, [units, turn, stage.turnLimit, onVictory, onDefeat]);

  // Click handler on hex cell
  const handleHexClick = (cIdx: number, rIdx: number) => {
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
          // Auto select weapon index
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
              : WesnothBattleManager.getModifiedAttacks(attType, selectedUnit),
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
  };

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

    // Defense values
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch select-none w-full">
      {/* Pixi Canvas Grid */}
      <div className="flex-1 min-h-[500px] h-[550px] relative rounded-xl border border-border/80 shadow-lg overflow-hidden bg-zinc-950 flex flex-col">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center bg-background/40 backdrop-blur-sm">
            <div className="text-center space-y-3">
              <div className="animate-spin size-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground font-semibold animate-pulse">
                Loading game assets...
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full flex-1 overflow-hidden relative cursor-default">
            <Application
              width={cols * 54 + 60}
              height={rows * 72 + 60}
              backgroundAlpha={0}
              antialias={true}
            >
              <pixiContainer x={20} y={20} scale={0.9}>
                {/* 1. Map Terrains rendering */}
                {grid.map((row, rIdx) =>
                  row.map((cell, cIdx) => {
                    const { baseCode, overlayCode } = parseCell(cell);
                    const pos = getHexPosition(cIdx, rIdx);

                    const base = terrains.find((t) => t.code === baseCode);
                    const overlay = overlayCode
                      ? terrains.find((t) => t.code === `^${overlayCode}`)
                      : undefined;

                    const baseTexture = base?.symbolImage
                      ? textures[
                          wesnothAssetUrl(`terrain/${base.symbolImage}.png`)
                        ]
                      : null;
                    const overlayTexture = overlay?.symbolImage
                      ? textures[
                          wesnothAssetUrl(`terrain/${overlay.symbolImage}.png`)
                        ]
                      : null;

                    const isReachable =
                      reachableHexes[`${cIdx}_${rIdx}`] !== undefined;
                    const isTarget = adjacentEnemies.some(
                      (u) => u.x === cIdx && u.y === rIdx,
                    );

                    return (
                      <pixiContainer key={`tile-${rIdx}-${cIdx}`}>
                        {baseTexture?.source && (
                          <pixiSprite
                            texture={baseTexture}
                            x={pos.x}
                            y={pos.y}
                            width={72}
                            height={72}
                          />
                        )}
                        {overlayTexture?.source && (
                          <pixiSprite
                            texture={overlayTexture}
                            x={pos.x}
                            y={pos.y}
                            width={72}
                            height={72}
                          />
                        )}

                        {/* Reachable/Movement highlight overlays */}
                        {isReachable && (
                          <pixiGraphics
                            x={pos.x}
                            y={pos.y}
                            draw={(g) => {
                              g.clear();
                              g.stroke({
                                width: 2.5,
                                color: 0x10b981,
                                alpha: 0.85,
                              }); // Green path outline
                              g.fill({ color: 0x10b981, alpha: 0.15 });
                              g.drawPolygon([
                                18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                              ]);
                            }}
                          />
                        )}

                        {/* Adjacent Enemy / Attack Target highlight */}
                        {isTarget && (
                          <pixiGraphics
                            x={pos.x}
                            y={pos.y}
                            draw={(g) => {
                              g.clear();
                              g.stroke({
                                width: 3,
                                color: 0xef4444,
                                alpha: 0.95,
                              }); // Red outline for target
                              g.fill({ color: 0xef4444, alpha: 0.2 });
                              g.drawPolygon([
                                18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                              ]);
                            }}
                          />
                        )}

                        {/* Interactive Hex Graphics */}
                        <pixiGraphics
                          x={pos.x}
                          y={pos.y}
                          eventMode="static"
                          hitArea={HEX_HIT_AREA}
                          onPointerOver={() => {
                            const name = getTerrainName(baseCode, overlayCode);
                            setHoveredHex({
                              x: cIdx,
                              y: rIdx,
                              code: cell,
                              terrainName: name,
                            });
                          }}
                          onPointerOut={() => setHoveredHex(null)}
                          onPointerDown={() => handleHexClick(cIdx, rIdx)}
                          draw={(g) => {
                            g.clear();
                            g.stroke({
                              width: 1,
                              color: 0x555555,
                              alpha: 0.15,
                            });
                            g.fill({ color: 0xffffff, alpha: 0.0001 });
                            g.drawPolygon([
                              18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                            ]);
                          }}
                        />
                      </pixiContainer>
                    );
                  }),
                )}

                {/* 2. Combat Jiggle/Slash Effect */}
                {combatEffect && (
                  <pixiGraphics
                    draw={(g) => {
                      g.clear();
                      if (combatEffect.stage === 'strike') {
                        // Draw red slash indicator between attacker and defender
                        const midX =
                          (combatEffect.attackerX + combatEffect.defenderX) /
                            2 +
                          36;
                        const midY =
                          (combatEffect.attackerY + combatEffect.defenderY) /
                            2 +
                          36;
                        g.stroke({ width: 5, color: 0xef4444, alpha: 1.0 });
                        g.moveTo(midX - 15, midY - 15);
                        g.lineTo(midX + 15, midY + 15);
                      }
                    }}
                  />
                )}

                {/* 3. Unit rendering */}
                {units.map((unit) => {
                  const type = getUnitById(unit.unitTypeId);
                  if (!type) return null;

                  const colorConfig = getPlayerColor(unit.side);
                  const isSelected = selectedUnitId === unit.id;

                  // Resolve coordinates (visual is for animation lerping)
                  const defaultPos = getHexPosition(unit.x, unit.y);
                  const uX =
                    unit.visualX !== undefined ? unit.visualX : defaultPos.x;
                  const uY =
                    unit.visualY !== undefined ? unit.visualY : defaultPos.y;

                  return (
                    <pixiContainer key={unit.id}>
                      {/* Base ring color */}
                      <pixiGraphics
                        key={`base-ring-${unit.id}-${isSelected}`}
                        x={uX + 36}
                        y={uY + 54}
                        draw={(g) => {
                          g.clear();
                          g.drawEllipse(0, 0, 22, 10)
                            .fill({ color: colorConfig.hex, alpha: 0.28 })
                            .stroke({
                              width: isSelected ? 2.5 : 1.2,
                              color: isSelected ? 0xeab308 : colorConfig.hex,
                              alpha: 0.9,
                            });
                        }}
                      />

                      {/* Health bar overlay */}
                      <pixiGraphics
                        key={`hp-bar-${unit.id}-${unit.hp}-${unit.maxHp}`}
                        x={uX + 18}
                        y={uY + 62}
                        draw={(g) => {
                          g.clear();
                          const pct = unit.hp / unit.maxHp;
                          g.fill({ color: 0x27272a, alpha: 0.8 }).drawRect(
                            0,
                            0,
                            36,
                            4,
                          ); // background
                          g.fill({
                            color: pct > 0.4 ? 0x22c55e : 0xef4444,
                            alpha: 1.0,
                          }).drawRect(0, 0, 36 * pct, 4); // filled
                        }}
                      />

                      {/* Status indicator dots */}
                      {unit.statuses.poisoned && (
                        <pixiGraphics
                          key={`poison-${unit.id}`}
                          x={uX + 54}
                          y={uY + 12}
                          draw={(g) => {
                            g.clear();
                            g.drawCircle(0, 0, 3).fill({ color: 0x22c55e }); // Poison Green
                          }}
                        />
                      )}

                      {/* Sprite element with animation support */}
                      <UnitAnimatedSprite
                        unitType={type}
                        textures={textures}
                        isAttacking={
                          combatEffect?.attackerId === unit.id &&
                          combatEffect?.stage === 'strike'
                        }
                        attackWeaponName={
                          combatEffect?.attackerId === unit.id &&
                          combatEffect?.stage === 'strike'
                            ? combatEffect.attackerWeaponName
                            : null
                        }
                        uX={uX}
                        uY={uY}
                        cursor={unit.side === 1 ? 'pointer' : 'default'}
                        onPointerDown={(e: FederatedPointerEvent) => {
                          e.stopPropagation();
                          handleHexClick(unit.x, unit.y);
                        }}
                      />
                    </pixiContainer>
                  );
                })}
              </pixiContainer>
            </Application>
          </div>
        )}
      </div>

      {/* Control / Sidebar Panel */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-lg justify-between">
        <div className="space-y-4">
          {/* Header stage details */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500 block">
              {stage.mapName} · Turn {turn}/{stage.turnLimit}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
              {stage.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {stage.description}
            </p>
          </div>

          <Separator className="bg-border/60" />

          {/* 1. Hex Inspector Panel */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-emerald-500" />
              Tile Details
            </h3>
            <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[4.5rem] flex flex-col justify-center text-xs">
              {hoveredHex ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Coordinates</span>
                    <span className="font-mono bg-muted/60 px-1 rounded text-foreground">
                      x={hoveredHex.x + 1}, y={hoveredHex.y + 1}
                    </span>
                  </div>
                  <div className="font-bold text-foreground truncate">
                    {hoveredHex.terrainName}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground/80 italic">
                  Hover tiles to inspect defense/movement details
                </div>
              )}
            </div>
          </div>

          {/* 2. Unit Details Panel */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Swords className="size-3.5 text-emerald-500" />
              Unit Profile
            </h3>
            <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[7.5rem] flex flex-col justify-center text-xs">
              {selectedUnit ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        {selectedUnit.name}
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1 bg-muted"
                        >
                          Lvl {selectedUnit.level}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {getUnitById(selectedUnit.unitTypeId)?.name}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selectedUnit.hasAttacked ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-green-500/10 text-green-400 border border-green-500/25'}`}
                    >
                      {selectedUnit.hasAttacked ? 'Exhausted' : 'Ready'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="flex justify-between bg-zinc-900/60 p-1.5 rounded">
                      <span className="text-muted-foreground">HP</span>
                      <span className="font-bold tabular-nums">
                        {selectedUnit.hp}/{selectedUnit.maxHp}
                      </span>
                    </div>
                    <div className="flex justify-between bg-zinc-900/60 p-1.5 rounded">
                      <span className="text-muted-foreground">Moves</span>
                      <span className="font-bold tabular-nums">
                        {selectedUnit.moves}/{selectedUnit.maxMoves}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground/80 italic">
                  Select a unit to view stats & actions
                </div>
              )}
            </div>
          </div>

          {/* 3. Action Buttons & Turn Actions */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={history.length === 0 || activeSide !== 1}
                className="text-xs flex items-center gap-1 h-9 cursor-pointer"
              >
                <Undo className="size-3" />
                Undo Move
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="text-xs flex items-center gap-1 h-9 cursor-pointer border-zinc-700/50 hover:bg-zinc-800"
              >
                <RotateCcw className="size-3" />
                Restart
              </Button>
            </div>
            <Button
              onClick={endTurn}
              disabled={activeSide !== 1}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold h-10 cursor-pointer flex items-center justify-center gap-1"
            >
              End Turn
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        {/* 4. Action Logs console */}
        <div className="mt-4 pt-4 border-t border-border/40 space-y-2 flex-1 flex flex-col justify-end min-h-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">
            Battle Logs
          </span>
          <div className="h-28 overflow-y-auto bg-black/40 border border-zinc-800/40 rounded p-2 text-[9px] font-mono space-y-1 text-zinc-400">
            {actionLogs.map((log) => (
              <div
                key={log.id}
                className={`leading-normal ${log.text.startsWith('☠') ? 'text-red-400 font-bold' : log.text.startsWith('Combat:') ? 'text-amber-300' : ''}`}
              >
                {log.text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Combat Prediction Dialog overlay */}
      {pendingCombat && combatForecast && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-zinc-900/60 pb-3">
              <CardTitle className="text-md font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-1.5">
                  <Swords className="size-4.5 text-red-500" />
                  Combat Forecast
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Morning Phase (+25% Lawful Bonus)
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select your attack weapon and press Engage to resolve the
                battle.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Attacker panel */}
                <div className="space-y-2 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-emerald-400">
                      {combatForecast.attacker.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    >
                      Attacker
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    HP: {combatForecast.attacker.hp}/
                    {combatForecast.attacker.maxHp}
                  </div>
                  <div className="pt-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Selected Strike
                    </span>
                    <span className="font-bold text-xs text-foreground">
                      {combatForecast.attWep.name}
                    </span>
                    <div className="text-[10px] font-medium text-muted-foreground flex justify-between pt-1">
                      <span>Hit Prob: {combatForecast.attCth}%</span>
                      <span>
                        Dmg: {combatForecast.attDmg} ×{' '}
                        {combatForecast.attStrikes}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-semibold pt-1 border-t border-zinc-800/40 mt-1">
                      Expected Value: {combatForecast.attEV} HP
                    </div>
                  </div>
                </div>

                {/* Defender panel */}
                <div className="space-y-2 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-cyan-400">
                      {combatForecast.defender.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    >
                      Defender
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    HP: {combatForecast.defender.hp}/
                    {combatForecast.defender.maxHp}
                  </div>
                  <div className="pt-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Counter Strike
                    </span>
                    <span className="font-bold text-xs text-foreground">
                      {combatForecast.defWep
                        ? combatForecast.defWep.name
                        : 'No Counter'}
                    </span>
                    {combatForecast.defWep ? (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground flex justify-between pt-1">
                          <span>Hit Prob: {combatForecast.defCth}%</span>
                          <span>
                            Dmg: {combatForecast.defDmg} ×{' '}
                            {combatForecast.defStrikes}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-400 font-semibold pt-1 border-t border-zinc-800/40 mt-1">
                          Expected Value: {combatForecast.defEV} HP
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-red-400 font-semibold pt-1">
                        Out of range weapon!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirm / Cancel actions */}
              <div className="flex gap-3 justify-end pt-2 border-t border-zinc-800/40">
                <Button
                  variant="outline"
                  onClick={() => setPendingCombat(null)}
                  className="cursor-pointer font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    executeCombat(
                      pendingCombat.attackerId,
                      pendingCombat.defenderId,
                      pendingCombat.attackerWeaponIndex,
                      pendingCombat.defenderWeaponIndex,
                    )
                  }
                  className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs cursor-pointer px-6"
                >
                  Engage!
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

interface UnitAnimatedSpriteProps {
  unitType: WesnothUnitType;
  textures: Record<string, Texture>;
  isAttacking: boolean;
  attackWeaponName: string | null;
  uX: number;
  uY: number;
  onPointerDown: (e: FederatedPointerEvent) => void;
  cursor: string;
}

function UnitAnimatedSprite({
  unitType,
  textures,
  isAttacking,
  attackWeaponName,
  uX,
  uY,
  onPointerDown,
  cursor,
}: UnitAnimatedSpriteProps) {
  const [frameIdx, setFrameIdx] = useState(0);
  const [_elapsed, setElapsed] = useState(0);
  const [animType, setAnimType] = useState<'standing' | 'attack'>('standing');

  const currentFrames = useMemo(() => {
    if (isAttacking && unitType.animations) {
      const attackAnim =
        unitType.animations.find(
          (a) =>
            a.type === 'attack' &&
            (!attackWeaponName || a.filterAttack === attackWeaponName),
        ) || unitType.animations.find((a) => a.type === 'attack');

      if (attackAnim?.frames && attackAnim.frames.length > 0) {
        return attackAnim.frames;
      }
    }

    if (unitType.animations) {
      const standingAnim =
        unitType.animations.find(
          (a) => a.type === 'standing' && a.frames && a.frames.length > 0,
        ) ||
        unitType.animations.find(
          (a) => a.type === 'idle' && a.frames && a.frames.length > 0,
        );

      if (standingAnim?.frames && standingAnim.frames.length > 0) {
        return standingAnim.frames;
      }
    }

    return [{ image: unitType.image, duration: 1000 }];
  }, [isAttacking, attackWeaponName, unitType]);

  useEffect(() => {
    setFrameIdx(0);
    setElapsed(0);
    setAnimType(isAttacking ? 'attack' : 'standing');
    // Reference currentFrames length to satisfy Biome exhaustive dependencies
    const _len = currentFrames.length;
  }, [isAttacking, currentFrames]);

  useTick((ticker) => {
    if (currentFrames.length <= 1) return;

    setElapsed((prev) => {
      const nextElapsed = prev + ticker.deltaMS;
      const currentFrame = currentFrames[frameIdx];
      const duration = currentFrame?.duration || 150;

      if (nextElapsed >= duration) {
        setFrameIdx((idx) => {
          const nextIdx = idx + 1;
          if (nextIdx >= currentFrames.length) {
            if (animType === 'attack') {
              return idx;
            }
            return 0;
          }
          return nextIdx;
        });
        return 0;
      }
      return nextElapsed;
    });
  });

  const frame = currentFrames[frameIdx] ||
    currentFrames[0] || { image: unitType.image };
  const imageUrl = wesnothAssetUrl(frame.image || unitType.image);
  const texture =
    textures[imageUrl] || textures[wesnothAssetUrl(unitType.image)];

  if (!texture?.source) return null;

  return (
    <pixiSprite
      texture={texture}
      x={uX + 36}
      y={uY + 36}
      anchor={0.5}
      width={56}
      height={56}
      eventMode="static"
      cursor={cursor}
      onPointerDown={onPointerDown}
    />
  );
}
