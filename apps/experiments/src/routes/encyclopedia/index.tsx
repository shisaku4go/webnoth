import { createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RaceSidebar } from '@/components/encyclopedia/RaceSidebar';
import { UnitCard } from '@/components/encyclopedia/UnitCard';
import {
  getAllRaces,
  getAllUnits,
  getUnitCountByRace,
  getUnitsByRace,
  getTotalUnitCount,
  searchUnits,
} from '@/lib/wesnoth-data';

export const Route = createFileRoute('/encyclopedia/')({
  component: EncyclopediaPage,
});

function EncyclopediaPage() {
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const racesWithCounts = useMemo(() => {
    return getAllRaces()
      .map((race) => ({
        id: race.id,
        pluralName: race.pluralName,
        count: getUnitCountByRace(race.id),
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => a.pluralName.localeCompare(b.pluralName));
  }, []);

  const filteredUnits = useMemo(() => {
    const base = selectedRace ? getUnitsByRace(selectedRace) : getAllUnits();
    if (!searchQuery.trim()) return base;
    const lower = searchQuery.toLowerCase();
    return base.filter((u) => u.name.toLowerCase().includes(lower));
  }, [selectedRace, searchQuery]);

  const totalCount = getTotalUnitCount();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Unit Encyclopedia</h1>
        <p className="text-muted-foreground">
          Browse all {totalCount} units from Battle for Wesnoth.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="unit-search"
          type="text"
          placeholder="Search units by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <RaceSidebar
            races={racesWithCounts}
            selectedRace={selectedRace}
            totalCount={totalCount}
            onSelectRace={setSelectedRace}
          />
        </aside>

        {/* Mobile race select */}
        <div className="lg:hidden">
          <select
            value={selectedRace ?? ''}
            onChange={(e) =>
              setSelectedRace(e.target.value === '' ? null : e.target.value)
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">All ({totalCount})</option>
            {racesWithCounts.map((race) => (
              <option key={race.id} value={race.id}>
                {race.pluralName} ({race.count})
              </option>
            ))}
          </select>
        </div>

        {/* Unit grid */}
        <div className="flex-1">
          {filteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No units found
              </p>
              <p className="text-sm text-muted-foreground/70">
                Try a different search term or race filter.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {filteredUnits.length} unit
                {filteredUnits.length !== 1 ? 's' : ''}
              </p>
              <div
                className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
                id="unit-grid"
              >
                {filteredUnits.map((unit) => (
                  <UnitCard key={unit.id} unit={unit} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
