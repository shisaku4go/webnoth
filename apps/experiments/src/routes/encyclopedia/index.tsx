import { createFileRoute } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { RaceSidebar } from '@/components/encyclopedia/RaceSidebar';
import { UnitCard } from '@/components/encyclopedia/UnitCard';
import {
  getAllRaces,
  getAllUnits,
  getTotalUnitCount,
  getAllEras,
  getFactionsByEra,
  getFactionUnits,
} from '@/lib/wesnoth-data';

export const Route = createFileRoute('/encyclopedia/')({
  component: EncyclopediaPage,
});

function EncyclopediaPage() {
  const [selectedRace, setSelectedRace] = useState<string | null>(null);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const eras = useMemo(() => getAllEras(), []);

  const factions = useMemo(() => {
    if (selectedEra) {
      return getFactionsByEra(selectedEra);
    }
    // Get unique factions by ID across all eras
    const allFactions = getAllEras().flatMap((era) => getFactionsByEra(era.id));
    const uniqueMap = new Map<string, (typeof allFactions)[number]>();
    for (const f of allFactions) {
      if (!uniqueMap.has(f.id)) {
        uniqueMap.set(f.id, f);
      }
    }
    return Array.from(uniqueMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedEra]);

  // Compute active units matching selected Era and Faction
  const eraFactionUnits = useMemo(() => {
    if (selectedEra && selectedFaction) {
      return getFactionUnits(selectedEra, selectedFaction);
    }
    if (selectedEra) {
      const fts = getFactionsByEra(selectedEra);
      const ids = new Set<string>();
      for (const ft of fts) {
        const units = getFactionUnits(selectedEra, ft.id);
        for (const u of units) {
          ids.add(u.id);
        }
      }
      return getAllUnits().filter((u) => ids.has(u.id));
    }
    if (selectedFaction) {
      // Union of units in this faction across all eras
      const eras = getAllEras();
      const ids = new Set<string>();
      for (const era of eras) {
        const units = getFactionUnits(era.id, selectedFaction);
        for (const u of units) {
          ids.add(u.id);
        }
      }
      return getAllUnits().filter((u) => ids.has(u.id));
    }
    return getAllUnits();
  }, [selectedEra, selectedFaction]);

  // Compute races with counts dynamically based on active eraFactionUnits
  const racesWithCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const unit of eraFactionUnits) {
      counts.set(unit.race, (counts.get(unit.race) ?? 0) + 1);
    }

    return getAllRaces()
      .map((race) => ({
        id: race.id,
        pluralName: race.pluralName,
        count: counts.get(race.id) ?? 0,
      }))
      .filter((r) => r.count > 0)
      .sort((a, b) => a.pluralName.localeCompare(b.pluralName));
  }, [eraFactionUnits]);

  // Reset selected faction if it's no longer in the active factions list
  useEffect(() => {
    if (selectedFaction && !factions.some((f) => f.id === selectedFaction)) {
      setSelectedFaction(null);
    }
  }, [factions, selectedFaction]);

  // Reset selected race if it's no longer present in the filtered races list
  useEffect(() => {
    if (selectedRace && !racesWithCounts.some((r) => r.id === selectedRace)) {
      setSelectedRace(null);
    }
  }, [racesWithCounts, selectedRace]);

  const filteredUnits = useMemo(() => {
    const base = selectedRace
      ? eraFactionUnits.filter((u) => u.race === selectedRace)
      : eraFactionUnits;
    if (!searchQuery.trim()) return base;
    const lower = searchQuery.toLowerCase();
    return base.filter((u) => u.name.toLowerCase().includes(lower));
  }, [eraFactionUnits, selectedRace, searchQuery]);

  const totalCount = getTotalUnitCount();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Unit Encyclopedia</h1>
        <p className="text-muted-foreground">
          Browse all {totalCount} units from Battle for Wesnoth.
        </p>
      </div>

      {/* Era and Faction Filters Card */}
      <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card/50 p-4 backdrop-blur-md sm:grid-cols-2 lg:grid-cols-3 max-w-4xl">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="era-select"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Game Era
          </label>
          <select
            id="era-select"
            value={selectedEra ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : e.target.value;
              setSelectedEra(val);
              setSelectedFaction(null); // Reset faction when era changes
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-muted-foreground/30"
          >
            <option value="">All Eras (Global)</option>
            {eras.map((era) => (
              <option key={era.id} value={era.id}>
                {era.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="faction-select"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Faction
          </label>
          <select
            id="faction-select"
            value={selectedFaction ?? ''}
            onChange={(e) => {
              setSelectedFaction(e.target.value === '' ? null : e.target.value);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-muted-foreground/30"
          >
            <option value="">All Factions</option>
            {factions.map((faction) => (
              <option key={faction.id} value={faction.id}>
                {faction.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <label
            htmlFor="unit-search"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="unit-search"
              type="text"
              placeholder="Search units by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary hover:border-muted-foreground/30"
            />
          </div>
        </div>
      </div>

      {/* Selection Info (Description) */}
      {(selectedEra || selectedFaction) && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 max-w-4xl animate-in fade-in slide-in-from-top-2 duration-300">
          {selectedFaction
            ? (() => {
                const faction = factions.find((f) => f.id === selectedFaction);
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
                        {faction?.name} Faction
                      </span>
                      <span className="text-xs rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                        {eras.find((e) => e.id === selectedEra)?.name}
                      </span>
                    </div>
                    {faction?.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        {faction.description.trim()}
                      </p>
                    )}
                  </div>
                );
              })()
            : selectedEra &&
              (() => {
                const era = eras.find((e) => e.id === selectedEra);
                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      {era?.name} Era
                    </span>
                    {era?.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed italic">
                        {era.description.trim()}
                      </p>
                    )}
                  </div>
                );
              })()}
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 lg:block">
          <RaceSidebar
            races={racesWithCounts}
            selectedRace={selectedRace}
            totalCount={eraFactionUnits.length}
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
            <option value="">All ({eraFactionUnits.length})</option>
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
              <p className="mb-3 text-xs text-muted-foreground animate-pulse">
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
