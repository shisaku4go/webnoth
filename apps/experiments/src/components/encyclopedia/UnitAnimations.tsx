import { Application, extend, useTick } from '@pixi/react';
import type {
  WesnothAnimationFrame,
  WesnothUnitType,
} from '@webnoth/wesnoth-data';
import { Assets, Container, Sprite, type Texture } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { wesnothAssetUrl } from '@/lib/asset-url';

// Register Pixi elements for React
extend({ Sprite, Container });

interface UnitAnimationsProps {
  unit: WesnothUnitType;
}

export function UnitAnimations({ unit }: UnitAnimationsProps) {
  const animations = unit.animations || [];

  const [selectedAnimIndex, setSelectedAnimIndex] = useState(0);
  const selectedAnim = animations[selectedAnimIndex];

  const frames = selectedAnim?.frames || [];

  const [textures, setTextures] = useState<Record<string, Texture>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current URLs to avoid unloading textures that are still needed
  const currentUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    if (frames.length === 0) return;

    setLoading(true);
    setError(null);
    const urls = Array.from(
      new Set(frames.map((f) => wesnothAssetUrl(f.image))),
    );
    currentUrlsRef.current = urls;

    // Load all textures
    Promise.all(
      urls.map((url) =>
        Assets.load(url).catch((err) => {
          console.error(`Failed to load texture: ${url}`, err);
          return null;
        }),
      ),
    ).then((results) => {
      if (!active) return;

      const map: Record<string, Texture> = {};
      let hasError = false;

      urls.forEach((u, i) => {
        if (results[i]) {
          map[u] = results[i];
        } else {
          hasError = true;
        }
      });

      setTextures(map);
      setLoading(false);
      if (hasError && Object.keys(map).length === 0) {
        setError('Failed to load animation textures.');
      }
    });

    return () => {
      active = false;
      // We don't unload immediately here to prevent errors when switching animations.
      // PixiJS Assets cache handles de-duplication.
      // In a real app, we might want a global cache manager or unload after a delay.
    };
  }, [frames]);

  if (animations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap">
        {animations.map((anim, idx) => {
          const label = anim.filterAttack
            ? `${anim.type} (${anim.filterAttack})`
            : anim.type;

          return (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: static animation list
              key={`${anim.type}-${anim.filterAttack || 'default'}-${idx}`}
              type="button"
              onClick={() => setSelectedAnimIndex(idx)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                idx === selectedAnimIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/30 text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-lg overflow-hidden border border-border bg-muted/20 flex justify-center items-center relative"
        style={{ width: '100%', height: 300 }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <span className="text-sm font-medium">Loading Textures...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10 px-4 text-center">
            <span className="text-sm font-medium text-destructive">
              {error}
            </span>
          </div>
        )}
        <Application
          backgroundAlpha={0}
          width={400}
          height={300}
          antialias={true}
        >
          <Animator
            frames={frames}
            textures={textures}
            isPlaying={!loading && !error}
          />
        </Application>
      </div>
    </div>
  );
}

function Animator({
  frames,
  textures,
  isPlaying,
}: {
  frames: WesnothAnimationFrame[];
  textures: Record<string, Texture>;
  isPlaying: boolean;
}) {
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [_elapsed, setElapsed] = useState(0);

  // Reset when frames change
  useEffect(() => {
    setCurrentFrameIdx(0);
    setElapsed(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useTick((ticker) => {
    if (!isPlaying || frames.length === 0) return;

    setElapsed((prev) => {
      const nextElapsed = prev + ticker.deltaMS;

      const currentFrame = frames[currentFrameIdx];
      const duration = currentFrame?.duration || 100;

      if (nextElapsed > duration) {
        setCurrentFrameIdx((currentIdx) => (currentIdx + 1) % frames.length);
        return 0; // Reset elapsed for the next frame
      }
      return nextElapsed;
    });
  });

  if (frames.length === 0) return null;

  // Guard against out-of-bounds index
  const safeFrameIdx = currentFrameIdx < frames.length ? currentFrameIdx : 0;
  const frame = frames[safeFrameIdx];

  if (!frame?.image) return null;

  const url = wesnothAssetUrl(frame.image);
  const texture = textures[url];

  // If the texture isn't ready, don't try to render it.
  // PixiJS v8 errors out if a sprite has a null texture or an invalid source.
  if (!texture?.source) return null;

  // Determine scale to fit height nicely
  const targetHeight = 250;
  const scale = Math.min(2.0, targetHeight / texture.height);

  return (
    <pixiSprite texture={texture} x={200} y={150} anchor={0.5} scale={scale} />
  );
}
