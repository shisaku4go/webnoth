import type {
  DamageType,
  WesnothMovetype,
  WesnothRace,
  WesnothUnitType,
  WesnothEra,
  WesnothFaction,
} from '@webnoth/wesnoth-data';
import { movetypes } from '@webnoth/wesnoth-data/movetypes';
import { races } from '@webnoth/wesnoth-data/races';
import { unitTypes } from '@webnoth/wesnoth-data/units';
import { eras } from '@webnoth/wesnoth-data/eras';
import { factions } from '@webnoth/wesnoth-data/factions';

// Re-export types for convenience
export type {
  DamageType,
  WesnothMovetype,
  WesnothRace,
  WesnothUnitType,
  WesnothEra,
  WesnothFaction,
};

// === Lookup indexes (computed once at module load) ===

const unitById = new Map<string, WesnothUnitType>(
  unitTypes.map((u) => [u.id, u]),
);

const raceById = new Map<string, WesnothRace>(races.map((r) => [r.id, r]));

const movetypeByName = new Map<string, WesnothMovetype>(
  movetypes.map((m) => [m.name, m]),
);

/** Reverse advancement lookup: unitId → list of units that advance to it */
const advancesFromIndex = new Map<string, string[]>();
for (const unit of unitTypes) {
  for (const targetId of unit.advancesTo) {
    if (targetId === 'null') continue;
    const existing = advancesFromIndex.get(targetId);
    if (existing) {
      existing.push(unit.id);
    } else {
      advancesFromIndex.set(targetId, [unit.id]);
    }
  }
}

/** Race → unit count */
const unitCountByRace = new Map<string, number>();
for (const unit of unitTypes) {
  if (unit.doNotList || unit.hideHelp) continue;
  unitCountByRace.set(unit.race, (unitCountByRace.get(unit.race) ?? 0) + 1);
}

const factionsByEra = new Map<string, WesnothFaction[]>();
for (const faction of factions) {
  const existing = factionsByEra.get(faction.eraId) ?? [];
  existing.push(faction);
  factionsByEra.set(faction.eraId, existing);
}

/** Pre-compute transitive closure of all unit IDs in a faction (leaders + recruits + advancements) */
const factionUnitsMap = new Map<string, Set<string>>();
for (const faction of factions) {
  const key = `${faction.eraId}:${faction.id}`;
  const unitIds = new Set<string>();
  const queue = [...faction.recruit, ...faction.leader];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (unitIds.has(id)) continue;

    unitIds.add(id);

    const unit = unitById.get(id);
    if (unit && unit.advancesTo) {
      for (const adv of unit.advancesTo) {
        if (adv && adv !== 'null' && !unitIds.has(adv)) {
          queue.push(adv);
        }
      }
    }
  }
  factionUnitsMap.set(key, unitIds);
}

// === Public API ===

export function getAllEras(): WesnothEra[] {
  return eras;
}

export function getFactionsByEra(eraId: string): WesnothFaction[] {
  return factionsByEra.get(eraId) ?? [];
}

export function getFactionUnits(
  eraId: string,
  factionId: string,
): WesnothUnitType[] {
  const key = `${eraId}:${factionId}`;
  const ids = factionUnitsMap.get(key);
  if (!ids) return [];
  const result: WesnothUnitType[] = [];
  for (const id of ids) {
    const u = unitById.get(id);
    if (u && !u.doNotList && !u.hideHelp) {
      result.push(u);
    }
  }
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function getAllUnits(): WesnothUnitType[] {
  return unitTypes.filter((u) => !u.doNotList && !u.hideHelp);
}

export function getUnitById(id: string): WesnothUnitType | undefined {
  return unitById.get(id);
}

export function getUnitsByRace(raceId: string): WesnothUnitType[] {
  return unitTypes.filter(
    (u) => u.race === raceId && !u.doNotList && !u.hideHelp,
  );
}

export function getAllRaces(): WesnothRace[] {
  return races;
}

export function getRaceById(id: string): WesnothRace | undefined {
  return raceById.get(id);
}

export function getMovetypeByName(name: string): WesnothMovetype | undefined {
  return movetypeByName.get(name);
}

export function getAdvancesFrom(unitId: string): string[] {
  return advancesFromIndex.get(unitId) ?? [];
}

export function getUnitCountByRace(raceId: string): number {
  return unitCountByRace.get(raceId) ?? 0;
}

/**
 * Search units by name (case-insensitive substring match).
 */
export function searchUnits(query: string): WesnothUnitType[] {
  if (!query.trim()) return getAllUnits();
  const lower = query.toLowerCase();
  return unitTypes.filter(
    (u) => !u.doNotList && !u.hideHelp && u.name.toLowerCase().includes(lower),
  );
}

// === Data computation helpers ===

const DAMAGE_TYPES: DamageType[] = [
  'blade',
  'pierce',
  'impact',
  'fire',
  'cold',
  'arcane',
];

export function getDamageTypes(): DamageType[] {
  return DAMAGE_TYPES;
}

/**
 * Compute effective resistance for a unit (movetype base + unit overrides).
 * Returns values in "resistance percentage" format: 100 - rawValue
 * Positive = resistant, negative = vulnerable
 */
export function getEffectiveResistance(
  unit: WesnothUnitType,
): Record<DamageType, number> {
  const movetype = movetypeByName.get(unit.movementType);
  const base = movetype?.resistance ?? {};

  const result = {} as Record<DamageType, number>;
  for (const dtype of DAMAGE_TYPES) {
    const raw = (base[dtype] as number | undefined) ?? 100;
    result[dtype] = 100 - raw;
  }
  return result;
}

/**
 * Compute effective movement costs (movetype base + unit overrides).
 * Returns Record<terrain, cost>. Missing terrain = impassable.
 */
export function getEffectiveMoveCosts(
  unit: WesnothUnitType,
): Record<string, number> {
  const movetype = movetypeByName.get(unit.movementType);
  const base = { ...(movetype?.movementCosts ?? {}) };

  if (unit.movementCostOverrides) {
    for (const [terrain, cost] of Object.entries(unit.movementCostOverrides)) {
      base[terrain] = cost;
    }
  }
  return base;
}

/**
 * Compute effective defense (movetype base + unit overrides).
 * Returns Record<terrain, defensePercentage> where value = 100 - rawValue.
 * Higher = better defense.
 */
export function getEffectiveDefense(
  unit: WesnothUnitType,
): Record<string, number> {
  const movetype = movetypeByName.get(unit.movementType);
  const base = { ...(movetype?.defense ?? {}) };

  if (unit.defenseOverrides) {
    for (const [terrain, def] of Object.entries(unit.defenseOverrides)) {
      base[terrain] = def;
    }
  }

  const result: Record<string, number> = {};
  for (const [terrain, raw] of Object.entries(base)) {
    // Defense values: raw = % chance to be hit, convert to defense %
    result[terrain] = 100 - Math.abs(raw);
  }
  return result;
}

/**
 * Format terrain key to display name.
 * e.g. "shallow_water" → "Shallow Water"
 */
export function formatTerrainName(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Compute total unit count.
 */
export function getTotalUnitCount(): number {
  return unitTypes.filter((u) => !u.doNotList && !u.hideHelp).length;
}
