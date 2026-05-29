import { terrains } from '@webnoth/wesnoth-data/terrains';
import { parseCell } from '@/components/map-viewer/MapViewer';
import {
  getEffectiveMoveCosts,
  getMovetypeByName,
  getUnitById,
} from '@/lib/wesnoth-data';

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
  visualX?: number;
  visualY?: number;
  isMoving?: boolean;
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

/**
 * Checks if a grid cell represents a village.
 */
export function isVillage(cell: string): boolean {
  const { baseCode, overlayCode } = parseCell(cell);
  return baseCode.startsWith('V') || (overlayCode?.startsWith('V') ?? false);
}

/**
 * Returns hex coordinates adjacent to the given coordinates.
 */
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

/**
 * Returns movement key strings for a given terrain code.
 */
export function getTerrainKeysForCode(code: string): string[] {
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

/**
 * Resolves all movement terrain keys associated with a grid cell.
 */
export function getTerrainKeysForCell(cell: string): string[] {
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

/**
 * Calculates a unit's movement cost for entering particular terrains.
 */
export function getUnitMovementCost(
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

/**
 * Checks if coordinates are adjacent to any active level > 0 enemy units.
 */
export function isAdjacentToEnemy(
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

/**
 * Calculates reachable hexes using Dijkstra's algorithm from a unit's position.
 */
export function calculateReachableHexes(
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

/**
 * Computes a path to a target coordinate, optionally ignoring movement limits.
 */
export function findPath(
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

export interface ActiveMovement {
  unitId: string;
  path: { x: number; y: number }[];
  currentStepIndex: number;
  segmentProgress: number;
}
