import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { ResistanceTable } from '@/components/encyclopedia/ResistanceTable';
import { TerrainTable } from '@/components/encyclopedia/TerrainTable';
import { UnitAnimations } from '@/components/encyclopedia/UnitAnimations';
import { UnitAttacks } from '@/components/encyclopedia/UnitAttacks';
import { UnitPortrait } from '@/components/encyclopedia/UnitPortrait';
import { UnitStats } from '@/components/encyclopedia/UnitStats';
import { getUnitById } from '@/lib/wesnoth-data';

export const Route = createFileRoute('/encyclopedia/$unitId')({
  component: UnitDetailPage,
});

function UnitDetailPage() {
  const { unitId } = Route.useParams();
  const unit = getUnitById(unitId);
  const [gender, setGender] = useState<'male' | 'female'>('male');

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h1 className="text-2xl font-bold">Unit Not Found</h1>
        <p className="text-muted-foreground">
          No unit found with ID: "{unitId}"
        </p>
        <Link
          to="/encyclopedia"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          ← Back to Encyclopedia
        </Link>
      </div>
    );
  }

  const hasMaleVariant = !!unit.male;
  const hasFemaleVariant = !!unit.female;

  // If the unit ONLY has gender=female, default to female
  const possibleGenders = unit.gender || [];
  const defaultGender =
    possibleGenders.length === 1 && possibleGenders[0] === 'female'
      ? 'female'
      : 'male';

  const currentGender =
    hasMaleVariant || hasFemaleVariant ? gender : defaultGender;

  let displayedUnit = unit;
  if (currentGender === 'female' && unit.female) {
    displayedUnit = { ...unit, ...unit.female };
  } else if (currentGender === 'male' && unit.male) {
    displayedUnit = { ...unit, ...unit.male };
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        to="/encyclopedia"
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        id="back-to-encyclopedia"
      >
        <ArrowLeft className="size-4" />
        Back to Encyclopedia
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0 flex flex-col gap-4">
          <UnitPortrait unit={displayedUnit} />

          {(hasMaleVariant || hasFemaleVariant) && (
            <div className="flex bg-muted/30 p-1 rounded-md self-center">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`px-3 py-1 text-xs font-medium rounded ${gender === 'male' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ♂ Male
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`px-3 py-1 text-xs font-medium rounded ${gender === 'female' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              >
                ♀ Female
              </button>
            </div>
          )}
        </div>
        <div className="flex-1">
          <UnitStats unit={displayedUnit} />
        </div>
      </div>

      {/* Animations */}
      {displayedUnit.animations && displayedUnit.animations.length > 0 && (
        <section className="flex flex-col gap-2" id="unit-animations">
          <h2 className="text-lg font-semibold">Animations</h2>
          <UnitAnimations unit={displayedUnit} />
        </section>
      )}

      {/* Description */}
      {displayedUnit.description && (
        <section className="flex flex-col gap-2" id="unit-description">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {displayedUnit.description}
          </p>
        </section>
      )}

      {/* Attacks */}
      <UnitAttacks attacks={displayedUnit.attacks} />

      {/* Resistances */}
      <ResistanceTable unit={displayedUnit} />

      {/* Terrain */}
      <TerrainTable unit={displayedUnit} />
    </div>
  );
}
