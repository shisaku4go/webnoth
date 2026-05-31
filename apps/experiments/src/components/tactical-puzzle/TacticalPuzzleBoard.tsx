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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@webnoth/ui/components/dialog';
import { Separator } from '@webnoth/ui/components/separator';
import {
  Check,
  ChevronRight,
  Copy,
  Info,
  RotateCcw,
  Sparkles,
  Swords,
  Undo,
} from 'lucide-react';
import { useState } from 'react';
import { generateTacticalContext } from '@/lib/tactical-puzzle/ai-tactician';
import type { TacticalUnitState } from '@/lib/tactical-puzzle/pathfinder';
import type { PuzzleStage } from '@/lib/tactical-puzzle/stages';
import { getUnitById } from '@/lib/wesnoth-data';
import { TacticalPuzzleHexGrid } from './TacticalPuzzleHexGrid';
import { useTacticalPuzzleState } from './useTacticalPuzzleState';

interface TacticalPuzzleBoardProps {
  stage: PuzzleStage;
  initialPlayerSquad?: TacticalUnitState[] | null;
  onVictory: (xpGained: number, survivors: TacticalUnitState[]) => void;
  onDefeat: (reason: string) => void;
  onReset: () => void;
}

export function TacticalPuzzleBoard({
  stage,
  initialPlayerSquad,
  onVictory,
  onDefeat,
  onReset,
}: TacticalPuzzleBoardProps) {
  const {
    units,
    selectedUnitId,
    activeSide,
    turn,
    hoveredHex,
    setHoveredHex,
    history,
    actionLogs,
    pendingCombat,
    setPendingCombat,
    combatEffect,
    combatStrike,
    selectedUnit,
    reachableHexes,
    adjacentEnemies,
    combatForecast,
    executeCombat,
    selectAttackerWeapon,
    endTurn,
    handleUndo,
    handleHexClick,
    pendingAdvancement,
    resolveAdvancement,
  } = useTacticalPuzzleState({
    stage,
    initialPlayerSquad,
    onVictory,
    onDefeat,
  });

  const [isAiDiagOpen, setIsAiDiagOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const aiPromptText = isAiDiagOpen
    ? generateTacticalContext(stage, units, turn, actionLogs)
    : '';

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch select-none w-full">
      {/* Pixi Canvas Grid */}
      <TacticalPuzzleHexGrid
        stage={stage}
        units={units}
        selectedUnitId={selectedUnitId}
        reachableHexes={reachableHexes}
        adjacentEnemies={adjacentEnemies}
        combatEffect={combatEffect}
        combatStrike={combatStrike}
        setHoveredHex={setHoveredHex}
        handleHexClick={handleHexClick}
      />

      {/* Control / Sidebar Panel */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-4 border border-border/80 bg-card/45 backdrop-blur-md rounded-xl p-4 shadow-lg justify-between">
        <div className="space-y-4">
          {/* Header stage details */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-emerald-500 block">
              {stage.mapName} · Turn {turn}/{stage.turnLimit}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
              {stage.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {stage.description}
            </p>
          </div>

          <Separator className="bg-border/60" />

          {/* 1. Hex Inspector Panel */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="size-3.5 text-emerald-500" />
              Tile Details
            </h3>
            <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[4.5rem] flex flex-col justify-center text-xs">
              {hoveredHex ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Coordinates</span>
                    <span className="font-mono bg-muted/60 px-1 rounded text-foreground">
                      x={hoveredHex.x + 1}, y={hoveredHex.y + 1}
                    </span>
                  </div>
                  <div className="font-bold text-foreground truncate">
                    {hoveredHex.terrainName}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground/80 italic">
                  Hover tiles to inspect defense/movement details
                </div>
              )}
            </div>
          </div>

          {/* 2. Unit Details Panel */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Swords className="size-3.5 text-emerald-500" />
              Unit Profile
            </h3>
            <div className="rounded-lg bg-zinc-950/60 border border-border/50 p-3 min-h-[7.5rem] flex flex-col justify-center text-xs">
              {selectedUnit ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        {selectedUnit.name}
                        <Badge
                          variant="outline"
                          className="text-[9px] py-0 px-1 bg-muted"
                        >
                          Lvl {selectedUnit.level}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {getUnitById(selectedUnit.unitTypeId)?.name}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selectedUnit.hasAttacked ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-green-500/10 text-green-400 border border-green-500/25'}`}
                    >
                      {selectedUnit.hasAttacked ? 'Exhausted' : 'Ready'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                    <div className="flex justify-between bg-zinc-900/60 p-1.5 rounded">
                      <span className="text-muted-foreground">HP</span>
                      <span className="font-bold tabular-nums">
                        {selectedUnit.hp}/{selectedUnit.maxHp}
                      </span>
                    </div>
                    <div className="flex justify-between bg-zinc-900/60 p-1.5 rounded">
                      <span className="text-muted-foreground">Moves</span>
                      <span className="font-bold tabular-nums">
                        {selectedUnit.moves}/{selectedUnit.maxMoves}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground/80 italic">
                  Select a unit to view stats & actions
                </div>
              )}
            </div>
          </div>

          {/* 3. Action Buttons & Turn Actions */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
                disabled={history.length === 0 || activeSide !== 1}
                className="text-xs flex items-center gap-1 h-9 cursor-pointer"
              >
                <Undo className="size-3" />
                Undo Move
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onReset}
                className="text-xs flex items-center gap-1 h-9 cursor-pointer border-zinc-700/50 hover:bg-zinc-800"
              >
                <RotateCcw className="size-3" />
                Restart
              </Button>
            </div>
            <Button
              onClick={endTurn}
              disabled={activeSide !== 1}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold h-10 cursor-pointer flex items-center justify-center gap-1"
            >
              End Turn
              <ChevronRight className="size-4" />
            </Button>
            <Button
              onClick={() => setIsAiDiagOpen(true)}
              variant="outline"
              className="w-full border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/20 hover:text-emerald-300 font-bold h-10 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="size-4" />
              Consult AI Tactician
            </Button>
          </div>
        </div>

        {/* 4. Action Logs console */}
        <div className="mt-4 pt-4 border-t border-border/40 space-y-2 flex-1 flex flex-col justify-end min-h-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block">
            Battle Logs
          </span>
          <div className="h-28 overflow-y-auto bg-black/40 border border-zinc-800/40 rounded p-2 text-[9px] font-mono space-y-1 text-zinc-400">
            {actionLogs.map((log) => (
              <div
                key={log.id}
                className={`leading-normal ${log.text.startsWith('☠') ? 'text-red-400 font-bold' : log.text.startsWith('Combat:') ? 'text-amber-300' : ''}`}
              >
                {log.text}
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Combat Prediction Dialog overlay */}
      {pendingCombat && combatForecast && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-zinc-900/60 pb-3">
              <CardTitle className="text-md font-bold flex items-center justify-between text-foreground">
                <span className="flex items-center gap-1.5">
                  <Swords className="size-4.5 text-red-500" />
                  Combat Forecast
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Morning Phase (+25% Lawful Bonus)
                </span>
              </CardTitle>
              <CardDescription className="text-xs">
                Select your attack weapon and press Engage to resolve the
                battle.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Attacker panel */}
                <div className="space-y-2 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-emerald-400">
                      {combatForecast.attacker.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    >
                      Attacker
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    HP: {combatForecast.attacker.hp}/
                    {combatForecast.attacker.maxHp}
                  </div>
                  <div className="pt-2 space-y-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Select Weapon
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {combatForecast.attAttacks.map(
                        (
                          wep: {
                            name: string;
                            damage: number;
                            number: number;
                            range: string;
                          },
                          idx: number,
                        ) => {
                          const isSelected =
                            combatForecast.attackerWeaponIndex === idx;
                          return (
                            <button
                              key={`${wep.name}-${idx}`}
                              type="button"
                              onClick={() => selectAttackerWeapon(idx)}
                              className={`w-full text-left p-1.5 rounded-lg border transition text-[11px] cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/10 border-emerald-500 text-foreground font-semibold'
                                  : 'bg-zinc-950/60 border-zinc-800/80 text-muted-foreground hover:bg-zinc-900 hover:text-foreground'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold truncate max-w-[90px]">
                                  {wep.name}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                                  {wep.damage}×{wep.number} ({wep.range})
                                </span>
                              </div>
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="pt-2 border-t border-zinc-800/40 space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground flex justify-between">
                        <span>Hit Prob: {combatForecast.attCth}%</span>
                        <span>
                          Dmg: {combatForecast.attDmg} ×{' '}
                          {combatForecast.attStrikes}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-400 font-semibold pt-0.5">
                        Expected Value: {combatForecast.attEV} HP
                      </div>
                    </div>
                  </div>
                </div>

                {/* Defender panel */}
                <div className="space-y-2 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-xs text-cyan-400">
                      {combatForecast.defender.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[8px] bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                    >
                      Defender
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    HP: {combatForecast.defender.hp}/
                    {combatForecast.defender.maxHp}
                  </div>
                  <div className="pt-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Counter Strike
                    </span>
                    <span className="font-bold text-xs text-foreground">
                      {combatForecast.defWep
                        ? combatForecast.defWep.name
                        : 'No Counter'}
                    </span>
                    {combatForecast.defWep ? (
                      <>
                        <div className="text-[10px] font-medium text-muted-foreground flex justify-between pt-1">
                          <span>Hit Prob: {combatForecast.defCth}%</span>
                          <span>
                            Dmg: {combatForecast.defDmg} ×{' '}
                            {combatForecast.defStrikes}
                          </span>
                        </div>
                        <div className="text-[10px] text-amber-400 font-semibold pt-1 border-t border-zinc-800/40 mt-1">
                          Expected Value: {combatForecast.defEV} HP
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-red-400 font-semibold pt-1">
                        Out of range weapon!
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Confirm / Cancel actions */}
              <div className="flex gap-3 justify-end pt-2 border-t border-zinc-800/40">
                <Button
                  variant="outline"
                  onClick={() => setPendingCombat(null)}
                  className="cursor-pointer font-bold text-xs"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    executeCombat(
                      pendingCombat.attackerId,
                      pendingCombat.defenderId,
                      pendingCombat.attackerWeaponIndex,
                      pendingCombat.defenderWeaponIndex,
                    )
                  }
                  className="bg-red-600 hover:bg-red-500 text-white font-extrabold text-xs cursor-pointer px-6"
                >
                  Engage!
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Level Up Advancement Choice Dialog overlay */}
      {pendingAdvancement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-lg border-zinc-800 bg-zinc-950/90 backdrop-blur-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <CardHeader className="bg-gradient-to-r from-emerald-950/45 to-teal-950/45 pb-3 border-b border-border/20">
              <CardTitle className="text-md font-bold flex items-center gap-2 text-foreground">
                <span className="text-lg">✨</span>
                Unit Level Up!
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold text-emerald-400">
                  {pendingAdvancement.unitName}
                </span>{' '}
                has earned enough experience to advance. Choose a new class:
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {pendingAdvancement.options.map((optId) => {
                  const optUnit = getUnitById(optId);
                  if (!optUnit) return null;

                  return (
                    <button
                      key={optId}
                      type="button"
                      onClick={() =>
                        resolveAdvancement(pendingAdvancement.unitId, optId)
                      }
                      className="w-full text-left p-4 rounded-xl border border-zinc-850 bg-zinc-900/40 hover:bg-emerald-950/20 hover:border-emerald-500/60 transition group cursor-pointer flex flex-col gap-2"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-bold text-foreground text-sm group-hover:text-emerald-400 transition-colors">
                          {optUnit.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20 py-0.5 font-bold uppercase"
                        >
                          Lvl {optUnit.level}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-[10px] pt-1 border-t border-zinc-800/40 w-full text-muted-foreground">
                        <div>
                          HP:{' '}
                          <span className="text-foreground font-semibold font-mono">
                            {optUnit.hitpoints}
                          </span>
                        </div>
                        <div>
                          Moves:{' '}
                          <span className="text-foreground font-semibold font-mono">
                            {optUnit.movement}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 w-full text-left pt-1">
                        <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                          Attacks
                        </span>
                        <div className="flex flex-col gap-1">
                          {optUnit.attacks.map((att) => (
                            <div
                              key={att.name}
                              className="flex justify-between text-[10px] text-zinc-400 font-mono"
                            >
                              <span>🗡️ {att.name}</span>
                              <span>
                                {att.damage} × {att.number} ({att.range})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Tactician Modal */}
      <Dialog open={isAiDiagOpen} onOpenChange={setIsAiDiagOpen}>
        <DialogContent className="max-w-2xl bg-zinc-950/95 border-zinc-800 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              <Sparkles className="size-5 text-emerald-400" />
              AI Tactician Advisor
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs mt-1 leading-relaxed">
              Copy the game status context below and paste it into a Generative
              AI (e.g. Gemini, ChatGPT, Claude) to get step-by-step tactical
              advice on how to clear this stage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="relative">
              <textarea
                value={aiPromptText}
                readOnly
                className="w-full h-80 p-3 bg-black/60 border border-zinc-800/80 rounded-lg font-mono text-[10px] text-zinc-300 resize-none outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleCopyPrompt(aiPromptText)}
                  className="h-8 px-2.5 text-xs font-bold flex items-center gap-1 cursor-pointer bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-200"
                >
                  {copied ? (
                    <>
                      <Check className="size-3 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      Copy Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-zinc-900/40 border border-zinc-800/50 rounded-lg">
              <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1">
                💡 How to use:
              </h4>
              <p className="text-[11px] text-zinc-400 leading-normal">
                1. Click the "Copy Prompt" button above to copy the formatted
                tactical context.
                <br />
                2. Open your preferred AI assistant in your browser (e.g.,{' '}
                <a
                  href="https://gemini.google.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  Gemini
                </a>
                ,{' '}
                <a
                  href="https://chatgpt.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  ChatGPT
                </a>
                ).
                <br />
                3. Paste the prompt and press Enter. The AI will act as a
                military strategist to guide your moves.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800/40">
            <Button
              onClick={() => setIsAiDiagOpen(false)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer px-6"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
