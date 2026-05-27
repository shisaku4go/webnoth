import { createFileRoute, Link } from '@tanstack/react-router';
import { Badge } from '@webnoth/ui/components/badge';
import { Button } from '@webnoth/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@webnoth/ui/components/card';
import { multiplayerMaps } from '@webnoth/wesnoth-data/multiplayer';
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  Footprints,
  Map as MapIcon,
  Play,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { parseCell } from '@/components/map-viewer/MapViewer';
import {
  getPlayerColor,
  MovementBoard,
  type PlayerConfig,
} from '@/components/movement-simulator/MovementBoard';
import {
  getAllEras,
  getFactionsByEra,
  getFactionUnits,
  getUnitById,
} from '@/lib/wesnoth-data';

export const Route = createFileRoute('/unit-movement-simulator')({
  component: UnitMovementSimulatorPage,
});

type StepType = 'mode' | 'map' | 'config' | 'simulating';

function getMapStartsCount(m: (typeof multiplayerMaps)[number]): number {
  let startsCount = 0;
  for (let r = 0; r < m.grid.length; r++) {
    for (let c = 0; c < m.grid[r].length; c++) {
      const { startPos } = parseCell(m.grid[r][c]);
      if (startPos) startsCount++;
    }
  }
  return startsCount;
}

function UnitMovementSimulatorPage() {
  const [step, setStep] = useState<StepType>('mode');
  const [_mode, setMode] = useState<'campaign' | 'multiplayer' | null>(null);
  const [eraId, setEraId] = useState<string>('era_default');

  // Dynamic players configuration
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>([]);

  // Map Setup
  const [selectedMapId, setSelectedMapId] = useState<string>('');

  const eras = useMemo(() => getAllEras(), []);

  // Filter factions based on Era
  const factions = useMemo(() => {
    return getFactionsByEra(eraId);
  }, [eraId]);

  // Check if a Faction contains any Skirmisher units (recruit or leader)
  const factionSkirmisherStatus = useMemo(() => {
    const status: Record<
      string,
      { hasSkirmisher: boolean; unitName?: string }
    > = {};
    for (const faction of factions) {
      const units = getFactionUnits(eraId, faction.id);
      const skirmisherUnit = units.find((u) =>
        u.abilities?.includes('skirmisher'),
      );
      status[faction.id] = {
        hasSkirmisher: !!skirmisherUnit,
        unitName: skirmisherUnit?.name,
      };
    }
    return status;
  }, [factions, eraId]);

  // Get available leaders for a selected faction
  const getLeadersForFaction = (factionId: string) => {
    const faction = factions.find((f) => f.id === factionId);
    if (!faction) return [];
    return faction.leader
      .map((id) => getUnitById(id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  };

  // Filter multiplayer maps to any with 2 or more players
  const selectableMaps = useMemo(() => {
    return multiplayerMaps.filter((m) => {
      const startsCount = getMapStartsCount(m);
      return startsCount >= 2;
    });
  }, []);

  const _selectedMap = useMemo(() => {
    return multiplayerMaps.find((m) => m.id === selectedMapId);
  }, [selectedMapId]);

  // Initialize player configs for N players on a selected map
  const initializePlayerConfigs = (mapId: string, currentEraId: string) => {
    const map = multiplayerMaps.find((m) => m.id === mapId);
    if (!map) return;

    const startsCount = getMapStartsCount(map);
    const availableFactions = getFactionsByEra(currentEraId);
    if (availableFactions.length === 0) return;

    const newConfigs: PlayerConfig[] = [];
    for (let i = 1; i <= startsCount; i++) {
      const factionIndex = (i - 1) % availableFactions.length;
      const faction = availableFactions[factionIndex];
      const leaders = faction.leader;
      const defaultLeader = leaders.length > 0 ? leaders[0] : '';
      newConfigs.push({
        side: i,
        factionId: faction.id,
        leaderId: defaultLeader,
        controller: 'human',
        teamId: i,
      });
    }
    setPlayerConfigs(newConfigs);
  };

  const handleEraChange = (nextEraId: string) => {
    setEraId(nextEraId);
    if (selectedMapId) {
      initializePlayerConfigs(selectedMapId, nextEraId);
    }
  };

  const handlePlayerFactionChange = (side: number, factionId: string) => {
    const availableFactions = getFactionsByEra(eraId);
    const faction = availableFactions.find((f) => f.id === factionId);
    const leaders = faction ? faction.leader : [];
    const defaultLeader = leaders.length > 0 ? leaders[0] : '';

    setPlayerConfigs((prev) =>
      prev.map((c) =>
        c.side === side ? { ...c, factionId, leaderId: defaultLeader } : c,
      ),
    );
  };

  const handlePlayerLeaderChange = (side: number, leaderId: string) => {
    setPlayerConfigs((prev) =>
      prev.map((c) => (c.side === side ? { ...c, leaderId } : c)),
    );
  };

  const handlePlayerControllerChange = (
    side: number,
    controller: 'human' | 'none',
  ) => {
    setPlayerConfigs((prev) =>
      prev.map((c) => (c.side === side ? { ...c, controller } : c)),
    );
  };

  const handlePlayerTeamChange = (side: number, teamId: number) => {
    setPlayerConfigs((prev) =>
      prev.map((c) => (c.side === side ? { ...c, teamId } : c)),
    );
  };

  const handleMapSelect = (mapId: string) => {
    setSelectedMapId(mapId);
    initializePlayerConfigs(mapId, eraId);
  };

  const handleModeSelect = (selectedMode: 'campaign' | 'multiplayer') => {
    if (selectedMode === 'campaign') return; // Under development
    setMode(selectedMode);
    setStep('map');
  };

  const handleStartSimulation = () => {
    setStep('simulating');
  };

  const resetAll = () => {
    setStep('mode');
    setMode(null);
    setSelectedMapId('');
    setPlayerConfigs([]);
  };

  const isConfigValid = useMemo(() => {
    if (playerConfigs.length === 0) return false;
    return playerConfigs.every((c) => c.factionId && c.leaderId);
  }, [playerConfigs]);

  return (
    <div
      className={`space-y-6 mx-auto py-4 ${step === 'simulating' ? 'max-w-7xl px-4' : 'max-w-4xl px-2'}`}
    >
      {/* Header / Breadcrumbs */}
      <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
        {step !== 'mode' && (
          <button
            type="button"
            onClick={() => {
              if (step === 'map') setStep('mode');
              else if (step === 'config') setStep('map');
              else if (step === 'simulating') setStep('config');
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 cursor-pointer bg-transparent border-0 p-0 w-fit"
          >
            <ArrowLeft className="size-3" />
            Back
          </button>
        )}
        {step === 'mode' && (
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
          >
            <ArrowLeft className="size-3" />
            Back to Dashboard
          </Link>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2.5">
          <Footprints className="size-8 text-emerald-500" />
          Unit Movement Simulator
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure game parameters and simulate real-time battlefield movement
          logic.
        </p>
      </div>

      {/* Mode Selection Screen */}
      {step === 'mode' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
          <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden flex flex-col justify-between opacity-60">
            <CardHeader className="pb-4">
              <div className="size-12 rounded-lg bg-muted border border-border flex items-center justify-center mb-4 text-muted-foreground">
                <Compass className="size-6" />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold">
                  Campaign Mode
                </CardTitle>
                <Badge
                  variant="secondary"
                  className="text-[9px] font-semibold bg-muted text-muted-foreground"
                >
                  Under Dev
                </Badge>
              </div>
              <CardDescription className="text-sm mt-1.5 leading-relaxed">
                Play custom scenario campaigns recreating story paths.
                (Currently unavailable for movement simulation testing).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button disabled className="w-full font-bold cursor-not-allowed">
                Under Development
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/40 backdrop-blur-md overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all duration-200 group">
            <CardHeader className="pb-4">
              <div className="size-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 text-emerald-500 group-hover:scale-110 transition-transform duration-200">
                <Users className="size-6" />
              </div>
              <CardTitle className="text-xl font-bold">
                Multiplayer Mode
              </CardTitle>
              <CardDescription className="text-sm mt-1.5 leading-relaxed">
                Configure sides, select from balanced multiplayer maps, and
                verify movement rules and Zone of Control (ZOC).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Button
                onClick={() => handleModeSelect('multiplayer')}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer transition-colors duration-200"
              >
                Configure Setup
                <ChevronRight className="size-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Map Selection Screen */}
      {step === 'map' && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-md p-6 space-y-6 animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Select a Map
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
              >
                {selectableMaps.length} Maps Available
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto pr-1">
              {selectableMaps.map((m) => {
                const startsCount = getMapStartsCount(m);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMapSelect(m.id)}
                    className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between h-[120px] ${
                      selectedMapId === m.id
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md'
                        : 'border-border/40 bg-zinc-950/20 hover:border-border/80'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="font-bold text-sm text-foreground truncate">
                        {m.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        ID: {m.id}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <MapIcon className="size-3.5" />
                        Size: {m.width} × {m.height}
                      </span>
                      <span className="bg-zinc-900 px-2 py-0.5 rounded border border-border/20">
                        {startsCount} Players
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setStep('config')}
              disabled={!selectedMapId}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Configure Era & Players
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Era & Player Configuration Screen */}
      {step === 'config' && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-md p-6 space-y-6 animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="era-select"
                className="text-xs font-bold text-emerald-500 uppercase tracking-wider"
              >
                Select Era
              </label>
              <select
                id="era-select"
                value={eraId}
                onChange={(e) => handleEraChange(e.target.value)}
                className="w-full rounded-md border border-border bg-zinc-900/60 px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {eras.map((era) => (
                  <option key={era.id} value={era.id}>
                    {era.name} - {era.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {playerConfigs.map((cfg) => {
                const playerColor = getPlayerColor(cfg.side);
                const leaders = getLeadersForFaction(cfg.factionId);
                return (
                  <div
                    key={cfg.side}
                    className="space-y-4 p-4 rounded-lg bg-zinc-950/40 border border-border/50 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <h3
                        className="text-sm font-bold flex items-center gap-2"
                        style={{
                          color:
                            playerColor.hex === 0xa1a1aa
                              ? '#e4e4e7'
                              : undefined,
                        }}
                      >
                        <span
                          className={`size-5 rounded-full flex items-center justify-center text-xs font-semibold ${playerColor.css}`}
                        >
                          {cfg.side}
                        </span>
                        <span>Player {cfg.side} Configuration</span>
                      </h3>

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`player-${cfg.side}-faction`}
                          className="text-[10px] font-bold text-muted-foreground uppercase"
                        >
                          Faction
                        </label>
                        <select
                          id={`player-${cfg.side}-faction`}
                          value={cfg.factionId}
                          onChange={(e) =>
                            handlePlayerFactionChange(cfg.side, e.target.value)
                          }
                          className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-foreground"
                        >
                          <option value="" disabled>
                            Select Faction
                          </option>
                          {factions.map((f) => {
                            const hasSkirmisher =
                              factionSkirmisherStatus[f.id]?.hasSkirmisher;
                            return (
                              <option key={f.id} value={f.id}>
                                {f.name} {hasSkirmisher ? '(Skirmisher)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {cfg.factionId && (
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor={`player-${cfg.side}-leader`}
                            className="text-[10px] font-bold text-muted-foreground uppercase"
                          >
                            Starting Leader
                          </label>
                          <select
                            id={`player-${cfg.side}-leader`}
                            value={cfg.leaderId}
                            onChange={(e) =>
                              handlePlayerLeaderChange(cfg.side, e.target.value)
                            }
                            className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-foreground"
                          >
                            {leaders.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name} (Lvl {l.level}, Max HP {l.hitpoints},
                                Cost {l.cost}g)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`player-${cfg.side}-team`}
                          className="text-[10px] font-bold text-muted-foreground uppercase"
                        >
                          Team
                        </label>
                        <select
                          id={`player-${cfg.side}-team`}
                          value={cfg.teamId}
                          onChange={(e) =>
                            handlePlayerTeamChange(
                              cfg.side,
                              parseInt(e.target.value, 10),
                            )
                          }
                          className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                          {playerConfigs.map((c) => (
                            <option key={c.side} value={c.side}>
                              Team {c.side}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase">
                          Control Mode
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handlePlayerControllerChange(cfg.side, 'human')
                            }
                            className={`py-1.5 px-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                              cfg.controller === 'human'
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Human (Manual)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handlePlayerControllerChange(cfg.side, 'none')
                            }
                            className={`py-1.5 px-2.5 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                              cfg.controller === 'none'
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            None
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleStartSimulation}
              disabled={!isConfigValid}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold px-8 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="size-4 fill-white" />
              Start Simulation
            </Button>
          </div>
        </Card>
      )}

      {/* Simulating Screen */}
      {step === 'simulating' && (
        <MovementBoard
          eraId={eraId}
          mapId={selectedMapId}
          playerConfigs={playerConfigs}
          onReset={resetAll}
        />
      )}
    </div>
  );
}
