import { Badge } from '@webnoth/ui/components/badge';
import { Button } from '@webnoth/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@webnoth/ui/components/card';
import { Separator } from '@webnoth/ui/components/separator';
import { ChevronRight, Info, RotateCcw, Swords, Undo } from 'lucide-react';
import type { PuzzleStage } from '@/lib/tactical-puzzle/stages';
import { getUnitById } from '@/lib/wesnoth-data';
import { TacticalPuzzleHexGrid } from './TacticalPuzzleHexGrid';
import { useTacticalPuzzleState } from './useTacticalPuzzleState';

interface TacticalPuzzleBoardProps {
  stage: PuzzleStage;
  onVictory: (xpGained: number) => void;
  onDefeat: (reason: string) => void;
  onReset: () => void;
}

export function TacticalPuzzleBoard({
  stage,
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
    selectedUnit,
    reachableHexes,
    adjacentEnemies,
    combatForecast,
    executeCombat,
    endTurn,
    handleUndo,
    handleHexClick,
  } = useTacticalPuzzleState({ stage, onVictory, onDefeat });

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
                  <div className="pt-2">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase block">
                      Selected Strike
                    </span>
                    <span className="font-bold text-xs text-foreground">
                      {combatForecast.attWep.name}
                    </span>
                    <div className="text-[10px] font-medium text-muted-foreground flex justify-between pt-1">
                      <span>Hit Prob: {combatForecast.attCth}%</span>
                      <span>
                        Dmg: {combatForecast.attDmg} ×{' '}
                        {combatForecast.attStrikes}
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-400 font-semibold pt-1 border-t border-zinc-800/40 mt-1">
                      Expected Value: {combatForecast.attEV} HP
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
    </div>
  );
}
