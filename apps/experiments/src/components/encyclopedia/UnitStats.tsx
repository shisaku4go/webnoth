import { Link } from '@tanstack/react-router';
import type { WesnothUnitType } from '@/lib/wesnoth-data';
import { getRaceById } from '@/lib/wesnoth-data';

interface UnitStatsProps {
  unit: WesnothUnitType;
}

export function UnitStats({ unit }: UnitStatsProps) {
  const race = getRaceById(unit.race);
  const validAdvancesTo = unit.advancesTo.filter((id) => id !== 'null');

  return (
    <div className="flex flex-col gap-3" id="unit-stats">
      <h1 className="text-2xl font-bold tracking-tight">{unit.name}</h1>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Race</dt>
          <dd className="font-medium">{race?.pluralName ?? unit.race}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Level</dt>
          <dd className="font-medium">{unit.level}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">HP</dt>
          <dd className="font-medium">{unit.hitpoints}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">XP</dt>
          <dd className="font-medium">{unit.experience}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Movement</dt>
          <dd className="font-medium">{unit.movement}</dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground">Cost</dt>
          <dd className="font-medium">{unit.cost}</dd>
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <dt className="text-muted-foreground">Alignment</dt>
          <dd className="font-medium capitalize">{unit.alignment}</dd>
        </div>
      </dl>

      {unit.abilities && unit.abilities.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Abilities
          </span>
          <div className="flex flex-wrap gap-1.5">
            {unit.abilities.map((ability) => (
              <span
                key={ability}
                className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
              >
                {ability}
              </span>
            ))}
          </div>
        </div>
      )}

      {validAdvancesTo.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Advances To
          </span>
          <div className="flex flex-wrap gap-1.5">
            {validAdvancesTo.map((id) => (
              <Link
                key={id}
                to="/encyclopedia/$unitId"
                params={{ unitId: id }}
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                {id}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Advances From
        </span>
        <p className="text-xs text-muted-foreground/70 italic">
          ⚠ In development — see @webnoth/wesnoth-data
        </p>
      </div>
    </div>
  );
}
