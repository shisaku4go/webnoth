import { useState } from 'react';
import { cn } from '@webnoth/ui/lib/utils';
import type { WesnothUnitType } from '@webnoth/wesnoth-data';
import { wesnothAssetUrl } from '@/lib/asset-url';

interface UnitPortraitProps {
  unit: WesnothUnitType;
}

type Variant = 'male' | 'female';

export function UnitPortrait({ unit }: UnitPortraitProps) {
  const hasFemale = !!unit.female;
  const [variant, setVariant] = useState<Variant>('male');

  const portraitSrc =
    variant === 'female' && unit.female?.profile
      ? unit.female.profile
      : unit.profile;

  const spriteSrc =
    variant === 'female' && unit.female?.image
      ? unit.female.image
      : unit.image;

  return (
    <div className="flex flex-col items-center gap-3" id="unit-portrait">
      {/* Portrait */}
      {portraitSrc && (
        <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
          <img
            src={wesnothAssetUrl(portraitSrc)}
            alt={`${unit.name} portrait`}
            className="h-auto w-full max-w-[200px] object-contain"
          />
        </div>
      )}

      {/* Sprite */}
      <div className="flex size-[72px] items-center justify-center rounded-md bg-muted/50">
        {spriteSrc ? (
          <img
            src={wesnothAssetUrl(spriteSrc)}
            alt={`${unit.name} sprite`}
            className="size-[72px] object-contain"
          />
        ) : null}
      </div>

      {/* Variant toggle */}
      {hasFemale && (
        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            onClick={() => setVariant('male')}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              variant === 'male'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            ♂ Male
          </button>
          <button
            type="button"
            onClick={() => setVariant('female')}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium transition-colors',
              variant === 'female'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            ♀ Female
          </button>
        </div>
      )}
    </div>
  );
}
