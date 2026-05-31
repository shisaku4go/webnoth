import { Application, extend } from '@pixi/react';
import { Badge } from '@webnoth/ui/components/badge';
import { ScrollArea } from '@webnoth/ui/components/scroll-area';
import { Separator } from '@webnoth/ui/components/separator';
import { terrains } from '@webnoth/wesnoth-data/terrains';
import { BookOpen, Flag, Info, Maximize2, Minus, Plus } from 'lucide-react';
import {
  Assets,
  Container,
  Graphics,
  Polygon,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { wesnothAssetUrl } from '@/lib/asset-url';

import { parseCell } from '@/lib/tactical-puzzle/pathfinder';

export { parseCell };

// Register Pixi elements for React
extend({ Sprite, Container, Graphics, Text });

interface MapViewerProps {
  grid: string[][];
  items?: { x: number; y: number; value: { image: string } }[];
  labels?: { x: number; y: number; value: { text: string } }[];
  name: string;
  campaignName: string;
}

// Flat-topped hex coordinate math (Odd-Q Column-Staggered System)
export function getHexPosition(col: number, row: number) {
  const x = col * 54;
  const y = row * 72 + (col % 2 === 1 ? 36 : 0);
  return { x, y };
}

// Get human readable name of a terrain code
export function getTerrainName(baseCode: string, overlayCode?: string): string {
  const base = terrains.find((t) => t.code === baseCode);
  const overlay = overlayCode
    ? terrains.find((t) => t.code === `^${overlayCode}`)
    : undefined;

  const baseName = base?.name ?? baseCode;
  const overlayName = overlay?.name;

  if (overlayName) {
    return `${baseName} (${overlayName})`;
  }
  return baseName;
}

const HEX_HIT_AREA = new Polygon([18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36]);

export function MapViewer({
  grid,
  items,
  labels,
  name,
  campaignName,
}: MapViewerProps) {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);

  // Zoom and Offset state for Pan & Zoom
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [inputValue, setInputValue] = useState(String(Math.round(zoom * 100)));
  const [hoveredHex, setHoveredHex] = useState<{
    x: number;
    y: number;
    code: string;
    terrainName: string;
  } | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input value with zoom level changes
  useEffect(() => {
    setInputValue(String(Math.round(zoom * 100)));
  }, [zoom]);

  // Track container size dynamically to keep Pixi stage sized correctly
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

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Calculate total map dimensions in pixels
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

  // Find bounding box of actual visible terrain cells (excluding void/off-map cells like _off^_usr)
  const activeBounds = useMemo(() => {
    let minCol = Number.MAX_SAFE_INTEGER;
    let maxCol = Number.MIN_SAFE_INTEGER;
    let minRow = Number.MAX_SAFE_INTEGER;
    let maxRow = Number.MIN_SAFE_INTEGER;
    let hasVisibleTiles = false;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const { baseCode } = parseCell(grid[r][c]);
        // Ignore off-map void tiles (e.g. "_off^_usr", "_off", or empty)
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
    const maxY = maxRow * 72 + 108; // Account for vertical stagger on odd columns and 72px height

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

  // Calculate starting positions from grid
  const startingPositions = useMemo(() => {
    const list: { id: string; x: number; y: number }[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const { startPos } = parseCell(grid[r][c]);
        if (startPos) {
          list.push({ id: startPos, x: c + 1, y: r + 1 });
        }
      }
    }
    return list.sort((a, b) =>
      a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }, [grid]);

  // Extract unique terrains used in the map
  const usedTerrains = useMemo(() => {
    const codes = new Set<string>();
    for (const row of grid) {
      for (const cell of row) {
        const { baseCode, overlayCode } = parseCell(cell);
        codes.add(baseCode);
        if (overlayCode) {
          codes.add(`^${overlayCode}`);
        }
      }
    }
    const list = terrains.filter((t) => codes.has(t.code));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [grid]);

  // 1. Pre-load all textures needed for this specific map
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

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

    if (items) {
      for (const item of items) {
        if (item.value?.image) {
          imageUrls.add(wesnothAssetUrl(item.value.image));
        }
      }
    }

    const urls = Array.from(imageUrls);

    if (urls.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      urls.map((url) =>
        Assets.load(url).catch((err) => {
          console.warn(`Failed to load map texture: ${url}`, err);
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
  }, [grid, items]);

  // Center the map when it is loaded, grid changes, or container dimensions change
  useEffect(() => {
    if (
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      activeWidth > 0 &&
      activeHeight > 0
    ) {
      const initialZoom = Math.min(
        1.2,
        Math.max(
          0.4,
          Math.min(
            (dimensions.width - 60) / activeWidth,
            (dimensions.height - 60) / activeHeight,
          ),
        ),
      );
      setZoom(initialZoom);
      setOffset({
        x: dimensions.width / 2 - centerX * initialZoom,
        y: dimensions.height / 2 - centerY * initialZoom,
      });
    }
  }, [
    activeWidth,
    activeHeight,
    centerX,
    centerY,
    dimensions.width,
    dimensions.height,
  ]);

  // 2. Event Handlers for Zoom and Drag on the DOM Container
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const changeZoomCentrally = (nextZoom: number) => {
    const clampedZoom = Math.max(0.15, Math.min(3.0, nextZoom));
    if (
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      activeWidth > 0 &&
      activeHeight > 0
    ) {
      const prevAppWidth = Math.min(dimensions.width, activeWidth * zoom);
      const prevAppHeight = Math.min(dimensions.height, activeHeight * zoom);
      const nextAppWidth = Math.min(
        dimensions.width,
        activeWidth * clampedZoom,
      );
      const nextAppHeight = Math.min(
        dimensions.height,
        activeHeight * clampedZoom,
      );

      const viewportCenterX = prevAppWidth / 2;
      const viewportCenterY = prevAppHeight / 2;
      const nextViewportCenterX = nextAppWidth / 2;
      const nextViewportCenterY = nextAppHeight / 2;

      setOffset((prev) => ({
        x:
          nextViewportCenterX -
          ((viewportCenterX - prev.x) / zoom) * clampedZoom,
        y:
          nextViewportCenterY -
          ((viewportCenterY - prev.y) / zoom) * clampedZoom,
      }));
    }
    setZoom(clampedZoom);
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyManualZoom();
    }
  };

  const handleInputBlur = () => {
    applyManualZoom();
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

  const resetView = () => {
    if (
      dimensions.width > 0 &&
      dimensions.height > 0 &&
      activeWidth > 0 &&
      activeHeight > 0
    ) {
      const initialZoom = Math.min(
        1.2,
        Math.max(
          0.4,
          Math.min(
            (dimensions.width - 60) / activeWidth,
            (dimensions.height - 60) / activeHeight,
          ),
        ),
      );
      setZoom(initialZoom);
      setOffset({
        x: dimensions.width / 2 - centerX * initialZoom,
        y: dimensions.height / 2 - centerY * initialZoom,
      });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/40 backdrop-blur-sm border rounded-xl">
        <div className="text-center space-y-3">
          <div className="animate-spin size-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            Loading map assets...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 flex flex-col lg:flex-row gap-6 items-stretch select-none">
      {/* Left Canvas Area container (Takes 100% width other than right sidebar) */}
      <div className="flex-1 min-h-[500px] h-[550px] lg:h-[calc(100vh-14rem)] relative rounded-xl border border-border/80 shadow-md overflow-hidden bg-zinc-950 flex flex-col">
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
              {/* 1. Base and Overlay Terrains */}
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
                      {/* Base Tile */}
                      {baseTexture?.source && (
                        <pixiSprite
                          texture={baseTexture}
                          x={pos.x}
                          y={pos.y}
                          width={72}
                          height={72}
                        />
                      )}

                      {/* Overlay Tile */}
                      {overlayTexture?.source && (
                        <pixiSprite
                          texture={overlayTexture}
                          x={pos.x}
                          y={pos.y}
                          width={72}
                          height={72}
                        />
                      )}

                      {/* Starting Position Badge */}
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

                      {/* Grid border / Hover trigger Graphics */}
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
                        onPointerOut={() => {
                          setHoveredHex(null);
                        }}
                        draw={(g) => {
                          g.clear();
                          g.stroke({ width: 1, color: 0x555555, alpha: 0.18 });
                          g.fill({ color: 0xffffff, alpha: 0.0001 }); // Transparent fill to enable interaction
                          g.drawPolygon([
                            18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                          ]);
                        }}
                      />
                    </pixiContainer>
                  );
                }),
              )}

              {/* 2. Scenario items */}
              {items?.map((item, idx) => {
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

              {/* 3. Hover Hex Highlight Overlay */}
              {hoveredHex &&
                (() => {
                  const pos = getHexPosition(hoveredHex.x, hoveredHex.y);
                  return (
                    <pixiGraphics
                      x={pos.x}
                      y={pos.y}
                      draw={(g) => {
                        g.clear();
                        g.stroke({ width: 2, color: 0xeab308, alpha: 0.85 }); // Yellow border
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ]);
                      }}
                    />
                  );
                })()}

              {/* 4. Text labels */}
              {labels?.map((label, idx) => {
                const pos = getHexPosition(label.x, label.y);
                return (
                  <pixiText
                    key={`label-${idx}`}
                    text={label.value.text}
                    x={pos.x + 36}
                    y={pos.y + 36}
                    anchor={0.5}
                    style={{
                      fill: 0xfef08a, // Soft yellow
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

      {/* Right Info & Legend Sidebar */}
      <aside className="w-full lg:w-72 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-sm">
        {/* Map Info & View Controls */}
        <div className="space-y-3">
          <div className="space-y-0.5">
            <span className="text-[9px] uppercase font-extrabold tracking-wider text-amber-500 block">
              {campaignName}
            </span>
            <h2 className="text-lg font-bold tracking-tight text-foreground leading-tight">
              {name}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            <Badge
              variant="outline"
              className="text-[10px] font-medium py-0.5 px-2 bg-muted/30 border-border/40"
            >
              Size: {cols} × {rows}
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] font-medium py-0.5 px-2 bg-muted/30 border-border/40"
            >
              Starts: {startingPositions.length}
            </Badge>
          </div>

          {/* Integrated Zoom & Reset controls */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex bg-muted/40 p-0.5 rounded-lg border border-border/30 items-center gap-1 text-xs font-semibold text-muted-foreground shadow-sm flex-1 justify-between">
              <button
                type="button"
                onClick={zoomOut}
                className="hover:bg-accent hover:text-foreground p-1 rounded transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <Minus className="size-3.5" />
              </button>
              <div className="flex items-center gap-0.5 px-1 bg-muted/50 rounded border border-border/50 text-[11px] font-bold">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  onBlur={handleInputBlur}
                  className="w-8 text-center bg-transparent border-none outline-none focus:ring-0 text-foreground font-semibold text-xs p-0"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              <button
                type="button"
                onClick={zoomIn}
                className="hover:bg-accent hover:text-foreground p-1 rounded transition-colors cursor-pointer"
                title="Zoom In"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={resetView}
              className="bg-background hover:bg-muted border border-border hover:text-foreground text-muted-foreground text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer text-center"
            >
              Reset
            </button>
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* 1. Hex Inspector Panel */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Maximize2 className="size-3.5 text-amber-500" />
            Tile Inspector
          </h3>
          <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[5.5rem] flex flex-col justify-center">
            {hoveredHex ? (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold">
                  <span>Coordinates (WML)</span>
                  <span className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono tabular-nums">
                    x={hoveredHex.x + 1}, y={hoveredHex.y + 1}
                  </span>
                </div>
                <div className="text-xs font-bold text-foreground">
                  {hoveredHex.terrainName}
                </div>
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Raw Code</span>
                  <span className="font-mono bg-muted/30 px-1 py-0.2 rounded text-muted-foreground select-all">
                    {hoveredHex.code}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-muted-foreground/80 italic flex items-center justify-center gap-1.5">
                <Info className="size-3.5" />
                Hover map tiles to inspect
              </div>
            )}
          </div>
        </div>

        <Separator className="bg-border/60" />

        {/* 2. Starting Positions Panel */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Flag className="size-3.5 text-amber-500" />
            Starting Positions
          </h3>
          <ScrollArea className="max-h-36 pr-1">
            {startingPositions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No starting positions defined on this map.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {startingPositions.map((pos) => (
                  <div
                    key={`start-${pos.id}`}
                    className="flex items-center justify-between gap-1.5 bg-muted/30 border border-border/30 rounded px-2 py-1 text-[11px] font-medium"
                  >
                    <span className="text-amber-500 font-bold shrink-0">
                      Player {pos.id}
                    </span>
                    <span className="text-muted-foreground font-mono tabular-nums text-[10px]">
                      ({pos.x}, {pos.y})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <Separator className="bg-border/60" />

        {/* 3. Terrain Legend Panel */}
        <div className="space-y-2 flex-1 flex flex-col min-h-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 shrink-0">
            <BookOpen className="size-3.5 text-amber-500" />
            Terrain Legend ({usedTerrains.length})
          </h3>
          <ScrollArea className="flex-1 pr-1 max-h-[300px] lg:max-h-[calc(100vh-28rem)]">
            {usedTerrains.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No terrains found.
              </p>
            ) : (
              <div className="space-y-1.5">
                {usedTerrains.map((terrain) => (
                  <div
                    key={`legend-${terrain.code}`}
                    className="flex items-center gap-2 bg-muted/20 hover:bg-muted/40 border border-border/20 rounded-md p-1.5 transition-colors"
                  >
                    <div className="size-8 rounded bg-zinc-900 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden relative">
                      {terrain.symbolImage ? (
                        <img
                          src={wesnothAssetUrl(
                            `terrain/${terrain.symbolImage}.png`,
                          )}
                          alt=""
                          className="size-7 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="size-full bg-muted/40" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold text-foreground truncate leading-tight">
                        {terrain.name}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1 rounded">
                          {terrain.code}
                        </span>
                        {terrain.editorGroup &&
                          terrain.editorGroup.length > 0 && (
                            <span className="text-[8px] text-amber-500 font-semibold uppercase tracking-wider">
                              {terrain.editorGroup[0]}
                            </span>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </aside>
    </div>
  );
}
