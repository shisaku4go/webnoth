import { cn } from '@webnoth/ui/lib/utils';

interface RaceSidebarProps {
  races: Array<{ id: string; pluralName: string; count: number }>;
  selectedRace: string | null;
  totalCount: number;
  onSelectRace: (raceId: string | null) => void;
}

export function RaceSidebar({
  races,
  selectedRace,
  totalCount,
  onSelectRace,
}: RaceSidebarProps) {
  return (
    <nav
      className="flex flex-col gap-0.5"
      aria-label="Filter by race"
      id="race-sidebar"
    >
      <button
        type="button"
        onClick={() => onSelectRace(null)}
        className={cn(
          'flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors',
          selectedRace === null
            ? 'bg-primary text-primary-foreground font-medium'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <span>All</span>
        <span className="tabular-nums">{totalCount}</span>
      </button>
      {races.map((race) => (
        <button
          key={race.id}
          type="button"
          onClick={() => onSelectRace(race.id)}
          className={cn(
            'flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors',
            selectedRace === race.id
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <span>{race.pluralName}</span>
          <span className="tabular-nums">{race.count}</span>
        </button>
      ))}
    </nav>
  );
}
