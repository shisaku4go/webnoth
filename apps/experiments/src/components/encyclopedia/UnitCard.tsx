import { Link } from '@tanstack/react-router';
import { wesnothAssetUrl } from '@/lib/asset-url';
import type { WesnothUnitType } from '@/lib/wesnoth-data';

interface UnitCardProps {
  unit: WesnothUnitType;
}

export function UnitCard({ unit }: UnitCardProps) {
  return (
    <Link
      to="/encyclopedia/$unitId"
      params={{ unitId: unit.id }}
      className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/40 hover:bg-accent/50 hover:shadow-md"
      id={`unit-card-${unit.id.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="relative flex size-[72px] items-center justify-center overflow-hidden rounded-md bg-muted/50">
        {unit.image ? (
          <img
            src={wesnothAssetUrl(unit.image)}
            alt={unit.name}
            className="size-[72px] object-contain transition-transform group-hover:scale-110"
            loading="lazy"
          />
        ) : null}
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="text-sm font-medium leading-tight text-foreground">
          {unit.name}
        </span>
        <span className="text-xs text-muted-foreground">Lv. {unit.level}</span>
      </div>
    </Link>
  );
}
