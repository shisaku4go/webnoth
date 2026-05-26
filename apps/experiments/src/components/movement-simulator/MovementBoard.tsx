import { Application, extend } from '@pixi/react';
import { Badge } from '@webnoth/ui/components/badge';
import { Button } from '@webnoth/ui/components/button';
import { Separator } from '@webnoth/ui/components/separator';
import { multiplayerMaps } from '@webnoth/wesnoth-data/multiplayer';
import { terrains } from '@webnoth/wesnoth-data/terrains';
import {
  ArrowLeft,
  Calendar,
  Compass,
  Footprints,
  Info,
  Maximize2,
  Minus,
  Plus,
  Users,
} from 'lucide-react';
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getHexPosition,
  getTerrainName,
  parseCell,
} from '@/components/map-viewer/MapViewer';
import { wesnothAssetUrl } from '@/lib/asset-url';
import {
  getEffectiveMoveCosts,
  getFactionsByEra,
  getMovetypeByName,
  getUnitById,
  type WesnothUnitType,
} from '@/lib/wesnoth-data';

extend({ Sprite, Container, Graphics, Text });

const HEX_HIT_AREA = new Polygon([18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36]);

function isKeep(cell: string): boolean {
  const { baseCode, overlayCode } = parseCell(cell);
  return baseCode.startsWith('K') || (overlayCode?.startsWith('K') ?? false);
}

function isCastle(cell: string): boolean {
  const { baseCode, overlayCode } = parseCell(cell);
  return (
    baseCode.startsWith('C') ||
    baseCode.startsWith('K') ||
    (overlayCode?.startsWith('C') ?? false) ||
    (overlayCode?.startsWith('K') ?? false)
  );
}

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

// Helper: Get adjacent hex coordinates in an Odd-Q column-staggered flat-topped system
export function getAdjacentHexes(
  col: number,
  row: number,
  maxCols: number,
  maxRows: number,
): { x: number; y: number }[] {
  const isOdd = col % 2 !== 0;
  const candidates = isOdd
    ? [
        { x: col, y: row - 1 }, // Up
        { x: col, y: row + 1 }, // Down
        { x: col - 1, y: row }, // Left-Up
        { x: col - 1, y: row + 1 }, // Left-Down
        { x: col + 1, y: row }, // Right-Up
        { x: col + 1, y: row + 1 }, // Right-Down
      ]
    : [
        { x: col, y: row - 1 }, // Up
        { x: col, y: row + 1 }, // Down
        { x: col - 1, y: row - 1 }, // Left-Up
        { x: col - 1, y: row }, // Left-Down
        { x: col + 1, y: row - 1 }, // Right-Up
        { x: col + 1, y: row }, // Right-Down
      ];

  return candidates.filter(
    (c) => c.x >= 0 && c.x < maxCols && c.y >= 0 && c.y < maxRows,
  );
}

// Helper: Get animation frames for standing or idle animations
function getUnitAnimationFrames(
  unitType?: WesnothUnitType,
): { image: string; duration?: number }[] {
  if (!unitType?.animations) return [];

  // Filter standing animations
  const standingAnims = unitType.animations.filter(
    (a) => a.type === 'standing',
  );
  // Try to find one with multiple frames first
  const multiFrameStanding = standingAnims.find(
    (a) => a.frames && a.frames.length > 1,
  );
  if (multiFrameStanding) return multiFrameStanding.frames;
  if (standingAnims.length > 0 && standingAnims[0].frames?.length > 0) {
    return standingAnims[0].frames;
  }

  // Otherwise try idle animations
  const idleAnims = unitType.animations.filter((a) => a.type === 'idle');
  const multiFrameIdle = idleAnims.find((a) => a.frames && a.frames.length > 1);
  if (multiFrameIdle) return multiFrameIdle.frames;
  if (idleAnims.length > 0 && idleAnims[0].frames?.length > 0) {
    return idleAnims[0].frames;
  }

  return [];
}

// Helper: Get movement cost category keys for a terrain code
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

// Helper: Get movement cost category keys for a full cell string (e.g. "Gs^Fms")
function getTerrainKeysForCell(cell: string): string[] {
  const { baseCode, overlayCode } = parseCell(cell);
  const keys: string[] = [];

  const baseKeys = getTerrainKeysForCode(baseCode);
  keys.push(...baseKeys);

  if (overlayCode) {
    const overlayKeys = getTerrainKeysForCode(`^${overlayCode}`);
    keys.push(...overlayKeys);
  }

  if (keys.length === 0) {
    return ['flat'];
  }

  return keys;
}

// Helper: Get effective movement cost of a unit on a given set of terrain keys
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

  if (terrainKeys.length === 0) {
    return Infinity;
  }

  for (const key of terrainKeys) {
    if (key === 'impassable') {
      return Infinity;
    }

    let cost = baseCosts[key];
    if (cost === undefined) {
      if (isFlying) {
        cost = 1;
      } else {
        return Infinity;
      }
    }

    if (cost >= 99) {
      return Infinity;
    }

    maxCost = Math.max(maxCost, cost);
  }

  return maxCost;
}

// Helper: Check if a tile is adjacent to any enemy unit (ZOC)
function isAdjacentToEnemy(
  col: number,
  row: number,
  side: number,
  allUnits: UnitState[],
  maxCols: number,
  maxRows: number,
): boolean {
  const adj = getAdjacentHexes(col, row, maxCols, maxRows);
  for (const n of adj) {
    const occupant = allUnits.find((u) => u.x === n.x && u.y === n.y);
    if (occupant && occupant.side !== side) {
      const occupantType = getUnitById(occupant.unitTypeId);
      // Only Level 1+ units exert ZOC
      if (occupantType && occupantType.level > 0) {
        return true;
      }
    }
  }
  return false;
}

// Helper: Insert items into queue sorted in ascending order of movesLeft
function pushSortedDijkstra(
  queue: { x: number; y: number; movesLeft: number }[],
  item: { x: number; y: number; movesLeft: number },
) {
  let low = 0;
  let high = queue.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (queue[mid].movesLeft < item.movesLeft) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  queue.splice(low, 0, item);
}

// Dijkstra Pathfinder: Calculate all reachable hexes and remaining moves at each
function calculateReachableHexes(
  unit: UnitState,
  allUnits: UnitState[],
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

  // We index units by position for O(1) checks
  const unitPositions = new Map<string, UnitState>();
  for (const u of allUnits) {
    unitPositions.set(`${u.x}_${u.y}`, u);
  }

  const unitType = getUnitById(unit.unitTypeId);
  const hasSkirmisher = unitType?.abilities?.includes('skirmisher') ?? false;

  while (queue.length > 0) {
    const curr = queue.pop();
    if (!curr) continue;
    const currKey = `${curr.x}_${curr.y}`;

    if (curr.movesLeft < (maxMovesLeft[currKey] ?? -1)) {
      continue;
    }

    if (curr.movesLeft <= 0) {
      continue;
    }

    const neighbors = getAdjacentHexes(curr.x, curr.y, cols, rows);
    for (const nb of neighbors) {
      const nbKey = `${nb.x}_${nb.y}`;
      const occupant = unitPositions.get(nbKey);

      // Cannot move through enemy units
      if (occupant && occupant.side !== unit.side) {
        continue;
      }

      // Calculate terrain cost
      const cell = grid[nb.y][nb.x];
      const terrainKeys = getTerrainKeysForCell(cell);
      const cost = getUnitMovementCost(unitType, terrainKeys);
      if (cost === Infinity) {
        continue;
      }

      // Standard move cost deduction
      let nextMovesLeft = Math.max(0, curr.movesLeft - cost);

      // ZOC Rule: entering enemy ZOC sets remaining moves to 0 (unless skirmisher)
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
        pushSortedDijkstra(queue, {
          x: nb.x,
          y: nb.y,
          movesLeft: nextMovesLeft,
        });
      }
    }
  }

  return maxMovesLeft;
}

// Dijkstra/BFS Pathfinder: Find the exact step-by-step path to the target hex
function findPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  unit: UnitState,
  allUnits: UnitState[],
  grid: string[][],
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

  const queue: Node[] = [
    { x: startX, y: startY, movesLeft: unit.moves, parent: null },
  ];

  const maxMovesLeft: Record<string, number> = {
    [`${startX}_${startY}`]: unit.moves,
  };

  let bestTargetNode: Node | null = null;

  while (queue.length > 0) {
    // Sort descending to explore paths with more moves remaining first (Dijkstra behavior)
    queue.sort((a, b) => b.movesLeft - a.movesLeft);
    const curr = queue.shift();
    if (!curr) break;

    if (curr.x === targetX && curr.y === targetY) {
      if (!bestTargetNode || curr.movesLeft > bestTargetNode.movesLeft) {
        bestTargetNode = curr;
      }
    }

    if (curr.movesLeft <= 0) {
      continue;
    }

    const neighbors = getAdjacentHexes(curr.x, curr.y, cols, rows);
    for (const nb of neighbors) {
      const nbKey = `${nb.x}_${nb.y}`;

      // Cannot move through enemy units
      const occupant = allUnits.find((u) => u.x === nb.x && u.y === nb.y);
      if (occupant && occupant.side !== unit.side) {
        continue;
      }

      // Calculate terrain cost
      const cell = grid[nb.y][nb.x];
      const terrainKeys = getTerrainKeysForCell(cell);
      const cost = getUnitMovementCost(unitType, terrainKeys);
      if (cost === Infinity) {
        continue;
      }

      let nextMovesLeft = Math.max(0, curr.movesLeft - cost);

      // ZOC Rule
      if (
        !hasSkirmisher &&
        nextMovesLeft > 0 &&
        isAdjacentToEnemy(nb.x, nb.y, unit.side, allUnits, cols, rows) &&
        !(nb.x === targetX && nb.y === targetY) // ZOC doesn't halt if target hex is destination
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

  // Reconstruct path
  const path: { x: number; y: number }[] = [];
  let currNode: Node | null = bestTargetNode;
  while (currNode) {
    path.push({ x: currNode.x, y: currNode.y });
    currNode = currNode.parent;
  }
  return path.reverse();
}

interface ActiveMovement {
  unitId: string;
  unitSide: number;
  path: { x: number; y: number }[];
  currentStepIndex: number;
  segmentProgress: number;
  targetMoves: number;
}

interface MovementBoardProps {
  eraId: string;
  p1FactionId: string;
  p1LeaderId: string;
  p2FactionId: string;
  p2LeaderId: string;
  mapId: string;
  p1Controller: 'human' | 'none';
  p2Controller: 'human' | 'none';
  onReset: () => void;
}

interface UnitState {
  id: string; // unique ID e.g. "p1-leader"
  unitTypeId: string;
  side: number; // 1 or 2
  x: number; // 0-indexed column (col)
  y: number; // 0-indexed row (row)
  hitpoints: number;
  maxHitpoints: number;
  moves: number;
  maxMoves: number;
  isLeader: boolean;
}

interface UnitSpriteProps {
  unit: UnitState;
  unitType: ReturnType<typeof getUnitById>;
  textures: Record<string, Texture>;
  isSelected: boolean;
  isUnitActive: boolean;
  ringColor: number;
  animateUnits: boolean;
  visualX?: number;
  visualY?: number;
  isMoving?: boolean;
  onSelect: (id: string) => void;
}

function UnitSprite({
  unit,
  unitType,
  textures,
  isSelected,
  isUnitActive,
  ringColor,
  animateUnits,
  visualX,
  visualY,
  isMoving,
  onSelect,
}: UnitSpriteProps) {
  const defaultPos = getHexPosition(unit.x, unit.y);
  const posX = visualX !== undefined ? visualX : defaultPos.x;
  const posY = visualY !== undefined ? visualY : defaultPos.y;

  // Extract frames
  const frames = useMemo(() => {
    return getUnitAnimationFrames(unitType);
  }, [unitType]);

  const totalDuration = useMemo(() => {
    return frames.reduce((acc, f) => acc + (f.duration ?? 150), 0);
  }, [frames]);

  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (!animateUnits || frames.length <= 1 || totalDuration === 0) {
      setFrameIndex(0);
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!active) return;
      const currentFrame = frames[frameIndex];
      const baseDuration = currentFrame.duration ?? 150;
      // Cycle frames at 2.5x speed when moving to match walking/running velocity
      const duration = isMoving
        ? Math.max(30, baseDuration / 2.5)
        : baseDuration;

      timerId = setTimeout(() => {
        setFrameIndex((prevIndex) => (prevIndex + 1) % frames.length);
      }, duration);
    };

    tick();

    return () => {
      active = false;
      clearTimeout(timerId);
    };
  }, [frameIndex, frames, totalDuration, animateUnits, isMoving]);

  // Determine current texture
  const texture = useMemo(() => {
    if (!unitType) return null;

    // Default (static) texture path
    const defaultPath = wesnothAssetUrl(unitType.image);

    if (animateUnits && frames.length > 0) {
      const currentFrame = frames[frameIndex];
      if (currentFrame?.image) {
        const framePath = wesnothAssetUrl(currentFrame.image);
        const animTexture = textures[framePath];
        if (animTexture?.source) {
          return animTexture;
        }
      }
    }

    return textures[defaultPath] ?? null;
  }, [unitType, animateUnits, frames, frameIndex, textures]);

  return (
    <pixiContainer>
      {/* Foot Team Ring Indicator */}
      <pixiGraphics
        x={posX + 36}
        y={posY + 54}
        draw={() => {}}
        ref={(g: Graphics | null) => {
          if (!g) return;
          g.clear();
          g.drawEllipse(0, 0, 22, 10)
            .fill({ color: ringColor, alpha: 0.28 })
            .stroke({
              width: isSelected ? 2.5 : 1.2,
              color: isSelected ? 0xf59e0b : ringColor, // Gold border if selected
              alpha: 0.85,
            });
        }}
      />

      {/* Active state indicator dot */}
      {isUnitActive && (
        <pixiGraphics
          x={posX + 50}
          y={posY + 12}
          draw={() => {}}
          ref={(g: Graphics | null) => {
            if (!g) return;
            g.clear();
            g.drawCircle(0, 0, 3.5)
              .fill({ color: 0x10b981, alpha: 1.0 }) // Green active dot
              .stroke({ width: 1, color: 0x000000 });
          }}
        />
      )}

      {/* Unit Sprite */}
      {texture?.source && (
        <pixiSprite
          texture={texture}
          x={posX + 36}
          y={posY + 36}
          anchor={0.5}
          width={60}
          height={60}
          eventMode="static"
          cursor="pointer"
          onPointerDown={(e: FederatedPointerEvent) => {
            e.stopPropagation();
            onSelect(unit.id);
          }}
        />
      )}
    </pixiContainer>
  );
}

export function MovementBoard({
  eraId,
  p1FactionId,
  p1LeaderId,
  p2FactionId,
  p2LeaderId,
  mapId,
  p1Controller,
  p2Controller,
  onReset,
}: MovementBoardProps) {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(true);
  const [animateUnits, setAnimateUnits] = useState(true);
  const [activeMovement, setActiveMovement] = useState<ActiveMovement | null>(
    null,
  );
  const [units, setUnits] = useState<UnitState[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [gold, setGold] = useState<Record<number, number>>({ 1: 100, 2: 100 });
  const [recruitUnitTypeId, setRecruitUnitTypeId] = useState<string | null>(
    null,
  );
  const [capturedVillages, setCapturedVillages] = useState<
    Record<string, number>
  >({});

  const hasActiveMovement = activeMovement !== null;

  // Smooth movement animation loop
  useEffect(() => {
    if (!hasActiveMovement) return;

    let active = true;
    let lastTime = performance.now();
    const speed = 0.004; // progress units per millisecond (~125ms per hex segment)

    const frame = (now: number) => {
      if (!active) return;
      const dt = now - lastTime;
      lastTime = now;

      setActiveMovement((prev) => {
        if (!prev) return null;
        let nextProgress = prev.segmentProgress + dt * speed;
        let nextStepIndex = prev.currentStepIndex;

        if (nextProgress >= 1) {
          nextProgress = 0;
          nextStepIndex += 1;
        }

        // If we reached the end of the path
        if (nextStepIndex >= prev.path.length - 1) {
          setUnits((unitsPrev) =>
            unitsPrev.map((u) =>
              u.id === prev.unitId
                ? {
                    ...u,
                    x: prev.path[prev.path.length - 1].x,
                    y: prev.path[prev.path.length - 1].y,
                    moves: prev.targetMoves,
                  }
                : u,
            ),
          );
          // Unselect to trigger path recalculated bounds
          setSelectedUnitId(null);
          return null;
        }

        return {
          ...prev,
          currentStepIndex: nextStepIndex,
          segmentProgress: nextProgress,
        };
      });

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);

    return () => {
      active = false;
    };
  }, [hasActiveMovement]);

  // Turn management
  const [turn, setTurn] = useState(1);
  const [activeSide, setActiveSide] = useState<number>(1);

  // Pan & Zoom
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [inputValue, setInputValue] = useState(String(Math.round(zoom * 100)));
  const [hoveredHex, setHoveredHex] = useState<{
    x: number;
    y: number;
    code: string;
    terrainName: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const currentMap = useMemo(() => {
    return multiplayerMaps.find((m) => m.id === mapId);
  }, [mapId]);

  const grid = currentMap?.grid ?? [];
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  const clampOffset = useCallback(
    (x: number, y: number, currentZoom = zoom) => {
      if (dimensions.width === 0 || dimensions.height === 0) return { x, y };

      const mapW = cols * 54 + 18;
      const mapH = rows * 72 + 36;
      const scaledW = mapW * currentZoom;
      const scaledH = mapH * currentZoom;

      let clampedX = x;
      let clampedY = y;

      if (scaledW >= dimensions.width) {
        clampedX = Math.max(dimensions.width - scaledW, Math.min(0, x));
      } else {
        clampedX = (dimensions.width - scaledW) / 2;
      }

      if (scaledH >= dimensions.height) {
        clampedY = Math.max(dimensions.height - scaledH, Math.min(0, y));
      } else {
        clampedY = (dimensions.height - scaledH) / 2;
      }

      return { x: clampedX, y: clampedY };
    },
    [dimensions, cols, rows, zoom],
  );

  // Find map bounding box to center it
  const activeBounds = useMemo(() => {
    let minCol = Number.MAX_SAFE_INTEGER;
    let maxCol = Number.MIN_SAFE_INTEGER;
    let minRow = Number.MAX_SAFE_INTEGER;
    let maxRow = Number.MIN_SAFE_INTEGER;
    let hasVisibleTiles = false;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const { baseCode } = parseCell(grid[r][c]);
        if (
          baseCode &&
          !baseCode.startsWith('_off') &&
          baseCode !== '_s' &&
          baseCode !== '_f'
        ) {
          if (c < minCol) minCol = c;
          if (c > maxCol) maxCol = c;
          if (r < minRow) minRow = r;
          if (r > maxRow) maxRow = r;
          hasVisibleTiles = true;
        }
      }
    }

    if (!hasVisibleTiles) {
      return {
        activeWidth: cols > 0 ? (cols - 1) * 54 + 72 : 0,
        activeHeight: rows > 0 ? rows * 72 + 36 : 0,
        minX: 0,
        minY: 0,
      };
    }

    const minX = minCol * 54;
    const maxX = maxCol * 54 + 72;
    const minY = minRow * 72;
    const maxY = maxRow * 72 + 108;

    return {
      activeWidth: maxX - minX,
      activeHeight: maxY - minY,
      minX,
      minY,
    };
  }, [grid, cols, rows]);

  const { activeWidth, activeHeight, minX, minY } = activeBounds;
  const centerX = minX + activeWidth / 2;
  const centerY = minY + activeHeight / 2;

  // Track container size dynamically
  useEffect(() => {
    if (loading) return;
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [loading]);

  // Sync zoom input value
  useEffect(() => {
    setInputValue(String(Math.round(zoom * 100)));
  }, [zoom]);

  // Initialize Units and Load Textures
  useEffect(() => {
    if (!currentMap) return;

    let active = true;
    setLoading(true);
    setSelectedUnitId(null);

    // 1. Identify starting coordinates for Leaders (scanning all start positions on the map)
    const initialUnits: UnitState[] = [];
    const p1LeaderInfo = getUnitById(p1LeaderId);
    const p2LeaderInfo = getUnitById(p2LeaderId);

    const startPositions: { startPos: string; r: number; c: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const { startPos } = parseCell(grid[r][c]);
        if (startPos) {
          startPositions.push({ startPos, r, c });
        }
      }
    }

    // Sort start positions naturally (e.g., "1" < "2" < "3" < "4")
    startPositions.sort((a, b) =>
      a.startPos.localeCompare(b.startPos, undefined, { numeric: true }),
    );

    if (startPositions.length > 0 && p1LeaderInfo) {
      const p1Pos = startPositions[0];
      initialUnits.push({
        id: 'p1-leader',
        unitTypeId: p1LeaderId,
        side: 1,
        x: p1Pos.c,
        y: p1Pos.r,
        hitpoints: p1LeaderInfo.hitpoints,
        maxHitpoints: p1LeaderInfo.hitpoints,
        moves: p1LeaderInfo.movement,
        maxMoves: p1LeaderInfo.movement,
        isLeader: true,
      });
    }

    if (startPositions.length > 1 && p2LeaderInfo) {
      const p2Pos = startPositions[1];
      initialUnits.push({
        id: 'p2-leader',
        unitTypeId: p2LeaderId,
        side: 2,
        x: p2Pos.c,
        y: p2Pos.r,
        hitpoints: p2LeaderInfo.hitpoints,
        maxHitpoints: p2LeaderInfo.hitpoints,
        moves: p2LeaderInfo.movement,
        maxMoves: p2LeaderInfo.movement,
        isLeader: true,
      });
    }

    setUnits(initialUnits);

    // 2. Build asset URLs to load (terrains & units)
    const imageUrls = new Set<string>();

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

    // Add leader unit sprites and their animation frames
    if (p1LeaderInfo) {
      imageUrls.add(wesnothAssetUrl(p1LeaderInfo.image));
      const frames = getUnitAnimationFrames(p1LeaderInfo);
      for (const f of frames) {
        if (f.image) {
          imageUrls.add(wesnothAssetUrl(f.image));
        }
      }
    }
    if (p2LeaderInfo) {
      imageUrls.add(wesnothAssetUrl(p2LeaderInfo.image));
      const frames = getUnitAnimationFrames(p2LeaderInfo);
      for (const f of frames) {
        if (f.image) {
          imageUrls.add(wesnothAssetUrl(f.image));
        }
      }
    }

    // Add recruit unit sprites and their animation frames
    const p1Faction = getFactionsByEra(eraId).find((f) => f.id === p1FactionId);
    if (p1Faction) {
      for (const id of p1Faction.recruit) {
        const u = getUnitById(id);
        if (u) {
          if (u.image) {
            imageUrls.add(wesnothAssetUrl(u.image));
          }
          const frames = getUnitAnimationFrames(u);
          for (const f of frames) {
            if (f.image) {
              imageUrls.add(wesnothAssetUrl(f.image));
            }
          }
        }
      }
    }
    const p2Faction = getFactionsByEra(eraId).find((f) => f.id === p2FactionId);
    if (p2Faction) {
      for (const id of p2Faction.recruit) {
        const u = getUnitById(id);
        if (u) {
          if (u.image) {
            imageUrls.add(wesnothAssetUrl(u.image));
          }
          const frames = getUnitAnimationFrames(u);
          for (const f of frames) {
            if (f.image) {
              imageUrls.add(wesnothAssetUrl(f.image));
            }
          }
        }
      }
    }

    // Also pre-fetch scenario items if any
    if (currentMap.items) {
      for (const item of currentMap.items) {
        if (item.value?.image) {
          imageUrls.add(wesnothAssetUrl(item.value.image));
        }
      }
    }

    const urls = Array.from(imageUrls);

    Promise.all(
      urls.map((url) =>
        Assets.load(url).catch((err) => {
          console.warn(`Failed to load asset: ${url}`, err);
          return null;
        }),
      ),
    ).then((results) => {
      if (!active) return;
      const loaded: Record<string, Texture> = {};
      urls.forEach((url, i) => {
        if (results[i]) {
          loaded[url] = results[i];
        }
      });
      setTextures(loaded);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    currentMap,
    grid,
    p1LeaderId,
    p2LeaderId,
    eraId,
    p1FactionId,
    p2FactionId,
  ]);

  // Auto-capture village when a unit lands on one
  useEffect(() => {
    if (units.length === 0) return;
    setCapturedVillages((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const u of units) {
        const cell = grid[u.y]?.[u.x];
        if (cell && isVillage(cell)) {
          const key = `${u.x}_${u.y}`;
          if (next[key] !== u.side) {
            next[key] = u.side;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [units, grid]);

  const focusOnHex = useCallback(
    (col: number, row: number, currentZoom = zoom) => {
      const pos = getHexPosition(col, row);
      const targetX = dimensions.width / 2 - (pos.x + 36) * currentZoom;
      const targetY = dimensions.height / 2 - (pos.y + 36) * currentZoom;
      setOffset(clampOffset(targetX, targetY, currentZoom));
    },
    [dimensions, zoom, clampOffset],
  );

  const handleLocateLeader = (side: number) => {
    const leader = units.find((u) => u.side === side && u.isLeader);
    if (leader) {
      focusOnHex(leader.x, leader.y);
    }
  };

  const zoomIn = () => {
    const currentPct = Math.round(zoom * 100);
    const nextPct = Math.floor(currentPct / 10) * 10 + 10;
    changeZoomCentrally(nextPct / 100);
  };

  const zoomOut = () => {
    const currentPct = Math.round(zoom * 100);
    const prevPct = Math.ceil(currentPct / 10) * 10 - 10;
    changeZoomCentrally(prevPct / 100);
  };

  // Center map on dimensions, focusing on P1 leader initially with zoom 1.0 (filling space, no void margins)
  const hasCentered = useRef(false);
  useEffect(() => {
    if (
      !loading &&
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      units.length > 0 &&
      !hasCentered.current
    ) {
      const p1 = units.find((u) => u.side === 1 && u.isLeader);
      const initialZoom = 1.0; // Default zoom at 100% to prevent empty void spaces
      setZoom(initialZoom);
      if (p1) {
        focusOnHex(p1.x, p1.y, initialZoom);
        hasCentered.current = true;
      } else {
        const targetOffset = clampOffset(
          dimensions.width / 2 - centerX * initialZoom,
          dimensions.height / 2 - centerY * initialZoom,
          initialZoom,
        );
        setOffset(targetOffset);
        hasCentered.current = true;
      }
    }
  }, [loading, dimensions, centerX, centerY, units, focusOnHex, clampOffset]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const rawX = e.clientX - dragStart.current.x;
    const rawY = e.clientY - dragStart.current.y;
    setOffset(clampOffset(rawX, rawY));
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const changeZoomCentrally = (nextZoom: number) => {
    const clampedZoom = Math.max(0.15, Math.min(3.0, nextZoom));
    if (dimensions.width > 0 && dimensions.height > 0) {
      const mapW = cols * 54 + 18;
      const mapH = rows * 72 + 36;
      const prevAppWidth = Math.min(dimensions.width, mapW * zoom);
      const prevAppHeight = Math.min(dimensions.height, mapH * zoom);
      const nextAppWidth = Math.min(dimensions.width, mapW * clampedZoom);
      const nextAppHeight = Math.min(dimensions.height, mapH * clampedZoom);

      const viewportCenterX = prevAppWidth / 2;
      const viewportCenterY = prevAppHeight / 2;
      const nextViewportCenterX = nextAppWidth / 2;
      const nextViewportCenterY = nextAppHeight / 2;

      const targetX =
        nextViewportCenterX -
        ((viewportCenterX - offset.x) / zoom) * clampedZoom;
      const targetY =
        nextViewportCenterY -
        ((viewportCenterY - offset.y) / zoom) * clampedZoom;

      setOffset(clampOffset(targetX, targetY, clampedZoom));
    }
    setZoom(clampedZoom);
  };

  const resetView = () => {
    if (dimensions.width > 0 && dimensions.height > 0) {
      const initialZoom = 1.0;
      setZoom(initialZoom);
      const targetOffset = clampOffset(
        dimensions.width / 2 - centerX * initialZoom,
        dimensions.height / 2 - centerY * initialZoom,
        initialZoom,
      );
      setOffset(targetOffset);
    }
  };

  const _handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyManualZoom();
    }
  };

  const applyManualZoom = () => {
    const parsed = Number.parseInt(inputValue, 10);
    if (!Number.isNaN(parsed)) {
      const clamped = Math.max(15, Math.min(300, parsed));
      changeZoomCentrally(clamped / 100);
    } else {
      setInputValue(String(Math.round(zoom * 100)));
    }
  };

  // Turn management switching
  const handleEndTurn = () => {
    if (activeMovement) return;
    let nextSide = activeSide === 1 ? 2 : 1;
    let nextTurn = turn;
    if (nextSide === 1) {
      nextTurn += 1;
    }

    // Handle skip for 'none' controller
    const nextController = nextSide === 1 ? p1Controller : p2Controller;
    if (nextController === 'none') {
      nextSide = nextSide === 1 ? 2 : 1;
      if (nextSide === 1) {
        nextTurn += 1;
      }
    }

    // Calculate and apply income for nextSide starting their turn
    // (excluding Turn 1, as neither player gets income on Turn 1 in Wesnoth)
    const isFirstTurnForSide =
      (nextSide === 1 && nextTurn === 1) || (nextSide === 2 && turn === 1);
    if (!isFirstTurnForSide) {
      const nextSideVillages = Object.values(capturedVillages).filter(
        (side) => side === nextSide,
      ).length;

      const baseIncome = 2;
      const villageGold = nextSideVillages * 1;

      const nextSideUnits = units.filter((u) => u.side === nextSide);
      const totalUnitLevel = nextSideUnits
        .filter((u) => !u.isLeader)
        .reduce((sum, u) => {
          const unitType = getUnitById(u.unitTypeId);
          return sum + (unitType?.level ?? 0);
        }, 0);
      const freeUpkeep = nextSideVillages;
      const upkeep = Math.max(0, totalUnitLevel - freeUpkeep);

      const netIncome = baseIncome + villageGold - upkeep;

      setGold((prevGold) => ({
        ...prevGold,
        [nextSide]: prevGold[nextSide] + netIncome,
      }));
    }

    setActiveSide(nextSide);
    setTurn(nextTurn);
    setSelectedUnitId(null);
    setRecruitUnitTypeId(null); // Clear pending recruitment

    // Center camera on the next active player's leader
    const nextLeader = units.find((u) => u.side === nextSide && u.isLeader);
    if (nextLeader) {
      focusOnHex(nextLeader.x, nextLeader.y);
    }

    // Recover movement points for units of the next active side
    setUnits((prev) =>
      prev.map((u) => (u.side === nextSide ? { ...u, moves: u.maxMoves } : u)),
    );
  };

  const activePlayerController = activeSide === 1 ? p1Controller : p2Controller;
  const activePlayerFaction = activeSide === 1 ? p1FactionId : p2FactionId;

  const activeLeader = useMemo(() => {
    return units.find((u) => u.side === activeSide && u.isLeader);
  }, [units, activeSide]);

  const isLeaderOnKeep = useMemo(() => {
    if (!activeLeader) return false;
    const cell = grid[activeLeader.y]?.[activeLeader.x];
    return cell ? isKeep(cell) : false;
  }, [activeLeader, grid]);

  // Active player economy calculations
  const activeSideVillagesCount = useMemo(() => {
    return Object.values(capturedVillages).filter((side) => side === activeSide)
      .length;
  }, [capturedVillages, activeSide]);

  const baseIncome = 2;
  const villageIncome = activeSideVillagesCount * 1;

  const activeSideUnits = useMemo(() => {
    return units.filter((u) => u.side === activeSide);
  }, [units, activeSide]);

  const activeSideTotalUnitLevel = useMemo(() => {
    return activeSideUnits
      .filter((u) => !u.isLeader)
      .reduce((sum, u) => sum + (getUnitById(u.unitTypeId)?.level ?? 0), 0);
  }, [activeSideUnits]);

  const freeUpkeep = activeSideVillagesCount;
  const activeSideUpkeep = Math.max(0, activeSideTotalUnitLevel - freeUpkeep);
  const netTurnIncome = baseIncome + villageIncome - activeSideUpkeep;

  const recruitList = useMemo(() => {
    const faction = getFactionsByEra(eraId).find(
      (f) => f.id === activePlayerFaction,
    );
    if (!faction) return [];
    return faction.recruit
      .map((id) => getUnitById(id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [eraId, activePlayerFaction]);

  const getValidRecruitTiles = useCallback(() => {
    if (!activeLeader || !isLeaderOnKeep) return [];

    const queue: { x: number; y: number }[] = [
      { x: activeLeader.x, y: activeLeader.y },
    ];
    const visited = new Set<string>();
    visited.add(`${activeLeader.x}_${activeLeader.y}`);

    const valid: { x: number; y: number }[] = [];

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) continue;
      const neighbors = getAdjacentHexes(curr.x, curr.y, cols, rows);

      for (const nb of neighbors) {
        const key = `${nb.x}_${nb.y}`;
        if (visited.has(key)) continue;

        const cell = grid[nb.y][nb.x];
        if (isCastle(cell)) {
          visited.add(key);
          queue.push(nb);

          // If unoccupied, it is a valid spawn location
          const isOccupied = units.some((u) => u.x === nb.x && u.y === nb.y);
          if (!isOccupied) {
            valid.push(nb);
          }
        }
      }
    }

    return valid;
  }, [activeLeader, isLeaderOnKeep, units, grid, cols, rows]);

  // Selected Unit Info
  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return units.find((u) => u.id === selectedUnitId) ?? null;
  }, [selectedUnitId, units]);

  const selectedUnitType = useMemo(() => {
    if (!selectedUnit) return null;
    return getUnitById(selectedUnit.unitTypeId) ?? null;
  }, [selectedUnit]);

  // Calculations for unit reachable movement range
  const reachableHexes = useMemo(() => {
    if (!selectedUnit) return {};
    const res = calculateReachableHexes(selectedUnit, units, grid);
    console.log('Reachable hexes for', selectedUnit.id, ':', res);
    return res;
  }, [selectedUnit, units, grid]);

  // Click handler for moving units or updating selection
  const handleTileClick = useCallback(
    (cIdx: number, rIdx: number) => {
      if (activeMovement) return;
      // Handle recruitment spawn if active
      if (recruitUnitTypeId) {
        const validTiles = getValidRecruitTiles();
        const isRecruitTile = validTiles.some(
          (t) => t.x === cIdx && t.y === rIdx,
        );
        if (isRecruitTile) {
          const unitType = getUnitById(recruitUnitTypeId);
          if (unitType && gold[activeSide] >= unitType.cost) {
            const newUnit: UnitState = {
              id: `unit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              unitTypeId: recruitUnitTypeId,
              side: activeSide,
              x: cIdx,
              y: rIdx,
              hitpoints: unitType.hitpoints,
              maxHitpoints: unitType.hitpoints,
              moves: 0, // Recruits spawn with 0 moves remaining
              maxMoves: unitType.movement,
              isLeader: false,
            };
            setUnits((prev) => [...prev, newUnit]);
            setGold((prev) => ({
              ...prev,
              [activeSide]: prev[activeSide] - unitType.cost,
            }));
            setRecruitUnitTypeId(null);
            return;
          }
        }
        setRecruitUnitTypeId(null);
      }

      // Find if there is a unit on this tile
      const occupant = units.find((u) => u.x === cIdx && u.y === rIdx);

      if (occupant) {
        // Selecting a unit
        setSelectedUnitId(occupant.id);
        return;
      }

      // Moving the currently selected unit
      if (
        selectedUnit &&
        selectedUnit.side === activeSide &&
        selectedUnit.moves > 0
      ) {
        const key = `${cIdx}_${rIdx}`;
        if (key in reachableHexes) {
          const remainingMoves = reachableHexes[key];

          const path = findPath(
            selectedUnit.x,
            selectedUnit.y,
            cIdx,
            rIdx,
            selectedUnit,
            units,
            grid,
          );

          if (path && path.length > 1) {
            // Capture all villages along the path
            setCapturedVillages((prev) => {
              let changed = false;
              const next = { ...prev };
              for (const pt of path) {
                const cell = grid[pt.y]?.[pt.x];
                if (cell && isVillage(cell)) {
                  const key = `${pt.x}_${pt.y}`;
                  if (next[key] !== selectedUnit.side) {
                    next[key] = selectedUnit.side;
                    changed = true;
                  }
                }
              }
              return changed ? next : prev;
            });

            setActiveMovement({
              unitId: selectedUnit.id,
              unitSide: selectedUnit.side,
              path,
              currentStepIndex: 0,
              segmentProgress: 0,
              targetMoves: remainingMoves,
            });
          } else {
            // Fallback to instant move
            setUnits((prev) =>
              prev.map((u) =>
                u.id === selectedUnit.id
                  ? { ...u, x: cIdx, y: rIdx, moves: remainingMoves }
                  : u,
              ),
            );
            const cell = grid[rIdx]?.[cIdx];
            if (cell && isVillage(cell)) {
              setCapturedVillages((prev) => ({
                ...prev,
                [`${cIdx}_${rIdx}`]: activeSide,
              }));
            }
            setSelectedUnitId(null);
          }
        } else {
          // Clicked an empty tile that is not reachable: clear selection
          setSelectedUnitId(null);
        }
      } else {
        // Clicked an empty tile: clear selection
        setSelectedUnitId(null);
      }
    },
    [
      units,
      selectedUnit,
      activeSide,
      reachableHexes,
      recruitUnitTypeId,
      getValidRecruitTiles,
      gold,
      activeMovement,
      grid,
    ],
  );

  if (loading) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center bg-background/40 backdrop-blur-sm border rounded-xl">
        <div className="text-center space-y-3">
          <div className="animate-spin size-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            Loading map and unit assets...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6 items-stretch select-none">
      {/* Canvas Area */}
      <div className="flex-1 min-h-[550px] h-[600px] lg:h-[calc(100vh-8rem)] relative rounded-xl border border-border/80 shadow-md overflow-hidden bg-zinc-950 flex flex-col">
        {/* Floating View Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 bg-zinc-900/85 backdrop-blur-md border border-border/40 p-1 rounded-xl shadow-lg z-10">
          <button
            type="button"
            onClick={zoomIn}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-foreground hover:text-emerald-400 transition-colors cursor-pointer"
            title="Zoom In"
          >
            <Plus className="size-4" />
          </button>
          <div className="text-[10px] font-bold text-center text-muted-foreground select-none px-1 border-y border-border/20 py-0.5">
            {Math.round(zoom * 100)}%
          </div>
          <button
            type="button"
            onClick={zoomOut}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-foreground hover:text-emerald-400 transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={resetView}
            className="px-1 py-1 hover:bg-zinc-800 rounded text-[8px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-center border border-border/20 mt-0.5"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: this container hosts an interactive canvas application */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="w-full flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
        >
          <Application
            resizeTo={containerRef}
            backgroundAlpha={0}
            antialias={true}
          >
            <pixiContainer x={offset.x} y={offset.y} scale={zoom}>
              {/* 1. Render Terrains */}
              {grid.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const { startPos, baseCode, overlayCode } = parseCell(cell);
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

                      {/* Captured Village Indicators */}
                      {isVillage(cell) &&
                        capturedVillages[`${cIdx}_${rIdx}`] !== undefined && (
                          <pixiGraphics
                            x={pos.x}
                            y={pos.y}
                            draw={() => {}}
                            ref={(g: Graphics | null) => {
                              if (!g) return;
                              g.clear();
                              const side = capturedVillages[`${cIdx}_${rIdx}`];
                              const teamColor =
                                side === 1 ? 0xef4444 : 0x06b6d4;

                              // Subtle hex border in team color
                              g.drawPolygon([
                                18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                              ]).stroke({
                                width: 1.5,
                                color: teamColor,
                                alpha: 0.75,
                              });

                              // Draw flag flagpole
                              g.rect(48, 12, 2.5, 24).fill({ color: 0xcccccc });

                              // Draw flag banner
                              g.moveTo(48, 12)
                                .lineTo(34, 18)
                                .lineTo(48, 24)
                                .closePath()
                                .fill({ color: teamColor })
                                .stroke({ width: 0.8, color: 0x000000 });
                            }}
                          />
                        )}

                      {startPos && (
                        <pixiText
                          text={startPos}
                          x={pos.x + 36}
                          y={pos.y + 36}
                          anchor={0.5}
                          style={{
                            fill: 0xffffff,
                            fontSize: 18,
                            fontWeight: 'bold',
                            stroke: { color: 0x000000, width: 4 },
                          }}
                        />
                      )}

                      <pixiGraphics
                        x={pos.x}
                        y={pos.y}
                        eventMode="static"
                        hitArea={HEX_HIT_AREA}
                        onPointerDown={(e: FederatedPointerEvent) => {
                          e.stopPropagation();
                          handleTileClick(cIdx, rIdx);
                        }}
                        onPointerOver={() => {
                          const name = getTerrainName(baseCode, overlayCode);
                          setHoveredHex({
                            x: cIdx,
                            y: rIdx,
                            code: cell,
                            terrainName: name,
                          });
                        }}
                        onPointerOut={() => {
                          setHoveredHex(null);
                        }}
                        draw={() => {}}
                        ref={(g: Graphics | null) => {
                          if (!g) return;
                          g.clear();
                          g.drawPolygon([
                            18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                          ])
                            .stroke({ width: 1, color: 0x555555, alpha: 0.18 })
                            .fill({ color: 0xffffff, alpha: 0.0001 });
                        }}
                      />
                    </pixiContainer>
                  );
                }),
              )}

              {/* 1.5 Render Reachable Hex Highlights (drawn after all terrains to prevent painter's algorithm overlap) */}
              {selectedUnit &&
                selectedUnit.side === activeSide &&
                selectedUnit.moves > 0 &&
                Object.keys(reachableHexes).map((key) => {
                  if (key === `${selectedUnit.x}_${selectedUnit.y}`)
                    return null;

                  const [cStr, rStr] = key.split('_');
                  const cIdx = Number.parseInt(cStr, 10);
                  const rIdx = Number.parseInt(rStr, 10);

                  // Don't highlight if occupied by another unit
                  const isOccupied = units.some(
                    (u) => u.x === cIdx && u.y === rIdx,
                  );
                  if (isOccupied) return null;

                  const pos = getHexPosition(cIdx, rIdx);
                  return (
                    <pixiGraphics
                      key={`highlight-${rIdx}-${cIdx}`}
                      x={pos.x}
                      y={pos.y}
                      eventMode="none"
                      draw={() => {}}
                      ref={(g: Graphics | null) => {
                        if (!g) return;
                        g.clear();
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ])
                          .fill({ color: 0x10b981, alpha: 0.32 })
                          .stroke({ width: 1.8, color: 0x10b981, alpha: 0.65 });
                      }}
                    />
                  );
                })}

              {/* 1.6 Render Recruit Hex Highlights */}
              {recruitUnitTypeId &&
                getValidRecruitTiles().map((tile) => {
                  const pos = getHexPosition(tile.x, tile.y);
                  return (
                    <pixiGraphics
                      key={`recruit-highlight-${tile.y}-${tile.x}`}
                      x={pos.x}
                      y={pos.y}
                      eventMode="none"
                      draw={() => {}}
                      ref={(g: Graphics | null) => {
                        if (!g) return;
                        g.clear();
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ])
                          .fill({ color: 0xf59e0b, alpha: 0.35 })
                          .stroke({ width: 1.8, color: 0xf59e0b, alpha: 0.7 });
                      }}
                    />
                  );
                })}

              {/* 2. Render Map Items */}
              {currentMap?.items?.map((item, idx) => {
                const pos = getHexPosition(item.x, item.y);
                const texture = textures[wesnothAssetUrl(item.value.image)];
                if (!texture?.source) return null;
                return (
                  <pixiSprite
                    key={`item-${idx}`}
                    texture={texture}
                    x={pos.x}
                    y={pos.y}
                    width={72}
                    height={72}
                  />
                );
              })}

              {/* 3. Render Hover Highlight */}
              {hoveredHex &&
                (() => {
                  const pos = getHexPosition(hoveredHex.x, hoveredHex.y);
                  return (
                    <pixiGraphics
                      x={pos.x}
                      y={pos.y}
                      draw={() => {}}
                      ref={(g: Graphics | null) => {
                        if (!g) return;
                        g.clear();
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ]).stroke({ width: 2, color: 0x10b981, alpha: 0.85 }); // Emerald border
                      }}
                    />
                  );
                })()}

              {/* 4. Render Team Rings and Units */}
              {units.map((unit) => {
                const unitType = getUnitById(unit.unitTypeId);
                const ringColor = unit.side === 1 ? 0xef4444 : 0x06b6d4; // Red vs Cyan
                const isSelected = selectedUnitId === unit.id;
                const isUnitActive = unit.side === activeSide && unit.moves > 0;

                // Check if this unit is currently animating movement
                const isMoving = activeMovement?.unitId === unit.id;
                let visualX: number | undefined;
                let visualY: number | undefined;

                if (isMoving && activeMovement) {
                  const path = activeMovement.path;
                  const idx = activeMovement.currentStepIndex;
                  const progress = activeMovement.segmentProgress;

                  const p0 = path[idx];
                  const p1 = path[idx + 1];

                  if (p0 && p1) {
                    const pos0 = getHexPosition(p0.x, p0.y);
                    const pos1 = getHexPosition(p1.x, p1.y);

                    visualX = pos0.x + (pos1.x - pos0.x) * progress;
                    visualY = pos0.y + (pos1.y - pos0.y) * progress;

                    // Procedural bobbing effect (sine wave)
                    const bobY = -6 * Math.sin(Math.PI * progress);
                    visualY += bobY;
                  }
                }

                return (
                  <UnitSprite
                    key={unit.id}
                    unit={unit}
                    unitType={unitType}
                    textures={textures}
                    isSelected={isSelected}
                    isUnitActive={isUnitActive && !activeMovement}
                    ringColor={ringColor}
                    animateUnits={animateUnits}
                    visualX={visualX}
                    visualY={visualY}
                    isMoving={isMoving}
                    onSelect={setSelectedUnitId}
                  />
                );
              })}

              {/* 5. Render Labels */}
              {currentMap?.labels?.map((label, idx) => {
                const pos = getHexPosition(label.x, label.y);
                return (
                  <pixiText
                    key={`label-${idx}`}
                    text={label.value.text}
                    x={pos.x + 36}
                    y={pos.y + 36}
                    anchor={0.5}
                    style={{
                      fill: 0xe2e8f0,
                      fontSize: 13,
                      fontWeight: 'bold',
                      stroke: { color: 0x000000, width: 3 },
                    }}
                  />
                );
              })}
            </pixiContainer>
          </Application>
        </div>
      </div>

      {/* Sidebar Controls and Game Info */}
      <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-sm">
        {/* Game Phase Summary */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500 flex items-center gap-1">
              <Calendar className="size-3.5" />
              Turn {turn}
            </span>
            <Badge
              className={
                activeSide === 1
                  ? 'bg-red-500 text-white font-semibold'
                  : 'bg-cyan-500 text-white font-semibold'
              }
            >
              Player {activeSide} Turn
            </Badge>
          </div>

          <div className="p-3 rounded-lg bg-zinc-950/60 border border-border/50 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Controller:</span>
              <span className="font-semibold capitalize text-foreground">
                {activePlayerController}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Faction:</span>
              <span className="font-bold text-foreground truncate max-w-[110px]">
                {activePlayerFaction}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs border-b border-border/20 pb-1.5">
              <span className="text-muted-foreground">Gold:</span>
              <span className="font-bold text-amber-500">
                {gold[activeSide]}g
              </span>
            </div>

            {/* Economy Breakdown */}
            <div className="space-y-1 bg-zinc-900/40 p-2 rounded border border-border/20 text-[11px] my-1.5">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>Villages Owned:</span>
                <span className="font-semibold text-foreground">
                  {activeSideVillagesCount}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 pl-1">
                <span>• Base Income:</span>
                <span className="text-emerald-500 font-medium">
                  +{baseIncome}g
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 pl-1">
                <span>• Village Income:</span>
                <span className="text-emerald-500 font-medium">
                  +{villageIncome}g
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground/80 pl-1">
                <span>• Unit Upkeep:</span>
                <span className="text-red-400 font-medium">
                  -{activeSideUpkeep}g
                </span>
              </div>
              <div className="text-[9px] text-muted-foreground/60 pl-2 leading-none">
                (Upkeep: {activeSideTotalUnitLevel} lvl, {freeUpkeep} free)
              </div>
              <div className="flex justify-between items-center border-t border-border/20 pt-1 mt-1 font-bold">
                <span className="text-muted-foreground">Net Turn Income:</span>
                <span
                  className={
                    netTurnIncome >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }
                >
                  {netTurnIncome >= 0 ? `+${netTurnIncome}` : netTurnIncome}g
                </span>
              </div>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Location:</span>
              <span
                className={`font-semibold ${isLeaderOnKeep ? 'text-emerald-400 font-bold' : 'text-red-400/80'}`}
              >
                {isLeaderOnKeep ? 'On Keep' : 'Not on Keep'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground">Animations:</span>
              <button
                type="button"
                onClick={() => setAnimateUnits(!animateUnits)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all cursor-pointer ${
                  animateUnits
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                    : 'border-border/40 bg-zinc-950/40 text-muted-foreground hover:text-foreground hover:bg-zinc-900'
                }`}
              >
                {animateUnits ? 'Enabled' : 'Disabled'}
              </button>
            </div>
            <div className="pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleLocateLeader(activeSide)}
                disabled={!!activeMovement}
                className="w-full text-[10px] h-7 font-bold flex items-center justify-center gap-1 cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Compass className="size-3" />
                Locate Leader
              </Button>
            </div>
          </div>

          <Button
            onClick={handleEndTurn}
            disabled={!!activeMovement}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            End Turn
          </Button>
        </div>

        <Separator className="bg-border/60" />

        {/* Selected Unit Details Panel */}
        <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Footprints className="size-3.5 text-emerald-500" />
            Selected Unit
          </h3>

          <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 flex-1 overflow-y-auto max-h-[220px] lg:max-h-none min-h-[5.5rem] flex flex-col justify-center">
            {selectedUnit && selectedUnitType ? (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                  <div className="size-10 rounded bg-zinc-900 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                    <img
                      src={wesnothAssetUrl(selectedUnitType.image)}
                      alt=""
                      className="size-8 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">
                      {selectedUnitType.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <span
                        className={
                          selectedUnit.side === 1
                            ? 'text-red-400 font-semibold'
                            : 'text-cyan-400 font-semibold'
                        }
                      >
                        Player {selectedUnit.side}
                      </span>
                      <span>•</span>
                      <span>Level {selectedUnitType.level}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Hitpoints:</span>
                    <span className="font-bold text-foreground">
                      {selectedUnit.hitpoints} / {selectedUnit.maxHitpoints}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Moves Remaining:
                    </span>
                    <span className="font-bold text-emerald-400">
                      {selectedUnit.moves} / {selectedUnit.maxMoves}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      Leader Status:
                    </span>
                    <span className="font-bold text-foreground">
                      {selectedUnit.isLeader ? 'Leader' : 'Recruit'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-muted-foreground/80 italic flex items-center justify-center gap-1.5">
                <Info className="size-3.5" />
                Select a unit on the map
              </div>
            )}
          </div>
        </div>

        {/* Recruitment Panel */}
        {isLeaderOnKeep &&
          activePlayerController === 'human' &&
          recruitList.length > 0 && (
            <>
              <Separator className="bg-border/60" />
              <div className="space-y-2 flex-1 flex flex-col min-h-0">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shrink-0">
                  <Users className="size-3.5 text-emerald-500" />
                  Recruit Unit
                </h3>
                <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-2 flex flex-col gap-1 overflow-y-auto max-h-[220px] lg:max-h-[300px] min-h-[5rem]">
                  {recruitList.map((unitType) => {
                    const canAfford = gold[activeSide] >= unitType.cost;
                    const isRecruitSelected = recruitUnitTypeId === unitType.id;

                    return (
                      <button
                        key={unitType.id}
                        type="button"
                        disabled={!canAfford || !!activeMovement}
                        onClick={() => {
                          setRecruitUnitTypeId((prev) =>
                            prev === unitType.id ? null : unitType.id,
                          );
                          setSelectedUnitId(null);
                        }}
                        className={`w-full text-left p-1.5 rounded-md border flex items-center justify-between transition-colors text-[11px] cursor-pointer ${
                          isRecruitSelected
                            ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                            : canAfford
                              ? 'border-border/40 hover:bg-zinc-800 text-foreground'
                              : 'border-border/20 opacity-45 cursor-not-allowed text-muted-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="size-6 rounded bg-zinc-900 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden">
                            <img
                              src={wesnothAssetUrl(unitType.image)}
                              alt=""
                              className="size-5 object-contain"
                            />
                          </div>
                          <div className="truncate font-medium">
                            {unitType.name}
                          </div>
                        </div>
                        <div className="font-bold text-amber-500 shrink-0 ml-1">
                          {unitType.cost}g
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        <Separator className="bg-border/60" />

        {/* Map inspector coordinates */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Maximize2 className="size-3.5 text-emerald-500" />
            Hex Inspector
          </h3>
          <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-2.5 text-center text-xs">
            {hoveredHex ? (
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground truncate max-w-[120px]">
                  {hoveredHex.terrainName}
                </span>
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] tabular-nums">
                  x={hoveredHex.x + 1}, y={hoveredHex.y + 1}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground/80 italic">
                Hover tiles to inspect
              </span>
            )}
          </div>
        </div>

        <Separator className="bg-border/60" />

        <Button
          variant="outline"
          onClick={onReset}
          disabled={!!activeMovement}
          className="w-full text-xs font-bold border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="size-3.5 mr-1" />
          Exit Simulator
        </Button>
      </aside>
    </div>
  );
}
