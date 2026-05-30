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
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Lightbulb,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { TacticalPuzzleBoard } from '@/components/tactical-puzzle/TacticalPuzzleBoard';
import type { TacticalUnitState } from '@/lib/tactical-puzzle/pathfinder';
import { puzzleStages } from '@/lib/tactical-puzzle/stages';
import { getUnitById } from '@/lib/wesnoth-data';

export const Route = createFileRoute('/tactical-puzzle')({
  component: TacticalPuzzlePage,
});

function TacticalPuzzlePage() {
  const [activeStageId, setActiveStageId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    'selecting' | 'playing' | 'victory' | 'defeat'
  >('selecting');
  const [xpGained, setXpGained] = useState(0);
  const [defeatReason, setDefeatReason] = useState('');

  // Active series selection tab
  const [activeSeriesTab, setActiveSeriesTab] = useState<
    'tutorial' | 'rebels_campaign'
  >('tutorial');

  // Campaign squad state carried over from previous stages
  const [campaignSquad, setCampaignSquad] = useState<
    TacticalUnitState[] | null
  >(() => {
    const saved = localStorage.getItem('webnoth_campaign_squad');
    return saved ? JSON.parse(saved) : null;
  });

  // Persist unlocked stages in local state and localStorage
  const [unlockedStages, setUnlockedStages] = useState<string[]>(() => {
    const saved = localStorage.getItem('webnoth_unlocked_puzzles');
    const parsed = saved ? JSON.parse(saved) : [];
    const defaults = ['stage_1', 'stage_rebels_1'];
    return Array.from(new Set([...defaults, ...parsed]));
  });

  useEffect(() => {
    localStorage.setItem(
      'webnoth_unlocked_puzzles',
      JSON.stringify(unlockedStages),
    );
  }, [unlockedStages]);

  const saveCampaignSquad = (squad: TacticalUnitState[] | null) => {
    setCampaignSquad(squad);
    if (squad) {
      localStorage.setItem('webnoth_campaign_squad', JSON.stringify(squad));
    } else {
      localStorage.removeItem('webnoth_campaign_squad');
    }
  };

  const activeStage = puzzleStages.find((s) => s.id === activeStageId) || null;

  const handleSelectStage = (stageId: string) => {
    const stage = puzzleStages.find((s) => s.id === stageId);
    if (!stage) return;

    if (stage.seriesId === 'rebels_campaign') {
      // Force series tab selection to rebels_campaign for consistency
      setActiveSeriesTab('rebels_campaign');

      if (stageId === 'stage_rebels_1') {
        // Clear squad when restarting from Rebels Stage 1
        saveCampaignSquad(null);
      }
    } else {
      setActiveSeriesTab('tutorial');
    }

    setActiveStageId(stageId);
    setStatus('playing');
    setXpGained(0);
    setDefeatReason('');
  };

  const handleVictory = (totalXp: number, survivors: TacticalUnitState[]) => {
    setXpGained(totalXp);
    setStatus('victory');

    if (activeStage?.seriesId === 'rebels_campaign') {
      // Save survivors to campaign squad for the next stage
      saveCampaignSquad(survivors);
    }

    // Unlock next stage in current series if exists
    if (activeStageId && activeStage) {
      const currentSeriesStages = puzzleStages.filter(
        (s) => s.seriesId === activeStage.seriesId,
      );
      const idx = currentSeriesStages.findIndex((s) => s.id === activeStageId);
      if (idx !== -1 && idx + 1 < currentSeriesStages.length) {
        const nextStageId = currentSeriesStages[idx + 1].id;
        if (!unlockedStages.includes(nextStageId)) {
          setUnlockedStages((prev) => [...prev, nextStageId]);
        }
      }
    }
  };

  const handleDefeat = (reason: string) => {
    setDefeatReason(reason);
    setStatus('defeat');
  };

  const handleRetry = () => {
    setStatus('playing');
    setXpGained(0);
    setDefeatReason('');
  };

  const handleBackToSelection = () => {
    setActiveStageId(null);
    setStatus('selecting');
  };

  const handleNextStage = () => {
    if (!activeStageId || !activeStage) return;
    const currentSeriesStages = puzzleStages.filter(
      (s) => s.seriesId === activeStage.seriesId,
    );
    const idx = currentSeriesStages.findIndex((s) => s.id === activeStageId);
    if (idx !== -1 && idx + 1 < currentSeriesStages.length) {
      handleSelectStage(currentSeriesStages[idx + 1].id);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4 px-2">
      {/* 1. STAGE SELECTION SCREEN */}
      {status === 'selecting' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-1.5 animate-in fade-in duration-300">
            <Link
              to="/"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <ArrowLeft className="size-3" />
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent flex items-center gap-2.5">
              <Trophy className="size-8 text-emerald-500" />
              Wesnoth Tactical Puzzles
            </h1>
            <p className="text-sm text-muted-foreground">
              Like Tsume-Shogi, resolve combat scenarios in small maps with
              preset units. Learn unit matching, terrain defenses, and target
              selection!
            </p>
          </div>

          {/* Series selector tabs */}
          <div className="flex gap-2 border-b border-border/40 pb-px">
            <button
              type="button"
              onClick={() => setActiveSeriesTab('tutorial')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeSeriesTab === 'tutorial'
                  ? 'border-emerald-500 text-emerald-400 font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Tutorial Puzzles
            </button>
            <button
              type="button"
              onClick={() => setActiveSeriesTab('rebels_campaign')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeSeriesTab === 'rebels_campaign'
                  ? 'border-emerald-500 text-emerald-400 font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Rebels Campaign
            </button>
          </div>

          {/* Campaign Squad Dashboard */}
          {activeSeriesTab === 'rebels_campaign' && (
            <Card className="border-border/60 bg-zinc-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Users className="size-4" />
                  Your Campaign Squad
                </h3>
                {campaignSquad && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          'Are you sure you want to reset your campaign progress? This will erase your squad states.',
                        )
                      ) {
                        saveCampaignSquad(null);
                        setUnlockedStages((prev) =>
                          prev.filter(
                            (id) => id === 'stage_1' || id === 'stage_rebels_1',
                          ),
                        );
                      }
                    }}
                    className="text-[10px] h-7 px-2 font-bold flex items-center gap-1 border-red-500/20 hover:bg-red-950/20 hover:text-red-400 cursor-pointer"
                  >
                    <RefreshCw className="size-3" />
                    Reset Campaign
                  </Button>
                )}
              </div>

              {campaignSquad && campaignSquad.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {campaignSquad.map((unit) => {
                    const unitType = getUnitById(unit.unitTypeId);
                    const hpPercent = (unit.hp / unit.maxHp) * 100;
                    const xpPercent = (unit.xp / unit.maxXp) * 100;

                    return (
                      <div
                        key={unit.id}
                        className="p-3 rounded-lg border border-zinc-850 bg-zinc-900/30 flex flex-col gap-2 shadow-sm"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {unit.name}
                              {unit.isLeader && (
                                <Badge className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 py-0 px-1 font-bold">
                                  LDR
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {unitType?.name || unit.unitTypeId}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 px-1.5 bg-zinc-950 text-emerald-400 border-emerald-500/20"
                          >
                            Lvl {unit.level}
                          </Badge>
                        </div>

                        {/* HP Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                            <span>HP</span>
                            <span>
                              {unit.hp} / {unit.maxHp}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/40">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all duration-300"
                              style={{ width: `${hpPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* XP Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                            <span>XP</span>
                            <span>
                              {unit.xp} / {unit.maxXp}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/40">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all duration-300"
                              style={{ width: `${xpPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Traits */}
                        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-zinc-800/30">
                          {unit.traits
                            .filter((t) => !t.startsWith('resistance_'))
                            .map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="text-[8px] py-0 px-1.5 font-bold uppercase"
                              >
                                {t}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/80 italic text-center py-5 bg-zinc-900/10 rounded-lg border border-dashed border-zinc-800/40">
                  No active campaign squad found. Start "Rebels 1: Forest
                  Patrol" to initialize your squad!
                </div>
              )}
            </Card>
          )}

          {/* Grid list of stages for active series */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 animate-in fade-in duration-300">
            {puzzleStages
              .filter((stage) => stage.seriesId === activeSeriesTab)
              .map((stage) => {
                const isUnlocked = unlockedStages.includes(stage.id);

                return (
                  <Card
                    key={stage.id}
                    className={`border-border/60 overflow-hidden flex flex-col justify-between h-full transition-all duration-200 group relative ${
                      isUnlocked
                        ? 'bg-card/45 backdrop-blur-md hover:shadow-lg'
                        : 'bg-zinc-900/20 border-zinc-800/40 opacity-50'
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] uppercase font-mono font-extrabold tracking-wider text-emerald-500">
                          {stage.mapName}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[9px] font-semibold ${
                            isUnlocked
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-zinc-900 text-zinc-500'
                          }`}
                        >
                          {isUnlocked ? 'Available' : 'Locked'}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg font-bold group-hover:text-emerald-400 transition-colors mt-1">
                        {stage.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1.5 leading-relaxed line-clamp-3">
                        {stage.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex justify-between items-center gap-4 border-t border-border/20 py-3 bg-zinc-950/20 mt-auto">
                      <div className="text-[10px] text-muted-foreground font-semibold">
                        Turns:{' '}
                        <span className="text-foreground">
                          {stage.turnLimit}
                        </span>
                      </div>
                      <Button
                        onClick={() => handleSelectStage(stage.id)}
                        disabled={!isUnlocked}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="size-3 mr-1 fill-white" />
                        Play Stage
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* 2. PLAYING SCENARIO BOARD */}
      {status === 'playing' && activeStage && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleBackToSelection}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 cursor-pointer bg-transparent border-0 p-0"
          >
            <ArrowLeft className="size-3" />
            Quit Puzzle (Back to List)
          </button>
          <TacticalPuzzleBoard
            stage={activeStage}
            initialPlayerSquad={
              activeStage.seriesId === 'rebels_campaign' ? campaignSquad : null
            }
            onVictory={handleVictory}
            onDefeat={handleDefeat}
            onReset={handleRetry}
          />
        </div>
      )}

      {/* 3. VICTORY SCREEN OVERLAY */}
      {status === 'victory' && activeStage && (
        <div className="min-h-[450px] flex items-center justify-center animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-emerald-500/30 bg-zinc-950/95 backdrop-blur-md shadow-2xl p-6 text-center space-y-6">
            <div className="space-y-2">
              <div className="size-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-500">
                <Trophy className="size-8 fill-emerald-500/20" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                Stage Cleared!
              </h2>
              <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest pt-1">
                {activeStage.name}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/40 grid grid-cols-2 gap-4">
              <div className="text-center space-y-1 border-r border-zinc-800/60">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                  Status
                </span>
                <span className="text-emerald-400 font-extrabold text-sm flex items-center justify-center gap-1">
                  <Sparkles className="size-4" />
                  Victory
                </span>
              </div>
              <div className="text-center space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                  XP Gained
                </span>
                <span className="text-amber-400 font-extrabold text-sm tabular-nums">
                  +{xpGained} XP
                </span>
              </div>
            </div>

            {/* Campaign Squad Survivors summary in Victory view */}
            {activeStage.seriesId === 'rebels_campaign' &&
              campaignSquad &&
              campaignSquad.length > 0 && (
                <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 text-left space-y-2">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1">
                    <Users className="size-3.5" />
                    Squad Survivors Status
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {campaignSquad.map((unit) => {
                      const unitType = getUnitById(unit.unitTypeId);
                      return (
                        <div
                          key={unit.id}
                          className="flex justify-between items-center text-xs border-b border-zinc-800/20 pb-1 last:border-0 last:pb-0"
                        >
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            {unit.name}
                            {unit.isLeader && (
                              <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-1 rounded">
                                Ldr
                              </span>
                            )}
                          </span>
                          <div className="flex gap-2 items-center text-muted-foreground font-mono text-[10px]">
                            <span>{unitType?.name || unit.unitTypeId}</span>
                            <span>Lvl {unit.level}</span>
                            <span className="text-blue-400">
                              {unit.xp}/{unit.maxXp} XP
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            <div className="flex flex-col gap-2.5">
              {puzzleStages
                .filter((s) => s.seriesId === activeStage.seriesId)
                .findIndex((s) => s.id === activeStageId) +
                1 <
              puzzleStages.filter((s) => s.seriesId === activeStage.seriesId)
                .length ? (
                <Button
                  onClick={handleNextStage}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold cursor-pointer h-10"
                >
                  Next Stage
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              ) : (
                <div className="text-xs text-amber-500/80 font-bold py-2 bg-amber-500/5 rounded border border-amber-500/10">
                  🎉 Congratulations! You cleared the{' '}
                  {activeStage.seriesId === 'rebels_campaign'
                    ? 'Rebels Campaign'
                    : 'Tutorial'}
                  !
                </div>
              )}
              <Button
                variant="outline"
                onClick={handleBackToSelection}
                className="w-full cursor-pointer font-bold text-xs h-10"
              >
                Back to Stage Selection
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 4. DEFEAT SCREEN OVERLAY */}
      {status === 'defeat' && activeStage && (
        <div className="min-h-[450px] flex items-center justify-center animate-in fade-in duration-300">
          <Card className="w-full max-w-md border-red-500/30 bg-zinc-950/95 backdrop-blur-md shadow-2xl p-6 text-center space-y-6">
            <div className="space-y-2">
              <div className="size-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
                <AlertTriangle className="size-8" />
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-amber-500 bg-clip-text text-transparent">
                Defeated...
              </h2>
              <p className="text-xs text-muted-foreground uppercase font-mono tracking-widest pt-1">
                {activeStage.name}
              </p>
            </div>

            {/* Defeat Reason Panel */}
            <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/40 space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold block">
                Defeat Reason
              </span>
              <p className="text-sm font-semibold text-red-400">
                {defeatReason}
              </p>
            </div>

            {/* Tactical hints list */}
            {activeStage.hints && activeStage.hints.length > 0 && (
              <div className="text-left bg-zinc-900/40 rounded-xl p-4 border border-zinc-800/50 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-wider">
                  <Lightbulb className="size-4" />
                  Tactical Advice
                </div>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc pl-4 leading-relaxed">
                  {activeStage.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <Button
                onClick={handleRetry}
                className="w-full bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-extrabold cursor-pointer h-10 flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="size-4" />
                Retry Stage
              </Button>
              <Button
                variant="outline"
                onClick={handleBackToSelection}
                className="w-full cursor-pointer font-bold text-xs h-10"
              >
                Back to Stage Selection
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
