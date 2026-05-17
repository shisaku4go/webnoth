import { cn } from '@webnoth/ui/lib/utils';
import type { WesnothUnitType } from '@webnoth/wesnoth-data';
import {
  formatTerrainName,
  getEffectiveDefense,
  getEffectiveMoveCosts,
} from '@/lib/wesnoth-data';

interface TerrainTableProps {
  unit: WesnothUnitType;
}

export function TerrainTable({ unit }: TerrainTableProps) {
  const moveCosts = getEffectiveMoveCosts(unit);
  const defense = getEffectiveDefense(unit);

  // Merge terrain keys from both move costs and defense
  const allTerrains = [
    ...new Set([...Object.keys(moveCosts), ...Object.keys(defense)]),
  ].sort();

  if (allTerrains.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" id="unit-terrain">
      <h2 className="text-lg font-semibold">Terrain</h2>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                Terrain
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Move Cost
              </th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                Defense
              </th>
            </tr>
          </thead>
          <tbody>
            {allTerrains.map((terrain) => {
              const cost = moveCosts[terrain];
              const def = defense[terrain];
              return (
                <tr
                  key={terrain}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-3 py-1.5 font-medium">
                    {formatTerrainName(terrain)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {cost !== undefined ? cost : '—'}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-1.5 text-right tabular-nums',
                      def !== undefined &&
                        def >= 50 &&
                        'text-green-600 dark:text-green-400',
                      def !== undefined &&
                        def < 30 &&
                        'text-red-600 dark:text-red-400',
                    )}
                  >
                    {def !== undefined ? `${def}%` : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground/70 italic">
        ⚠ Terrain names and icons are under development. See
        @webnoth/wesnoth-data for updates.
      </p>
    </section>
  );
}
