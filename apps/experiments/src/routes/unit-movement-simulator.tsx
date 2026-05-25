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
import { MovementBoard } from '@/components/movement-simulator/MovementBoard';
import {
  getAllEras,
  getFactionsByEra,
  getFactionUnits,
  getUnitById,
} from '@/lib/wesnoth-data';

export const Route = createFileRoute('/unit-movement-simulator')({
  component: UnitMovementSimulatorPage,
});

type StepType = 'mode' | 'config' | 'map' | 'players' | 'simulating';

function UnitMovementSimulatorPage() {
  const [step, setStep] = useState<StepType>('mode');
  const [_mode, setMode] = useState<'campaign' | 'multiplayer' | null>(null);
  const [eraId, setEraId] = useState<string>('era_default');

  // Player 1 & 2 configuration
  const [p1FactionId, setP1FactionId] = useState<string>('');
  const [p1LeaderId, setP1LeaderId] = useState<string>('');
  const [p2FactionId, setP2FactionId] = useState<string>('');
  const [p2LeaderId, setP2LeaderId] = useState<string>('');

  // Map & Players Setup
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [p1Controller, setP1Controller] = useState<'human' | 'none'>('human');
  const [p2Controller, setP2Controller] = useState<'human' | 'none'>('human');

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

  // Filter multiplayer maps to only 2-player maps (pure 1v1 enemy setups)
  const selectableMaps = useMemo(() => {
    return multiplayerMaps.filter((m) => {
      let startsCount = 0;
      for (let r = 0; r < m.grid.length; r++) {
        for (let c = 0; c < m.grid[r].length; c++) {
          const { startPos } = parseCell(m.grid[r][c]);
          if (startPos) startsCount++;
        }
      }
      return startsCount === 2;
    });
  }, []);

  const _selectedMap = useMemo(() => {
    return multiplayerMaps.find((m) => m.id === selectedMapId);
  }, [selectedMapId]);

  // Auto-select first faction & leader when era changes
  const handleEraChange = (nextEraId: string) => {
    setEraId(nextEraId);
    const availableFactions = getFactionsByEra(nextEraId);

    if (availableFactions.length >= 2) {
      setP1FactionId(availableFactions[0].id);
      const p1Leaders = availableFactions[0].leader;
      if (p1Leaders.length > 0) setP1LeaderId(p1Leaders[0]);

      setP2FactionId(availableFactions[1].id);
      const p2Leaders = availableFactions[1].leader;
      if (p2Leaders.length > 0) setP2LeaderId(p2Leaders[0]);
    } else {
      setP1FactionId('');
      setP1LeaderId('');
      setP2FactionId('');
      setP2LeaderId('');
    }
  };

  // Auto-select leader when faction is chosen
  const handleP1FactionChange = (factionId: string) => {
    setP1FactionId(factionId);
    const leaders = getLeadersForFaction(factionId);
    if (leaders.length > 0) {
      setP1LeaderId(leaders[0].id);
    } else {
      setP1LeaderId('');
    }
  };

  const handleP2FactionChange = (factionId: string) => {
    setP2FactionId(factionId);
    const leaders = getLeadersForFaction(factionId);
    if (leaders.length > 0) {
      setP2LeaderId(leaders[0].id);
    } else {
      setP2LeaderId('');
    }
  };

  const handleModeSelect = (selectedMode: 'campaign' | 'multiplayer') => {
    if (selectedMode === 'campaign') return; // Under development
    setMode(selectedMode);
    setStep('config');
    // Pre-initialize faction choices
    handleEraChange(eraId);
  };

  const handleStartSimulation = () => {
    setStep('simulating');
  };

  const resetAll = () => {
    setStep('mode');
    setMode(null);
    setP1FactionId('');
    setP1LeaderId('');
    setP2FactionId('');
    setP2LeaderId('');
    setSelectedMapId('');
    setP1Controller('human');
    setP2Controller('human');
  };

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
              if (step === 'config') setStep('mode');
              else if (step === 'map') setStep('config');
              else if (step === 'players') setStep('map');
              else if (step === 'simulating') setStep('players');
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
                Configure two sides, select from balanced multiplayer maps, and
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

      {/* Era & Faction Selection Screen */}
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
              {/* Player 1 Setup */}
              <div className="space-y-4 p-4 rounded-lg bg-zinc-950/40 border border-border/50">
                <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="size-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">
                    1
                  </span>
                  Player 1 Faction & Leader
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="p1-faction"
                    className="text-[10px] font-bold text-muted-foreground uppercase"
                  >
                    Faction
                  </label>
                  <select
                    id="p1-faction"
                    value={p1FactionId}
                    onChange={(e) => handleP1FactionChange(e.target.value)}
                    className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm"
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

                {p1FactionId && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="p1-leader"
                      className="text-[10px] font-bold text-muted-foreground uppercase"
                    >
                      Starting Leader
                    </label>
                    <select
                      id="p1-leader"
                      value={p1LeaderId}
                      onChange={(e) => setP1LeaderId(e.target.value)}
                      className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm"
                    >
                      {getLeadersForFaction(p1FactionId).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} (Lvl {l.level}, Max HP {l.hitpoints}, Cost{' '}
                          {l.cost}g)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Player 2 Setup */}
              <div className="space-y-4 p-4 rounded-lg bg-zinc-950/40 border border-border/50">
                <h3 className="text-sm font-bold text-cyan-400 flex items-center gap-1.5">
                  <span className="size-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-xs">
                    2
                  </span>
                  Player 2 Faction & Leader
                </h3>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="p2-faction"
                    className="text-[10px] font-bold text-muted-foreground uppercase"
                  >
                    Faction
                  </label>
                  <select
                    id="p2-faction"
                    value={p2FactionId}
                    onChange={(e) => handleP2FactionChange(e.target.value)}
                    className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm"
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

                {p2FactionId && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="p2-leader"
                      className="text-[10px] font-bold text-muted-foreground uppercase"
                    >
                      Starting Leader
                    </label>
                    <select
                      id="p2-leader"
                      value={p2LeaderId}
                      onChange={(e) => setP2LeaderId(e.target.value)}
                      className="w-full rounded-md border border-border bg-zinc-900 px-3 py-2 text-sm"
                    >
                      {getLeadersForFaction(p2FactionId).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} (Lvl {l.level}, Max HP {l.hitpoints}, Cost{' '}
                          {l.cost}g)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => setStep('map')}
              disabled={
                !p1FactionId || !p1LeaderId || !p2FactionId || !p2LeaderId
              }
              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Select Map
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Map Selection Screen */}
      {step === 'map' && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-md p-6 space-y-6 animate-in fade-in duration-300">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                Select a 2-Player Map
              </h3>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-emerald-500 border-emerald-500/20 bg-emerald-500/5"
              >
                {selectableMaps.length} Maps Available
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto pr-1">
              {selectableMaps.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMapId(m.id)}
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
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                    <MapIcon className="size-3.5" />
                    Size: {m.width} × {m.height}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={() => setStep('players')}
              disabled={!selectedMapId}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold px-6 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next: Configure Controllers
              <ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Player Setup Screen */}
      {step === 'players' && (
        <Card className="border-border/60 bg-card/40 backdrop-blur-md p-6 space-y-6 animate-in fade-in duration-300">
          <div className="space-y-5">
            <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
              Configure Player Controllers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player 1 Controller */}
              <div className="space-y-4 p-4 rounded-lg bg-zinc-950/40 border border-border/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                    <span className="size-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-xs">
                      1
                    </span>
                    Player 1 Controller
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Set control mode for Player 1 (Faction:{' '}
                    {factions.find((f) => f.id === p1FactionId)?.name}).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setP1Controller('human')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                      p1Controller === 'human'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Human (Manual)
                  </button>
                  <button
                    type="button"
                    onClick={() => setP1Controller('none')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                      p1Controller === 'none'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Player 2 Controller */}
              <div className="space-y-4 p-4 rounded-lg bg-zinc-950/40 border border-border/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-cyan-400 text-sm flex items-center gap-2">
                    <span className="size-5 rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center text-xs">
                      2
                    </span>
                    Player 2 Controller
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Set control mode for Player 2 (Faction:{' '}
                    {factions.find((f) => f.id === p2FactionId)?.name}).
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setP2Controller('human')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                      p2Controller === 'human'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Human (Manual)
                  </button>
                  <button
                    type="button"
                    onClick={() => setP2Controller('none')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border cursor-pointer transition-all ${
                      p2Controller === 'none'
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                        : 'border-border/40 bg-zinc-950/40 hover:border-border text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={handleStartSimulation}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold px-8 cursor-pointer flex items-center gap-1.5"
            >
              <Play className="size-4 fill-white" />
              Start Simulation
            </Button>
          </div>
        </Card>
      )}

      {/* Simulating Screen (Step 2 Board View) */}
      {step === 'simulating' && (
        <MovementBoard
          eraId={eraId}
          p1FactionId={p1FactionId}
          p1LeaderId={p1LeaderId}
          p2FactionId={p2FactionId}
          p2LeaderId={p2LeaderId}
          mapId={selectedMapId}
          p1Controller={p1Controller}
          p2Controller={p2Controller}
          onReset={resetAll}
        />
      )}
    </div>
  );
}
