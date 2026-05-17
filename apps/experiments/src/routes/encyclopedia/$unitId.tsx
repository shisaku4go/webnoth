import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ResistanceTable } from '@/components/encyclopedia/ResistanceTable';
import { TerrainTable } from '@/components/encyclopedia/TerrainTable';
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

      {/* Header: Portrait + Stats */}
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0">
          <UnitPortrait unit={unit} />
        </div>
        <div className="flex-1">
          <UnitStats unit={unit} />
        </div>
      </div>

      {/* Description */}
      {unit.description && (
        <section className="flex flex-col gap-2" id="unit-description">
          <h2 className="text-lg font-semibold">Description</h2>
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
            {unit.description}
          </p>
        </section>
      )}

      {/* Attacks */}
      <UnitAttacks attacks={unit.attacks} />

      {/* Resistances */}
      <ResistanceTable unit={unit} />

      {/* Terrain */}
      <TerrainTable unit={unit} />
    </div>
  );
}
