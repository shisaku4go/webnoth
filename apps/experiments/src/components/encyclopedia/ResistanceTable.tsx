import { cn } from '@webnoth/ui/lib/utils';
import { getDamageTypes, getEffectiveResistance } from '@/lib/wesnoth-data';
import type { WesnothUnitType } from '@webnoth/wesnoth-data';

interface ResistanceTableProps {
  unit: WesnothUnitType;
}

export function ResistanceTable({ unit }: ResistanceTableProps) {
  const resistance = getEffectiveResistance(unit);
  const damageTypes = getDamageTypes();

  return (
    <section className="flex flex-col gap-3" id="unit-resistances">
      <h2 className="text-lg font-semibold">Resistances</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {damageTypes.map((dtype) => {
          const value = resistance[dtype];
          return (
            <div
              key={dtype}
              className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-2"
            >
              <span className="text-xs font-medium capitalize text-muted-foreground">
                {dtype}
              </span>
              <span
                className={cn(
                  'text-sm font-bold tabular-nums',
                  value > 0 && 'text-green-600 dark:text-green-400',
                  value < 0 && 'text-red-600 dark:text-red-400',
                  value === 0 && 'text-muted-foreground',
                )}
              >
                {formatResistance(value)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatResistance(value: number): string {
  if (value === 0) return '0%';
  return `${value > 0 ? '' : ''}${value}%`;
}
