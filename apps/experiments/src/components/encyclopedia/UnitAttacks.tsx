import type { WesnothAttack } from '@webnoth/wesnoth-data';
import { wesnothAssetUrl } from '@/lib/asset-url';

interface UnitAttacksProps {
  attacks: WesnothAttack[];
}

export function UnitAttacks({ attacks }: UnitAttacksProps) {
  if (attacks.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" id="unit-attacks">
      <h2 className="text-lg font-semibold">Attacks</h2>
      <div className="flex flex-col gap-2">
        {attacks.map((attack) => (
          <div
            key={`${attack.name}-${attack.type}-${attack.range}`}
            className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {attack.icon && (
                  <img
                    src={wesnothAssetUrl(attack.icon)}
                    alt=""
                    className="size-6 object-contain"
                  />
                )}
                <span className="font-medium">{attack.description}</span>
                <span className="text-xs text-muted-foreground">
                  {attack.type} · {attack.range}
                </span>
              </div>
              <div className="text-sm font-medium tabular-nums">
                {attack.damage} × {attack.number} ={' '}
                <span className="text-primary">
                  {attack.damage * attack.number}
                </span>
              </div>
            </div>
            {attack.specials && attack.specials.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attack.specials.map((special) => (
                  <span
                    key={special}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                  >
                    {special}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
