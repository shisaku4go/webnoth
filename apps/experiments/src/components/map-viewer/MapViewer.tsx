import { Application, extend } from '@pixi/react';
import { terrains } from '@webnoth/wesnoth-data/terrains';
import {
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { wesnothAssetUrl } from '@/lib/asset-url';

// Register Pixi elements for React
extend({ Sprite, Container, Graphics, Text });

interface MapViewerProps {
  grid: string[][];
  items?: { x: number; y: number; value: { image: string } }[];
  labels?: { x: number; y: number; value: { text: string } }[];
  onHoverHex?: (
    hex: { x: number; y: number; code: string; terrainName: string } | null,
  ) => void;
}

// Flat-topped hex coordinate math (Odd-Q Column-Staggered System)
export function getHexPosition(col: number, row: number) {
  const x = col * 54;
  const y = row * 72 + (col % 2 === 1 ? 36 : 0);
  return { x, y };
}

// Parse WML map cell (e.g. "Gs^Fms" or "2 Khr")
export function parseCell(cell: string): {
  startPos?: string;
  baseCode: string;
  overlayCode?: string;
} {
  const trimmed = cell.trim();
  const parts = trimmed.split(/\s+/);
  let terrainPart = trimmed;
  let startPos: string | undefined;

  if (parts.length > 1) {
    startPos = parts[0];
    terrainPart = parts[1];
  }

  const tParts = terrainPart.split('^');
  const baseCode = tParts[0];
  const overlayCode = tParts[1];

  return { startPos, baseCode, overlayCode };
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

export function MapViewer({ grid, items, labels, onHoverHex }: MapViewerProps) {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zoom and Offset state for Pan & Zoom
  const [zoom, setZoom] = useState(0.8);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const [hoveredHex, setHoveredHex] = useState<{
    x: number;
    y: number;
    code: string;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Calculate total map dimensions in pixels
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const mapWidth = cols > 0 ? (cols - 1) * 54 + 72 : 0;
  const mapHeight = rows > 0 ? rows * 72 + 36 : 0;

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

  // Center the map when it is loaded or grid changes
  useEffect(() => {
    if (containerRef.current && mapWidth > 0 && mapHeight > 0) {
      const rect = containerRef.current.getBoundingClientRect();
      const initialZoom = Math.min(
        1.2,
        Math.max(
          0.4,
          Math.min(
            (rect.width - 60) / mapWidth,
            (rect.height - 60) / mapHeight,
          ),
        ),
      );
      setZoom(initialZoom);
      setOffset({
        x: (rect.width - mapWidth * initialZoom) / 2,
        y: (rect.height - mapHeight * initialZoom) / 2,
      });
    }
  }, [grid, mapWidth, mapHeight]);

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

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const nextZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    const clampedZoom = Math.max(0.15, Math.min(3, nextZoom));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom towards mouse pointer
      setOffset((prev) => ({
        x: mouseX - ((mouseX - prev.x) / zoom) * clampedZoom,
        y: mouseY - ((mouseY - prev.y) / zoom) * clampedZoom,
      }));
    }
    setZoom(clampedZoom);
  };

  const resetView = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const initialZoom = Math.min(
        1.2,
        Math.max(
          0.4,
          Math.min(
            (rect.width - 60) / mapWidth,
            (rect.height - 60) / mapHeight,
          ),
        ),
      );
      setZoom(initialZoom);
      setOffset({
        x: (rect.width - mapWidth * initialZoom) / 2,
        y: (rect.height - mapHeight * initialZoom) / 2,
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
    <div className="w-full h-full flex flex-col relative select-none">
      {/* Top Toolbar controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <div className="bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground shadow-sm flex items-center gap-1.5">
          <span>Zoom: {Math.round(zoom * 100)}%</span>
        </div>
        <button
          type="button"
          onClick={resetView}
          className="bg-background/80 hover:bg-background border border-border hover:text-foreground text-muted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-all"
        >
          Reset View
        </button>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative bg-zinc-950/80 rounded-xl border border-border/80 shadow-inner"
      >
        <Application
          width={containerRef.current?.clientWidth ?? 800}
          height={containerRef.current?.clientHeight ?? 600}
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
                  ? textures[wesnothAssetUrl(`terrain/${base.symbolImage}.png`)]
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
                      interactive={true}
                      onPointerOver={() => {
                        const name = getTerrainName(baseCode, overlayCode);
                        setHoveredHex({ x: cIdx, y: rIdx, code: cell });
                        onHoverHex?.({
                          x: cIdx,
                          y: rIdx,
                          code: cell,
                          terrainName: name,
                        });
                      }}
                      onPointerOut={() => {
                        setHoveredHex(null);
                        onHoverHex?.(null);
                      }}
                      draw={(g) => {
                        g.clear();
                        g.stroke({ width: 1, color: 0x555555, alpha: 0.18 });
                        g.fill({ color: 0xffffff, alpha: 0.0001 }); // Transparent fill to enable interaction
                        // Flat-topped hex polygon bounds
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
  );
}
