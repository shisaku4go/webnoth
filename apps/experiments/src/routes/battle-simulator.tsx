import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo, useEffect } from 'react';
import { Search, Shield, Heart, Zap, Crosshair, Swords, RefreshCw, Info, AlertTriangle, Play } from 'lucide-react';
import { Button } from '@webnoth/ui/components/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@webnoth/ui/components/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@webnoth/ui/components/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@webnoth/ui/components/tabs';
import { ScrollArea } from '@webnoth/ui/components/scroll-area';
import { Badge } from '@webnoth/ui/components/badge';
import { Separator } from '@webnoth/ui/components/separator';
import { Popover, PopoverTrigger, PopoverContent } from '@webnoth/ui/components/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@webnoth/ui/components/command';
import { Label } from '@webnoth/ui/components/label';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@webnoth/ui/components/tooltip';
import { Input } from '@webnoth/ui/components/input';

import { getAllUnits, getUnitById } from '@/lib/wesnoth-data';
import { traits as globalTraits } from '@webnoth/wesnoth-data/traits';
import { terrains as globalTerrains } from '@webnoth/wesnoth-data/terrains';
import { times as globalTimes } from '@webnoth/wesnoth-data/times';
import { WesnothBattleManager } from '@/lib/combat/battle-manager';
import { WesnothCombatCore } from '@/lib/combat/combat-core';
import type { BattleResult, CombatUnitState } from '@/lib/combat/types';
import { wesnothAssetUrl } from '@/lib/asset-url';
import { cn } from '@webnoth/ui/lib/utils';

export const Route = createFileRoute('/battle-simulator')({
  component: BattleSimulatorPage,
});

const AVAILABLE_TRAITS = [
  { id: 'strong', name: 'Strong', desc: '+1 melee damage, +1 HP' },
  { id: 'quick', name: 'Quick', desc: '+1 movement, -5% HP' },
  { id: 'resilient', name: 'Resilient', desc: '+4 HP, +1 HP per level' },
  { id: 'intelligent', name: 'Intelligent', desc: '-20% XP requirement' },
  { id: 'dextrous', name: 'Dextrous', desc: '+1 ranged damage (elves only)' },
  { id: 'healthy', name: 'Healthy', desc: 'Heals 2 HP/turn, +1 HP, +1 HP/level' },
  { id: 'fearless', name: 'Fearless', desc: 'No penalty at night' },
];

function BattleSimulatorPage() {
  const allUnits = useMemo(() => getAllUnits(), []);

  // Default selections
  const defaultAttackerId = useMemo(() => {
    return allUnits.find((u) => u.id === 'spearman')?.id || allUnits[0]?.id || '';
  }, [allUnits]);

  const defaultDefenderId = useMemo(() => {
    return allUnits.find((u) => u.id === 'walking_corpse')?.id || allUnits[1]?.id || '';
  }, [allUnits]);

  // State managers
  const [attackerId, setAttackerId] = useState(defaultAttackerId);
  const [defenderId, setDefenderId] = useState(defaultDefenderId);

  const [attackerTraits, setAttackerTraits] = useState<string[]>(['strong', 'resilient']);
  const [defenderTraits, setDefenderTraits] = useState<string[]>([]);

  const [attackerHp, setAttackerHp] = useState<number>(0);
  const [defenderHp, setDefenderHp] = useState<number>(0);

  const [attackerSlowed, setAttackerSlowed] = useState(false);
  const [defenderSlowed, setDefenderSlowed] = useState(false);

  const [attackerPoisoned, setAttackerPoisoned] = useState(false);
  const [defenderPoisoned, setDefenderPoisoned] = useState(false);

  const [attackerWeaponIndex, setAttackerWeaponIndex] = useState<number>(-1);
  const [defenderWeaponIndex, setDefenderWeaponIndex] = useState<number>(-1);

  const [terrainId, setTerrainId] = useState('grassland');
  const [selectedTimeOfDayId, setSelectedTimeOfDayId] = useState('morning');

  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);

  // Fetch unit definitions
  const attackerUnit = useMemo(() => getUnitById(attackerId), [attackerId]);
  const defenderUnit = useMemo(() => getUnitById(defenderId), [defenderId]);

  // Compute states using the battle manager init
  const attackerState = useMemo(() => {
    if (!attackerUnit) return null;
    return WesnothBattleManager.initializeUnitState(attackerUnit, attackerTraits);
  }, [attackerUnit, attackerTraits]);

  const defenderState = useMemo(() => {
    if (!defenderUnit) return null;
    return WesnothBattleManager.initializeUnitState(defenderUnit, defenderTraits);
  }, [defenderUnit, defenderTraits]);

  // Adjust HP values if they fall out of bounds
  useEffect(() => {
    if (attackerState) {
      setAttackerHp((prev) => (prev === 0 ? attackerState.maxHp : Math.min(attackerState.maxHp, prev)));
    }
  }, [attackerState]);

  useEffect(() => {
    if (defenderState) {
      setDefenderHp((prev) => (prev === 0 ? defenderState.maxHp : Math.min(defenderState.maxHp, prev)));
    }
  }, [defenderState]);

  // Reset weapons indexes when unit changes
  useEffect(() => {
    setAttackerWeaponIndex(-1);
  }, [attackerId]);

  useEffect(() => {
    setDefenderWeaponIndex(-1);
  }, [defenderId]);

  // Get attacks
  const attackerAttacks = useMemo(() => {
    if (!attackerUnit || !attackerState) return [];
    return WesnothBattleManager.getModifiedAttacks(attackerUnit, attackerState);
  }, [attackerUnit, attackerState]);

  const defenderAttacks = useMemo(() => {
    if (!defenderUnit || !defenderState) return [];
    return WesnothBattleManager.getModifiedAttacks(defenderUnit, defenderState);
  }, [defenderUnit, defenderState]);

  // Run simulation function
  const runSim = () => {
    if (!attackerUnit || !defenderUnit) return;
    const result = WesnothBattleManager.runSimulation(attackerUnit, defenderUnit, {
      attackerTraits,
      defenderTraits,
      attackerWeaponIndex: attackerWeaponIndex === -1 ? undefined : attackerWeaponIndex,
      defenderWeaponIndex: defenderWeaponIndex === -1 ? undefined : defenderWeaponIndex,
      terrainId,
      timeOfDayId: selectedTimeOfDayId,
      attackerHpOverride: attackerHp,
      defenderHpOverride: defenderHp,
      attackerSlowed,
      defenderSlowed,
      attackerPoisoned,
      defenderPoisoned,
    });
    setBattleResult(result);
  };

  // Run initial simulation on load and whenever configs change
  useEffect(() => {
    runSim();
  }, [
    attackerId,
    defenderId,
    attackerTraits,
    defenderTraits,
    attackerHp,
    defenderHp,
    attackerSlowed,
    defenderSlowed,
    attackerPoisoned,
    defenderPoisoned,
    attackerWeaponIndex,
    defenderWeaponIndex,
    terrainId,
    selectedTimeOfDayId,
  ]);

  // Math breakdown resolver
  const mathBreakdown = useMemo(() => {
    if (!attackerState || !defenderState || !battleResult?.attackerWeapon) return null;

    const tod = globalTimes.find((t) => t.id === selectedTimeOfDayId) || globalTimes[0];
    const context = {
      terrainId,
      timeOfDayId: tod.id,
      lawfulBonus: tod.lawfulBonus || 0,
    };

    const attackerDefenseVal = WesnothBattleManager.resolveTerrainValues(attackerUnit!, terrainId).defenseChanceToHit;
    const defenderDefenseVal = WesnothBattleManager.resolveTerrainValues(defenderUnit!, terrainId).defenseChanceToHit;

    // Attacker active math
    const aDmg = WesnothCombatCore.calculateDamage(
      attackerState,
      defenderState,
      battleResult.attackerWeapon,
      battleResult.defenderWeapon,
      context,
      true
    );

    const aCth = WesnothCombatCore.calculateCTH(
      attackerState,
      defenderState,
      battleResult.attackerWeapon,
      defenderDefenseVal
    );

    const aStrikes = WesnothCombatCore.calculateSwarmBlows(
      battleResult.attackerWeapon,
      attackerHp,
      attackerState.maxHp
    );

    return {
      attacker: {
        dmg: aDmg,
        cth: aCth,
        strikes: aStrikes,
      },
      defender: battleResult.defenderWeapon ? {
        dmg: WesnothCombatCore.calculateDamage(
          defenderState,
          attackerState,
          battleResult.defenderWeapon,
          battleResult.attackerWeapon,
          context,
          false
        ),
        cth: WesnothCombatCore.calculateCTH(
          defenderState,
          attackerState,
          battleResult.defenderWeapon,
          attackerDefenseVal
        ),
        strikes: WesnothCombatCore.calculateSwarmBlows(
          battleResult.defenderWeapon,
          defenderHp,
          defenderState.maxHp
        ),
      } : null,
    };
  }, [attackerState, defenderState, battleResult, terrainId, selectedTimeOfDayId, attackerHp, defenderHp]);

  const attackerMath = mathBreakdown?.attacker;
  const defenderMath = mathBreakdown?.defender;

  // Clean terrains list
  const uniqueTerrains = useMemo(() => {
    const seen = new Set<string>();
    const list: typeof globalTerrains = [];
    for (const t of globalTerrains) {
      if (!t.name) continue;
      const key = `${t.name}:${t.code}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(t);
      }
    }
    return list.sort((a, b) => {
      if (a.id === 'grassland' || a.id === 'flat') return -1;
      if (b.id === 'grassland' || b.id === 'flat') return 1;
      return a.name.localeCompare(b.name);
    });
  }, []);

  const selectedTerrain = useMemo(() => {
    return uniqueTerrains.find((t) => t.id === terrainId) || uniqueTerrains[0];
  }, [terrainId, uniqueTerrains]);

  const activeTimeOfDay = useMemo(() => {
    return globalTimes.find((t) => t.id === selectedTimeOfDayId) || globalTimes[0];
  }, [selectedTimeOfDayId]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 via-amber-500 to-yellow-500 bg-clip-text text-transparent">
            Wesnoth Battle Simulator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure unit traits, alignment schedules, and map terrains to run real-time battle loops.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={runSim}
            className="bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-2 cursor-pointer"
          >
            <Swords className="size-4 animate-bounce" />
            Re-roll Simulation
          </Button>
        </div>
      </div>

      {/* Environment Config Section */}
      <Card className="border-border bg-card/40 backdrop-blur-md overflow-hidden shadow-md">
        <CardContent className="p-5 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">
                Combat Environment
              </span>
              <p className="text-xs text-muted-foreground">
                Time of Day affects unit alignment bonuses. Terrains dictate defenses and hit chances.
              </p>
            </div>

            {/* Terrain Combobox */}
            <div className="flex flex-col gap-1.5 w-full md:w-64">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Battle Terrain
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between bg-background/50 hover:bg-background/80 transition-all border-border text-left font-normal cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono bg-muted/30 shrink-0">
                        {selectedTerrain.code}
                      </span>
                      <span className="truncate">{selectedTerrain.name}</span>
                    </div>
                    <RefreshCw className="size-3 shrink-0 opacity-40 animate-spin" style={{ animationDuration: '6s' }} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 border-border bg-card/95 backdrop-blur-md shadow-xl" align="end">
                  <Command>
                    <CommandInput placeholder="Search terrain..." className="border-none focus:ring-0 text-sm py-2" />
                    <CommandList className="max-h-[260px] overflow-y-auto">
                      <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">No terrains found.</CommandEmpty>
                      <CommandGroup>
                        {uniqueTerrains.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={t.id}
                            onSelect={() => setTerrainId(t.id)}
                            className="flex items-center justify-between gap-2 p-2 hover:bg-accent cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span className="text-[10px] text-muted-foreground border border-border px-1 py-0.5 rounded font-mono bg-muted/20 shrink-0">
                                {t.code}
                              </span>
                              <span className="truncate text-sm font-medium">{t.name}</span>
                            </div>
                            {terrainId === t.id && (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5 shrink-0 bg-primary">Selected</Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Time of Day selectors */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 w-full">
            {globalTimes.slice(0, 6).map((time) => {
              const isSelected = selectedTimeOfDayId === time.id;
              let bonusText = 'Neutral';
              let bonusColor = 'text-muted-foreground';
              if (time.lawfulBonus === 25) {
                bonusText = '+25% Lawful / -25% Chaotic';
                bonusColor = 'text-amber-500';
              } else if (time.lawfulBonus === -25) {
                bonusText = '+25% Chaotic / -25% Lawful';
                bonusColor = 'text-indigo-400';
              } else {
                bonusText = '+25% Liminal';
                bonusColor = 'text-emerald-500';
              }

              return (
                <button
                  key={time.id}
                  type="button"
                  onClick={() => setSelectedTimeOfDayId(time.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-200 cursor-pointer bg-background/20",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md scale-[1.02] font-semibold"
                      : "border-border hover:border-muted-foreground/30 hover:bg-background/40"
                  )}
                >
                  <div className="relative size-10 rounded-full overflow-hidden bg-muted/40 flex items-center justify-center border border-border shrink-0">
                    {time.image ? (
                      <img
                        src={wesnothAssetUrl(time.image)}
                        alt=""
                        className="size-10 object-cover"
                      />
                    ) : (
                      <RefreshCw className="size-4 opacity-50" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold">{time.name}</span>
                    <span className={cn("text-[8px] font-medium leading-none", bonusColor)}>{bonusText}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Dual Configuration Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attacker Panel */}
        <UnitConfigPanel
          title="Attacker (Active Unit)"
          unit={attackerUnit}
          state={attackerState}
          allUnits={allUnits}
          selectedUnitId={attackerId}
          onSelectUnit={setAttackerId}
          traits={attackerTraits}
          onSelectTraits={setAttackerTraits}
          hp={attackerHp}
          onHpChange={setAttackerHp}
          slowed={attackerSlowed}
          onSlowedChange={setAttackerSlowed}
          poisoned={attackerPoisoned}
          onPoisonedChange={setAttackerPoisoned}
          attacks={attackerAttacks}
          weaponIndex={attackerWeaponIndex}
          onWeaponIndexChange={setAttackerWeaponIndex}
          terrainId={terrainId}
          isAttacking={true}
        />

        {/* Defender Panel */}
        <UnitConfigPanel
          title="Defender (Defender Counter)"
          unit={defenderUnit}
          state={defenderState}
          allUnits={allUnits}
          selectedUnitId={defenderId}
          onSelectUnit={setDefenderId}
          traits={defenderTraits}
          onSelectTraits={setDefenderTraits}
          hp={defenderHp}
          onHpChange={setDefenderHp}
          slowed={defenderSlowed}
          onSlowedChange={setDefenderSlowed}
          poisoned={defenderPoisoned}
          onPoisonedChange={setDefenderPoisoned}
          attacks={defenderAttacks}
          weaponIndex={defenderWeaponIndex}
          onWeaponIndexChange={setDefenderWeaponIndex}
          terrainId={terrainId}
          isAttacking={false}
        />
      </div>

      {/* Results Dashboard Section */}
      {battleResult && (
        <Card className="border-border bg-card/25 backdrop-blur-md shadow-lg">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-xl font-bold flex items-center justify-between">
              <span>Simulation Outcome</span>
              <Badge
                variant={battleResult.winner === 'attacker' ? 'default' : battleResult.winner === 'defender' ? 'destructive' : 'secondary'}
                className="text-xs px-2.5 py-0.5 rounded-full capitalize font-semibold shadow-sm"
              >
                {battleResult.winner === 'none' ? 'Draw / None Dead' : `${battleResult.winner} Won!`}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-b border-border/40 pb-6 mb-6">
              {/* Attacker Final State */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {attackerUnit?.image && (
                      <img src={wesnothAssetUrl(attackerUnit.image)} alt="" className="size-6 object-contain" />
                    )}
                    {battleResult.attacker.name} <span className="text-xs text-muted-foreground font-normal">({attackerUnit?.name})</span>
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    HP: {battleResult.attacker.hp} / {battleResult.attacker.maxHp}
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50 shadow-inner">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      battleResult.attacker.hp / battleResult.attacker.maxHp > 0.5
                        ? "bg-gradient-to-r from-emerald-500 to-green-400"
                        : battleResult.attacker.hp / battleResult.attacker.maxHp > 0.25
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-600 to-rose-400"
                    )}
                    style={{ width: `${(battleResult.attacker.hp / battleResult.attacker.maxHp) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">Status:</span>
                  {battleResult.attacker.hp <= 0 ? (
                    <Badge variant="destructive" className="text-[9px] py-0 px-1.5 uppercase font-extrabold bg-red-600/80">Killed</Badge>
                  ) : (
                    <>
                      {battleResult.attacker.statuses.slowed && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-purple-500 text-purple-400 bg-purple-500/10">Slowed</Badge>}
                      {battleResult.attacker.statuses.poisoned && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-green-500 text-green-400 bg-green-500/10">Poisoned</Badge>}
                      {battleResult.attacker.statuses.petrified && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-500 text-blue-400 bg-blue-500/10">Petrified</Badge>}
                      {!battleResult.attacker.statuses.slowed && !battleResult.attacker.statuses.poisoned && !battleResult.attacker.statuses.petrified && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1.5 text-zinc-400">Normal</Badge>
                      )}
                    </>
                  )}
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-600/30 text-blue-500 bg-blue-500/5 ml-auto">
                    +{battleResult.attackerXpGained} XP
                  </Badge>
                </div>
              </div>

              {/* Defender Final State */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold flex items-center gap-1.5">
                    {defenderUnit?.image && (
                      <img src={wesnothAssetUrl(defenderUnit.image)} alt="" className="size-6 object-contain" />
                    )}
                    {battleResult.defender.name} <span className="text-xs text-muted-foreground font-normal">({defenderUnit?.name})</span>
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    HP: {battleResult.defender.hp} / {battleResult.defender.maxHp}
                  </span>
                </div>
                <div className="h-3 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50 shadow-inner">
                  <div
                    className={cn(
                      "h-full transition-all duration-500 rounded-full",
                      battleResult.defender.hp / battleResult.defender.maxHp > 0.5
                        ? "bg-gradient-to-r from-emerald-500 to-green-400"
                        : battleResult.defender.hp / battleResult.defender.maxHp > 0.25
                        ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                        : "bg-gradient-to-r from-red-600 to-rose-400"
                    )}
                    style={{ width: `${(battleResult.defender.hp / battleResult.defender.maxHp) * 100}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">Status:</span>
                  {battleResult.defender.hp <= 0 ? (
                    <Badge variant="destructive" className="text-[9px] py-0 px-1.5 uppercase font-extrabold bg-red-600/80">Killed</Badge>
                  ) : (
                    <>
                      {battleResult.defender.statuses.slowed && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-purple-500 text-purple-400 bg-purple-500/10">Slowed</Badge>}
                      {battleResult.defender.statuses.poisoned && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-green-500 text-green-400 bg-green-500/10">Poisoned</Badge>}
                      {battleResult.defender.statuses.petrified && <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-500 text-blue-400 bg-blue-500/10">Petrified</Badge>}
                      {!battleResult.defender.statuses.slowed && !battleResult.defender.statuses.poisoned && !battleResult.defender.statuses.petrified && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1.5 text-zinc-400">Normal</Badge>
                      )}
                    </>
                  )}
                  <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-blue-600/30 text-blue-500 bg-blue-500/5 ml-auto">
                    +{battleResult.defenderXpGained} XP
                  </Badge>
                </div>
              </div>
            </div>

            {/* Results Tabs: Logs vs Math */}
            <Tabs defaultValue="logs" className="w-full">
              <TabsList className="bg-muted/30 border border-border/80 p-0.5 rounded-lg mb-4 flex w-fit">
                <TabsTrigger value="logs" className="text-xs px-4 py-1.5 rounded-md data-[state=active]:bg-background cursor-pointer">
                  Chronological Logs
                </TabsTrigger>
                <TabsTrigger value="math" className="text-xs px-4 py-1.5 rounded-md data-[state=active]:bg-background cursor-pointer">
                  Combat Math Breakdown
                </TabsTrigger>
              </TabsList>

              <TabsContent value="logs">
                <ScrollArea className="h-96 rounded-lg border border-border/80 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300 shadow-inner">
                  <div className="flex flex-col gap-2">
                    <div className="text-zinc-500 border-b border-zinc-800/80 pb-2 flex items-center justify-between">
                      <span>STRIKE-BY-STRIKE CONSOLE LOG [Rounds: {battleResult.roundsRun}]</span>
                      <span className="text-[9px] uppercase tracking-widest text-zinc-600">English-Only Output</span>
                    </div>

                    {battleResult.logs.length === 0 ? (
                      <span className="text-zinc-600 italic">No combat events occurred. Possible range mismatch or petrifaction.</span>
                    ) : (
                      battleResult.logs.map((event, idx) => {
                        // Styles for hit types
                        const isCounter = event.attackerName === battleResult.defender.name;
                        const textColor = event.isDead
                          ? 'text-rose-500 font-extrabold'
                          : event.isHit
                          ? isCounter
                            ? 'text-red-400 font-medium'
                            : 'text-emerald-400 font-medium'
                          : 'text-zinc-500';

                        return (
                          <div key={idx} className={cn("p-1.5 rounded border border-transparent transition-all", event.isDead && "bg-rose-950/20 border-rose-950/40 p-2 my-1", event.isHit && !event.isDead && "hover:bg-zinc-900/30")}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[9px] font-bold text-zinc-600 px-1 bg-zinc-900 border border-zinc-800 rounded shrink-0">
                                R{event.round} S{event.strikeNumber}
                              </span>
                              <span className={cn("text-xs", textColor)}>
                                {event.logMessage}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-zinc-500 pl-11">
                              <span>
                                {battleResult.attacker.name} HP: {event.attackerHpAfter}
                              </span>
                              <span>
                                {battleResult.defender.name} HP: {event.defenderHpAfter}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="math">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Attacker Calculations */}
                  <Card className="border-border/60 bg-muted/10">
                    <CardHeader className="p-4 border-b border-border/40">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <Play className="size-3 text-emerald-500 fill-emerald-500" />
                        {battleResult.attacker.name} Strike Calculations
                      </h3>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col gap-4">
                      {attackerMath ? (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weapon Selection</span>
                            <div className="text-xs p-2 rounded bg-background/50 border border-border/40 font-medium">
                              {battleResult.attackerWeapon?.name} ({battleResult.attackerWeapon?.damage}x{battleResult.attackerWeapon?.number} {battleResult.attackerWeapon?.type}, {battleResult.attackerWeapon?.range})
                              {battleResult.attackerWeapon?.specials && battleResult.attackerWeapon.specials.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {battleResult.attackerWeapon.specials.map((s, i) => (
                                    <Badge key={i} variant="outline" className="text-[9px] py-0 px-1.5 border-amber-500/20 text-amber-500 bg-amber-500/5">{s}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTH Breakdown</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              {attackerMath.cth.breakdown.map((line, i) => (
                                <div key={i} className="text-zinc-400">{line}</div>
                              ))}
                              <div className="text-emerald-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective CTH: {attackerMath.cth.cth}%
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Single Strike Damage</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              {attackerMath.dmg.breakdown.map((line, i) => (
                                <div key={i} className="text-zinc-400">{line}</div>
                              ))}
                              <div className="text-emerald-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective Damage: {attackerMath.dmg.damage}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Strikes Count</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              <div className="text-zinc-400">Base strikes: {battleResult.attackerWeapon?.number}</div>
                              {battleResult.attackerWeapon?.specials?.includes('swarm') && (
                                <div className="text-zinc-400">Swarm scaling: (base strikes) * currentHP ({attackerHp}) / maxHP ({attackerState?.maxHp})</div>
                              )}
                              <div className="text-emerald-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective Strikes: {attackerMath.strikes}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground italic">No weapon active.</div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Defender Calculations */}
                  <Card className="border-border/60 bg-muted/10">
                    <CardHeader className="p-4 border-b border-border/40">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <Play className="size-3 text-red-500 fill-red-500 rotate-180" />
                        {battleResult.defender.name} Strike Calculations
                      </h3>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col gap-4">
                      {defenderMath ? (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weapon Selection</span>
                            <div className="text-xs p-2 rounded bg-background/50 border border-border/40 font-medium">
                              {battleResult.defenderWeapon?.name} ({battleResult.defenderWeapon?.damage}x{battleResult.defenderWeapon?.number} {battleResult.defenderWeapon?.type}, {battleResult.defenderWeapon?.range})
                              {battleResult.defenderWeapon?.specials && battleResult.defenderWeapon.specials.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {battleResult.defenderWeapon.specials.map((s, i) => (
                                    <Badge key={i} variant="outline" className="text-[9px] py-0 px-1.5 border-amber-500/20 text-amber-500 bg-amber-500/5">{s}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">CTH Breakdown</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              {defenderMath.cth.breakdown.map((line, i) => (
                                <div key={i} className="text-zinc-400">{line}</div>
                              ))}
                              <div className="text-red-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective CTH: {defenderMath.cth.cth}%
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Single Strike Damage</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              {defenderMath.dmg.breakdown.map((line, i) => (
                                <div key={i} className="text-zinc-400">{line}</div>
                              ))}
                              <div className="text-red-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective Damage: {defenderMath.dmg.damage}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Strikes Count</span>
                            <div className="font-mono text-[11px] p-2.5 rounded bg-zinc-950/80 border border-zinc-900 flex flex-col gap-1">
                              <div className="text-zinc-400">Base strikes: {battleResult.defenderWeapon?.number}</div>
                              {battleResult.defenderWeapon?.specials?.includes('swarm') && (
                                <div className="text-zinc-400">Swarm scaling: (base strikes) * currentHP ({defenderHp}) / maxHP ({defenderState?.maxHp})</div>
                              )}
                              <div className="text-red-400 font-semibold border-t border-zinc-900 pt-1 mt-1">
                                Effective Strikes: {defenderMath.strikes}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground italic p-6 text-center border border-dashed border-border rounded">
                          No counteractive weapon matched attacker weapon range.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface UnitConfigPanelProps {
  title: string;
  unit: ReturnType<typeof getUnitById>;
  state: CombatUnitState | null;
  allUnits: ReturnType<typeof getAllUnits>;
  selectedUnitId: string;
  onSelectUnit: (id: string) => void;
  traits: string[];
  onSelectTraits: (t: string[]) => void;
  hp: number;
  onHpChange: (hp: number) => void;
  slowed: boolean;
  onSlowedChange: (v: boolean) => void;
  poisoned: boolean;
  onPoisonedChange: (v: boolean) => void;
  attacks: ReturnType<typeof WesnothBattleManager.getModifiedAttacks>;
  weaponIndex: number;
  onWeaponIndexChange: (idx: number) => void;
  terrainId: string;
  isAttacking: boolean;
}

function UnitConfigPanel({
  title,
  unit,
  state,
  allUnits,
  selectedUnitId,
  onSelectUnit,
  traits,
  onSelectTraits,
  hp,
  onHpChange,
  slowed,
  onSlowedChange,
  poisoned,
  onPoisonedChange,
  attacks,
  weaponIndex,
  onWeaponIndexChange,
  terrainId,
  isAttacking,
}: UnitConfigPanelProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return allUnits.slice(0, 40);
    const lower = search.toLowerCase();
    return allUnits.filter((u) => u.name.toLowerCase().includes(lower) || u.id.toLowerCase().includes(lower));
  }, [search, allUnits]);

  const selectedUnit = useMemo(() => {
    return allUnits.find((u) => u.id === selectedUnitId);
  }, [selectedUnitId, allUnits]);

  // Compute terrain defense rating for this unit on the selected terrain
  const terrainStats = useMemo(() => {
    if (!selectedUnit) return { defenseChanceToHit: 100, movementCost: 99 };
    return WesnothBattleManager.resolveTerrainValues(selectedUnit, terrainId);
  }, [selectedUnit, terrainId]);

  const toggleTrait = (traitId: string) => {
    if (traits.includes(traitId)) {
      onSelectTraits(traits.filter((t) => t !== traitId));
    } else if (traits.length < 2) {
      onSelectTraits([...traits, traitId]);
    }
  };

  return (
    <Card className="border-border bg-card/45 backdrop-blur-md shadow-md overflow-hidden flex flex-col h-full">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base font-bold flex items-center justify-between">
          <span>{title}</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize text-muted-foreground bg-muted/40">
            {selectedUnit?.alignment}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-5 flex-1 justify-between">
        <div className="flex flex-col gap-4">
          {/* Unit selection popover */}
          <div className="flex flex-col gap-1.5 w-full">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit Type</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between bg-background/50 hover:bg-background/80 transition-all border-border text-left font-normal cursor-pointer"
                >
                  {selectedUnit ? (
                    <div className="flex items-center gap-2 truncate">
                      {selectedUnit.image && (
                        <img
                          src={wesnothAssetUrl(selectedUnit.image)}
                          alt=""
                          className="size-5 object-contain shrink-0"
                        />
                      )}
                      <span className="truncate">{selectedUnit.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">(Lv. {selectedUnit.level})</span>
                    </div>
                  ) : (
                    "Select unit..."
                  )}
                  <RefreshCw className="size-3 shrink-0 opacity-40" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 border-border bg-card/95 backdrop-blur-md shadow-xl" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search unit..."
                    value={search}
                    onValueChange={setSearch}
                    className="border-none focus:ring-0 text-sm py-2"
                  />
                  <CommandList className="max-h-[300px] overflow-y-auto">
                    {filtered.length === 0 ? (
                      <CommandEmpty className="p-3 text-xs text-muted-foreground text-center">No units found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {filtered.map((unit) => (
                          <CommandItem
                            key={unit.id}
                            value={unit.id}
                            onSelect={() => {
                              onSelectUnit(unit.id);
                              setOpen(false);
                              setSearch('');
                            }}
                            className="flex items-center justify-between gap-2 p-2 hover:bg-accent cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate">
                              {unit.image && (
                                <img
                                  src={wesnothAssetUrl(unit.image)}
                                  alt=""
                                  className="size-6 object-contain shrink-0"
                                />
                              )}
                              <span className="truncate text-sm font-medium">{unit.name}</span>
                              <span className="text-xs text-muted-foreground shrink-0">(Lv. {unit.level})</span>
                            </div>
                            {selectedUnitId === unit.id && (
                              <Badge variant="default" className="text-[10px] py-0 px-1.5 shrink-0 bg-primary">Selected</Badge>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Unit Quick Info & Sprite */}
          {selectedUnit && state && (
            <div className="flex items-center gap-4 bg-muted/20 p-3 rounded-lg border border-border/40">
              <div className="size-16 shrink-0 bg-background/50 border border-border/60 rounded-md overflow-hidden flex items-center justify-center">
                {selectedUnit.image ? (
                  <img
                    src={wesnothAssetUrl(selectedUnit.image)}
                    alt={selectedUnit.name}
                    className="size-16 object-contain"
                  />
                ) : (
                  <RefreshCw className="size-6 opacity-30" />
                )}
              </div>
              <div className="flex flex-col gap-1 w-full min-w-0">
                <span className="text-sm font-semibold truncate leading-tight">{selectedUnit.name}</span>
                <span className="text-[11px] text-muted-foreground">Race: {selectedUnit.race} | Movetype: {selectedUnit.movementType}</span>
                <div className="flex gap-2 mt-1">
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 flex items-center gap-0.5 border border-border bg-background/50">
                    <Heart className="size-2 text-rose-500 fill-rose-500" />
                    HP: {state.maxHp}
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 flex items-center gap-0.5 border border-border bg-background/50">
                    <Shield className="size-2 text-blue-500" />
                    Def: {100 - terrainStats.defenseChanceToHit}%
                  </Badge>
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 flex items-center gap-0.5 border border-border bg-background/50">
                    <Zap className="size-2 text-amber-500 fill-amber-500" />
                    Cost: {selectedUnit.cost}g
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <Separator className="border-border/30 my-1" />

          {/* Trait Selection */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Traits Selection (Pick Max 2)
            </span>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_TRAITS.map((trait) => {
                const isSelected = traits.includes(trait.id);
                const isDisabled = !isSelected && traits.length >= 2;
                return (
                  <TooltipProvider key={trait.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => toggleTrait(trait.id)}
                          className={cn(
                            "px-2.5 py-1 text-xs rounded-full border transition-all duration-200 flex items-center gap-1 font-medium cursor-pointer",
                            isSelected
                              ? "bg-primary/20 border-primary text-primary shadow-sm scale-105"
                              : "bg-muted/40 border-border text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                            isDisabled && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {trait.name}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-card border border-border text-card-foreground p-2.5 text-xs max-w-xs shadow-lg rounded-md">
                        {trait.desc}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>

          <Separator className="border-border/30 my-1" />

          {/* Hitpoints Slider & Overrides */}
          {state && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Initial Hitpoints Override
                </span>
                <span className="text-xs font-bold font-mono px-1.5 py-0.5 rounded bg-muted/60 border border-border">
                  {hp} / {state.maxHp}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max={state.maxHp}
                  value={hp}
                  onChange={(e) => onHpChange(Number(e.target.value))}
                  className="flex-1 accent-primary h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <Input
                  type="number"
                  min="1"
                  max={state.maxHp}
                  value={hp}
                  onChange={(e) => onHpChange(Math.max(1, Math.min(state.maxHp, Number(e.target.value))))}
                  className="w-16 h-8 text-xs font-mono text-center px-1 py-0.5 bg-background border-border"
                />
              </div>
            </div>
          )}

          <Separator className="border-border/30 my-1" />

          {/* Status overrides */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status Effects Overrides
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={slowed}
                  onChange={(e) => onSlowedChange(e.target.checked)}
                  className="size-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <span>Slowed (halves damage)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/80 hover:text-foreground transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={poisoned}
                  onChange={(e) => onPoisonedChange(e.target.checked)}
                  className="size-3.5 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                />
                <span>Poisoned (immune undead)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Weapon Override Select */}
        {selectedUnit && (
          <div className="mt-4 pt-4 border-t border-border/40 flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Attack Weapon
            </span>
            <Select value={weaponIndex.toString()} onValueChange={(val) => onWeaponIndexChange(Number(val))}>
              <SelectTrigger className="w-full bg-background/50 border-border text-xs">
                <SelectValue placeholder="Auto-Select Weapon" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border text-card-foreground">
                <SelectItem value="-1" className="text-xs font-semibold text-primary">Auto-Select Best EV</SelectItem>
                {attacks.map((att, idx) => (
                  <SelectItem key={idx} value={idx.toString()} className="text-xs">
                    {att.name} ({att.damage}x{att.number} {att.type}, {att.range})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
