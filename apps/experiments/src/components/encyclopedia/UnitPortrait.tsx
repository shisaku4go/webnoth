import type { WesnothUnitType } from '@webnoth/wesnoth-data';
import { wesnothAssetUrl } from '@/lib/asset-url';

interface UnitPortraitProps {
  unit: WesnothUnitType;
}

export function UnitPortrait({ unit }: UnitPortraitProps) {
  const portraitSrc = unit.profile;
  const spriteSrc = unit.image;

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
    </div>
  );
}
