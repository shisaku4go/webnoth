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
  RotateCcw,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { TacticalPuzzleBoard } from '@/components/tactical-puzzle/TacticalPuzzleBoard';
import { puzzleStages } from '@/lib/tactical-puzzle/stages';

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

  // Persist unlocked stages in local state and localStorage
  const [unlockedStages, setUnlockedStages] = useState<string[]>(() => {
    const saved = localStorage.getItem('webnoth_unlocked_puzzles');
    return saved ? JSON.parse(saved) : ['stage_1'];
  });

  useEffect(() => {
    localStorage.setItem(
      'webnoth_unlocked_puzzles',
      JSON.stringify(unlockedStages),
    );
  }, [unlockedStages]);

  const activeStage = puzzleStages.find((s) => s.id === activeStageId) || null;

  const handleSelectStage = (stageId: string) => {
    setActiveStageId(stageId);
    setStatus('playing');
    setXpGained(0);
    setDefeatReason('');
  };

  const handleVictory = (totalXp: number) => {
    setXpGained(totalXp);
    setStatus('victory');

    // Unlock next stage if exists
    if (activeStageId) {
      const idx = puzzleStages.findIndex((s) => s.id === activeStageId);
      if (idx !== -1 && idx + 1 < puzzleStages.length) {
        const nextStageId = puzzleStages[idx + 1].id;
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
    if (!activeStageId) return;
    const idx = puzzleStages.findIndex((s) => s.id === activeStageId);
    if (idx !== -1 && idx + 1 < puzzleStages.length) {
      handleSelectStage(puzzleStages[idx + 1].id);
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

          {/* Grid list of stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 animate-in fade-in duration-300">
            {puzzleStages.map((stage) => {
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
                      <span className="text-foreground">{stage.turnLimit}</span>
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

            <div className="flex flex-col gap-2.5">
              {puzzleStages.findIndex((s) => s.id === activeStageId) + 1 <
              puzzleStages.length ? (
                <Button
                  onClick={handleNextStage}
                  className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold cursor-pointer h-10"
                >
                  Next Stage
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              ) : (
                <div className="text-xs text-amber-500/80 font-bold py-1 bg-amber-500/5 rounded border border-amber-500/10">
                  🎉 You have completed all available stages!
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
