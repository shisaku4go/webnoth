import { Application, extend, useTick } from '@pixi/react';
import type { WesnothUnitType } from '@webnoth/wesnoth-data';
import { sounds } from '@webnoth/wesnoth-data/sounds';
import { terrains } from '@webnoth/wesnoth-data/terrains';
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
import { useEffect, useMemo, useState } from 'react';
import {
  getHexPosition,
  getTerrainName,
  parseCell,
} from '@/components/map-viewer/MapViewer';
import { getPlayerColor } from '@/components/movement-simulator/MovementBoard';
import { wesnothAssetUrl } from '@/lib/asset-url';
import { soundManager } from '@/lib/sound-manager';
import type { TacticalUnitState } from '@/lib/tactical-puzzle/pathfinder';
import type { PuzzleStage } from '@/lib/tactical-puzzle/stages';
import { getUnitById } from '@/lib/wesnoth-data';
import type {
  CombatEffectState,
  HoveredHexState,
} from './useTacticalPuzzleState';

extend({ Sprite, Container, Graphics, Text });

const HEX_HIT_AREA = new Polygon([18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36]);

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
  }, [isAttacking]);

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

interface TacticalPuzzleHexGridProps {
  stage: PuzzleStage;
  units: TacticalUnitState[];
  selectedUnitId: string | null;
  reachableHexes: Record<string, number>;
  adjacentEnemies: TacticalUnitState[];
  combatEffect: CombatEffectState | null;
  setHoveredHex: (val: HoveredHexState | null) => void;
  handleHexClick: (cIdx: number, rIdx: number) => void;
}

export function TacticalPuzzleHexGrid({
  stage,
  units,
  selectedUnitId,
  reachableHexes,
  adjacentEnemies,
  combatEffect,
  setHoveredHex,
  handleHexClick,
}: TacticalPuzzleHexGridProps) {
  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(true);

  const grid = stage.grid;
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;

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

    // Collect sound paths to preload for the current stage
    const soundPaths = new Set<string>();
    soundPaths.add(sounds.ui.select);
    soundPaths.add(sounds.ui.click);
    soundPaths.add(sounds.miss);

    for (const uPlacement of stage.startingUnits) {
      const type = getUnitById(uPlacement.unitTypeId);
      if (type) {
        // Add attack sounds
        for (const attack of type.attacks) {
          const name = attack.name.toLowerCase();
          let attackPath = '';
          for (const [key, path] of Object.entries(sounds.attacks)) {
            if (name.includes(key)) {
              attackPath = path;
              break;
            }
          }
          if (attackPath) soundPaths.add(attackPath);
        }

        // Add hit/die sounds for the unit's race
        const race = type.race.toLowerCase();
        const hitOptions = sounds.hits[race] || sounds.hits.human;
        if (hitOptions) {
          for (const h of hitOptions) {
            soundPaths.add(h);
          }
        }
        const diePath = sounds.die[race] || sounds.die.human;
        if (diePath) soundPaths.add(diePath);
      }
    }

    const soundPathsList = Array.from(soundPaths);

    Promise.all([
      // Load image textures
      Promise.all(
        urls.map((url) =>
          Assets.load(url).catch((err) => {
            console.warn(`Failed to load texture: ${url}`, err);
            return null;
          }),
        ),
      ),
      // Preload sounds
      soundManager.preloadSounds(soundPathsList),
    ]).then(([textureResults]) => {
      if (!active) return;
      const map: Record<string, Texture> = {};
      urls.forEach((url, i) => {
        if (textureResults[i]) {
          map[url] = textureResults[i];
        }
      });
      setTextures(map);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [grid, stage.startingUnits]);

  return (
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

              {/* 1.5 Highlights (Reachable Hexes & Attack Targets) */}
              {/* Render reachable hexes in a separate pass to avoid painter's algorithm overlap from adjacent tiles */}
              {selectedUnitId &&
                Object.keys(reachableHexes).map((key) => {
                  const [cStr, rStr] = key.split('_');
                  const cIdx = Number.parseInt(cStr, 10);
                  const rIdx = Number.parseInt(rStr, 10);
                  const pos = getHexPosition(cIdx, rIdx);

                  // Don't draw highlight on the selected unit's own tile
                  const isOwnTile = units.some(
                    (u) =>
                      u.id === selectedUnitId && u.x === cIdx && u.y === rIdx,
                  );
                  if (isOwnTile) return null;

                  return (
                    <pixiGraphics
                      key={`reachable-highlight-${rIdx}-${cIdx}`}
                      x={pos.x}
                      y={pos.y}
                      eventMode="none"
                      draw={(g) => {
                        g.clear();
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ]).stroke({
                          width: 3.5,
                          color: 0x10b981,
                          alpha: 0.9,
                        });
                      }}
                    />
                  );
                })}

              {/* Render attack targets / adjacent enemies in a separate pass */}
              {selectedUnitId &&
                adjacentEnemies.map((enemy) => {
                  const pos = getHexPosition(enemy.x, enemy.y);
                  return (
                    <pixiGraphics
                      key={`target-highlight-${enemy.y}-${enemy.x}`}
                      x={pos.x}
                      y={pos.y}
                      eventMode="none"
                      draw={(g) => {
                        g.clear();
                        g.drawPolygon([
                          18, 0, 54, 0, 72, 36, 54, 72, 18, 72, 0, 36,
                        ]).stroke({
                          width: 3.5,
                          color: 0xef4444,
                          alpha: 0.95,
                        });
                      }}
                    />
                  );
                })}

              {/* 2. Combat Jiggle/Slash Effect */}
              {combatEffect && (
                <pixiGraphics
                  draw={(g) => {
                    g.clear();
                    if (combatEffect.stage === 'strike') {
                      const midX =
                        (combatEffect.attackerX + combatEffect.defenderX) / 2 +
                        36;
                      const midY =
                        (combatEffect.attackerY + combatEffect.defenderY) / 2 +
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
                          g.drawCircle(0, 0, 3).fill({ color: 0x22c55e });
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
  );
}
