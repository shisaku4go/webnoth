import type {
  WesnothAttack,
  WesnothTerrain,
  WesnothUnitType,
} from '@webnoth/wesnoth-data';
import { movetypes } from '@webnoth/wesnoth-data/movetypes';
import { terrains as globalTerrains } from '@webnoth/wesnoth-data/terrains';
import { times as globalTimes } from '@webnoth/wesnoth-data/times';
import { traits as globalTraits } from '@webnoth/wesnoth-data/traits';
import { WesnothCombatCore } from './combat-core';
import type {
  BattleResult,
  CombatContext,
  CombatUnitState,
  StrikeEvent,
} from './types';

// Secure random function
function secureRandom(): number {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return array[0] / 4294967296;
}

// Pre-create lookups
const terrainByCode = new Map<string, WesnothTerrain>(
  globalTerrains.map((t) => [t.code, t]),
);
const terrainById = new Map<string, WesnothTerrain>(
  globalTerrains.map((t) => [t.id, t]),
);
const traitById = new Map(globalTraits.map((t) => [t.id, t]));
const movetypeByName = new Map(movetypes.map((m) => [m.name, m]));
const timeOfDayById = new Map(globalTimes.map((t) => [t.id, t]));

// Default list of fantasy names for fallback
const RANDOM_NAMES = [
  'Galdor',
  'Dufool',
  "Li'sar",
  'Konrad',
  'Delfador',
  'Kalenz',
  'Chantal',
  'Moremiras',
  'Aethyr',
  'Gwiti',
  'Mal Keshar',
  "Kapou'e",
  'Grüu',
  'Barak',
  'Lady Jessica',
  'Haldric',
  'Lethalia',
  'Efraim',
  'Argan',
  'Krell',
];

export const WesnothBattleManager = {
  /**
   * Resolves detailed terrain to base keys in a unit's movement type.
   * Handles C++ style recursive aliasOf / defaultBase resolution.
   */
  resolveTerrainBaseIds(terrainId: string): string[] {
    const terrain = terrainById.get(terrainId);
    if (!terrain) return ['flat'];

    const visited = new Set<string>();
    const baseKeys = new Set([
      'deep_water',
      'shallow_water',
      'reef',
      'swamp_water',
      'flat',
      'sand',
      'forest',
      'hills',
      'mountains',
      'village',
      'castle',
      'cave',
      'frozen',
      'fungus',
    ]);

    const resolve = (t: WesnothTerrain): string[] => {
      if (visited.has(t.id)) return [];
      visited.add(t.id);

      if (baseKeys.has(t.id)) {
        return [t.id];
      }

      const codeTerrain = terrainByCode.get(t.code);
      if (codeTerrain && baseKeys.has(codeTerrain.id)) {
        return [codeTerrain.id];
      }

      const results: string[] = [];

      // 1. Resolve aliasOf
      if (t.aliasOf && t.aliasOf.length > 0) {
        for (const aliasCode of t.aliasOf) {
          const aliasTerrain = terrainByCode.get(aliasCode);
          if (aliasTerrain) {
            results.push(...resolve(aliasTerrain));
          }
        }
        if (results.length > 0) return results;
      }

      // 2. Resolve defaultBase
      if (t.defaultBase) {
        const baseTerrain =
          terrainByCode.get(t.defaultBase) || terrainById.get(t.defaultBase);
        if (baseTerrain) {
          results.push(...resolve(baseTerrain));
        }
        if (results.length > 0) return results;
      }

      return [t.id];
    };

    const resolved = resolve(terrain);
    return resolved.length > 0 ? resolved : ['flat'];
  },

  /**
   * Calculates the best defense rating (chance to be hit, lower = better)
   * and movement cost (lower = better) for a unit on a given terrain.
   */
  resolveTerrainValues(
    unit: WesnothUnitType,
    terrainId: string,
  ): { defenseChanceToHit: number; movementCost: number } {
    const baseIds = WesnothBattleManager.resolveTerrainBaseIds(terrainId);
    const movetype = movetypeByName.get(unit.movementType);

    let bestDefenseChanceToHit = 100;
    let bestMovementCost = 99;

    for (const baseId of baseIds) {
      // 1. Defense Resolution
      let defenseRaw = 100;
      if (
        unit.defenseOverrides &&
        unit.defenseOverrides[baseId] !== undefined
      ) {
        defenseRaw = unit.defenseOverrides[baseId];
      } else if (movetype?.defense && movetype.defense[baseId] !== undefined) {
        defenseRaw = movetype.defense[baseId];
      }
      // Note: defense values in WML represent chance to be hit. E.g., 60 means 60% chance to be hit.
      // Unit prefers a lower chance to be hit.
      bestDefenseChanceToHit = Math.min(
        bestDefenseChanceToHit,
        Math.abs(defenseRaw),
      );

      // 2. Movement Cost Resolution
      let moveCostRaw = 99;
      if (
        unit.movementCostOverrides &&
        unit.movementCostOverrides[baseId] !== undefined
      ) {
        moveCostRaw = unit.movementCostOverrides[baseId];
      } else if (
        movetype?.movementCosts &&
        movetype.movementCosts[baseId] !== undefined
      ) {
        moveCostRaw = movetype.movementCosts[baseId];
      }
      bestMovementCost = Math.min(bestMovementCost, moveCostRaw);
    }

    return {
      defenseChanceToHit: bestDefenseChanceToHit,
      movementCost: bestMovementCost === 99 ? 1 : bestMovementCost,
    };
  },

  /**
   * Initializes a CombatUnitState from a WesnothUnitType with recruit logic.
   */
  initializeUnitState(
    unit: WesnothUnitType,
    traitOverrides?: string[],
    genderOverride?: string,
  ): CombatUnitState {
    const gender =
      genderOverride ||
      (unit.gender && unit.gender.length > 0
        ? unit.gender[Math.floor(secureRandom() * unit.gender.length)]
        : 'male');

    const name = RANDOM_NAMES[Math.floor(secureRandom() * RANDOM_NAMES.length)];

    // Traits Setup
    let chosenTraits: string[] = [];
    if (traitOverrides) {
      chosenTraits = [...traitOverrides];
    } else {
      // Fallback: Pick 2 random traits (simulate recruit logic)
      // Usually units can have "strong", "quick", "intelligent", "resilient", "dextrous"
      const candidateTraits = ['strong', 'quick', 'intelligent', 'resilient'];
      if (unit.attacks.some((a) => a.range === 'ranged')) {
        candidateTraits.push('dextrous');
      }
      // Shuffle & pick 2
      const shuffled = [...candidateTraits].sort(() => 0.5 - secureRandom());
      chosenTraits = shuffled.slice(0, 2);
    }

    // Clone base stats
    let maxHp = unit.hitpoints;
    const alignment = unit.alignment;
    const traitsList = [...chosenTraits];
    let maxXp = unit.experience;

    // Inject resistance traits based on unit's movetype
    const movetype = movetypeByName.get(unit.movementType);
    const damageTypes = ['blade', 'pierce', 'impact', 'fire', 'cold', 'arcane'];
    for (const dtype of damageTypes) {
      let raw = 100;
      if (movetype?.resistance && movetype.resistance[dtype] !== undefined) {
        raw = movetype.resistance[dtype];
      }
      traitsList.push(`resistance_${dtype}_${raw}`);
    }

    // Apply trait effects
    for (const traitId of chosenTraits) {
      const traitData = traitById.get(traitId);
      if (!traitData) continue;

      for (const effect of traitData.effects) {
        if (effect.applyTo === 'hitpoints') {
          let add = 0;
          if (effect.times === 'per level') {
            const val = effect.increaseTotal ? Number(effect.increaseTotal) : 0;
            add = val * Math.max(0, unit.level - 1);
          } else {
            if (
              typeof effect.increaseTotal === 'string' &&
              effect.increaseTotal.endsWith('%')
            ) {
              const pct = parseInt(effect.increaseTotal, 10);
              add = Math.floor((unit.hitpoints * pct) / 100);
            } else if (effect.increaseTotal !== undefined) {
              add = Number(effect.increaseTotal);
            }
          }
          maxHp += add;
        } else if (effect.applyTo === 'max_experience') {
          let add = 0;
          if (
            typeof effect.increase === 'string' &&
            effect.increase.endsWith('%')
          ) {
            const pct = parseInt(effect.increase, 10);
            add = Math.floor((unit.experience * pct) / 100);
          } else if (effect.increase !== undefined) {
            add = Number(effect.increase);
          }
          maxXp += add;
        }
      }
    }

    return {
      unitTypeId: unit.id,
      name,
      gender,
      level: unit.level,
      maxHp,
      hp: maxHp,
      alignment,
      traits: traitsList,
      statuses: {
        poisoned: false,
        slowed: false,
        petrified: false,
      },
      activeWeaponIndex: -1,
      xp: 0,
      maxXp,
    };
  },

  /**
   * Applies trait damage/strikes modifications to attacks.
   */
  getModifiedAttacks(
    unit: WesnothUnitType,
    state: CombatUnitState,
  ): WesnothAttack[] {
    // Deep clone base attacks
    const modifiedAttacks = unit.attacks.map((a) => ({
      ...a,
      specials: a.specials ? [...a.specials] : [],
    }));

    for (const traitId of state.traits) {
      const traitData = traitById.get(traitId);
      if (!traitData) continue;

      for (const effect of traitData.effects) {
        if (effect.applyTo === 'attack') {
          for (const attack of modifiedAttacks) {
            // Check filters (e.g. range, type)
            if (effect.range && attack.range !== effect.range) continue;

            if (effect.increaseDamage) {
              const add = Number(effect.increaseDamage);
              attack.damage += add;
            }
            if (effect.increaseTotal) {
              const add = Number(effect.increaseTotal);
              attack.number += add;
            }
          }
        }
      }
    }

    return modifiedAttacks;
  },

  /**
   * Automatically selects the best weapon for the attacker and matching-range counter for defender.
   */
  autoSelectWeapons(
    attacker: CombatUnitState,
    defender: CombatUnitState,
    attackerAttacks: WesnothAttack[],
    defenderAttacks: WesnothAttack[],
    terrainId: string,
    context: CombatContext,
  ): { attackerWeaponIndex: number; defenderWeaponIndex: number } {
    let bestAttackerIdx = 0;
    let bestDefenderIdxForAttacker = -1;
    let highestExpectedVal = -99999;

    const defenderUnitType = { movementType: 'smallfoot' } as WesnothUnitType; // Placeholder fallback
    const defenderDefense = WesnothBattleManager.resolveTerrainValues(
      defenderUnitType,
      terrainId,
    ).defenseChanceToHit;

    for (let aIdx = 0; aIdx < attackerAttacks.length; aIdx++) {
      const aWep = attackerAttacks[aIdx];
      // Find defender counters
      const counterIdxs = defenderAttacks
        .map((w, idx) => (w.range === aWep.range ? idx : -1))
        .filter((idx) => idx !== -1);

      const dIdx = counterIdxs.length > 0 ? counterIdxs[0] : -1; // Pick first matching counter range for simplicity in EV calculation
      const dWep = dIdx !== -1 ? defenderAttacks[dIdx] : null;

      // Pure stateless EV score: CTH * Damage * Strikes
      const attackerCth = WesnothCombatCore.calculateCTH(
        attacker,
        defender,
        aWep,
        defenderDefense,
      ).cth;
      const attackerDamage = WesnothCombatCore.calculateDamage(
        attacker,
        defender,
        aWep,
        dWep,
        context,
        true,
      ).damage;
      const attackerStrikes = WesnothCombatCore.calculateSwarmBlows(
        aWep,
        attacker.hp,
        attacker.maxHp,
      );
      const attackerEV = (attackerCth / 100) * attackerDamage * attackerStrikes;

      let defenderEV = 0;
      if (dWep) {
        const defenderCth = WesnothCombatCore.calculateCTH(
          defender,
          attacker,
          dWep,
          40,
        ).cth; // fallback defense 40
        const defenderDamage = WesnothCombatCore.calculateDamage(
          defender,
          attacker,
          dWep,
          aWep,
          context,
          false,
        ).damage;
        const defenderStrikes = WesnothCombatCore.calculateSwarmBlows(
          dWep,
          defender.hp,
          defender.maxHp,
        );
        defenderEV = (defenderCth / 100) * defenderDamage * defenderStrikes;
      }

      const score = attackerEV - defenderEV * 0.5; // weight opponent counter slightly less
      if (score > highestExpectedVal) {
        highestExpectedVal = score;
        bestAttackerIdx = aIdx;
        bestDefenderIdxForAttacker = dIdx;
      }
    }

    return {
      attackerWeaponIndex: bestAttackerIdx,
      defenderWeaponIndex: bestDefenderIdxForAttacker,
    };
  },

  /**
   * Executes a full combat simulation between the attacker and defender.
   */
  runSimulation(
    attackerBase: WesnothUnitType,
    defenderBase: WesnothUnitType,
    options: {
      attackerTraits?: string[];
      defenderTraits?: string[];
      attackerWeaponIndex?: number;
      defenderWeaponIndex?: number;
      terrainId: string;
      timeOfDayId: string;
      attackerHpOverride?: number;
      defenderHpOverride?: number;
      attackerSlowed?: boolean;
      defenderSlowed?: boolean;
      attackerPoisoned?: boolean;
      defenderPoisoned?: boolean;
      attackerId?: string;
      defenderId?: string;
    },
  ): BattleResult {
    // 1. Initialize states
    const attacker = WesnothBattleManager.initializeUnitState(
      attackerBase,
      options.attackerTraits,
    );
    const defender = WesnothBattleManager.initializeUnitState(
      defenderBase,
      options.defenderTraits,
    );

    // Apply overrides
    if (options.attackerHpOverride !== undefined)
      attacker.hp = Math.min(attacker.maxHp, options.attackerHpOverride);
    if (options.defenderHpOverride !== undefined)
      defender.hp = Math.min(defender.maxHp, options.defenderHpOverride);
    if (options.attackerSlowed !== undefined)
      attacker.statuses.slowed = options.attackerSlowed;
    if (options.defenderSlowed !== undefined)
      defender.statuses.slowed = options.defenderSlowed;
    if (options.attackerPoisoned !== undefined)
      attacker.statuses.poisoned = options.attackerPoisoned;
    if (options.defenderPoisoned !== undefined)
      defender.statuses.poisoned = options.defenderPoisoned;

    // Apply modified attacks from traits
    const attackerAttacks = WesnothBattleManager.getModifiedAttacks(
      attackerBase,
      attacker,
    );
    const defenderAttacks = WesnothBattleManager.getModifiedAttacks(
      defenderBase,
      defender,
    );

    // Context resolution
    const tod = timeOfDayById.get(options.timeOfDayId) || globalTimes[0];
    const context: CombatContext = {
      terrainId: options.terrainId,
      timeOfDayId: tod.id,
      lawfulBonus: tod.lawfulBonus || 0,
    };

    // Auto-select or manual override weapon selection
    let aWepIdx = options.attackerWeaponIndex ?? -1;
    let dWepIdx = options.defenderWeaponIndex ?? -1;

    if (aWepIdx === -1) {
      const selected = WesnothBattleManager.autoSelectWeapons(
        attacker,
        defender,
        attackerAttacks,
        defenderAttacks,
        options.terrainId,
        context,
      );
      aWepIdx = selected.attackerWeaponIndex;
      dWepIdx = selected.defenderWeaponIndex;
    } else if (dWepIdx === -1) {
      // Manual attacker weapon selected, choose matching range for defender
      const aWep = attackerAttacks[aWepIdx];
      dWepIdx = defenderAttacks.findIndex((w) => w.range === aWep.range);
    }

    attacker.activeWeaponIndex = aWepIdx;
    defender.activeWeaponIndex = dWepIdx;

    const aWep = attackerAttacks[aWepIdx] || null;
    const dWep = dWepIdx !== -1 ? defenderAttacks[dWepIdx] : null;

    const logs: StrikeEvent[] = [];
    let winner: 'attacker' | 'defender' | 'none' = 'none';
    let roundsRun = 0;

    if (!aWep) {
      return {
        attacker,
        defender,
        attackerWeapon: null,
        defenderWeapon: null,
        logs: [],
        winner: 'none',
        roundsRun: 0,
        attackerXpGained: 0,
        defenderXpGained: 0,
      };
    }

    // Resolve defense & hit chance values
    const attackerDefenseVal = WesnothBattleManager.resolveTerrainValues(
      attackerBase,
      options.terrainId,
    ).defenseChanceToHit;
    const defenderDefenseVal = WesnothBattleManager.resolveTerrainValues(
      defenderBase,
      options.terrainId,
    ).defenseChanceToHit;

    // First Strike ordering
    // Unit with firststrike strikes first. If both or neither, attacker strikes first.
    const aHasFirstStrike = aWep.specials?.includes('firststrike') || false;
    const dHasFirstStrike = dWep?.specials?.includes('firststrike') || false;

    let attackerStrikesFirst = true;
    if (dHasFirstStrike && !aHasFirstStrike) {
      attackerStrikesFirst = false;
    }

    // Combat Specials Checking
    const isBerserk =
      aWep.specials?.includes('berserk') || dWep?.specials?.includes('berserk');
    const maxRounds = isBerserk ? 30 : 1;

    const defenderIsUndead =
      defenderBase.race === 'undead' || defender.traits.includes('undead');
    const attackerIsUndead =
      attackerBase.race === 'undead' || attacker.traits.includes('undead');

    // Executing the rounds
    for (let r = 1; r <= maxRounds; r++) {
      roundsRun = r;
      if (attacker.hp <= 0 || defender.hp <= 0) break;
      if (attacker.statuses.petrified || defender.statuses.petrified) break;

      const aStrikesCount = WesnothCombatCore.calculateSwarmBlows(
        aWep,
        attacker.hp,
        attacker.maxHp,
      );
      const dStrikesCount = dWep
        ? WesnothCombatCore.calculateSwarmBlows(
            dWep,
            defender.hp,
            defender.maxHp,
          )
        : 0;

      let aStrikesLeft = aStrikesCount;
      let dStrikesLeft = dStrikesCount;
      let strikeNumber = 1;

      // Executing strikes alternatively
      while (aStrikesLeft > 0 || dStrikesLeft > 0) {
        if (attacker.hp <= 0 || defender.hp <= 0) break;
        if (attacker.statuses.petrified || defender.statuses.petrified) break;

        const isAttackerTurn = attackerStrikesFirst
          ? aStrikesLeft >= dStrikesLeft && aStrikesLeft > 0
          : dStrikesLeft < aStrikesLeft && aStrikesLeft > 0;

        if (isAttackerTurn || (aStrikesLeft > 0 && dStrikesLeft === 0)) {
          // Attacker strikes defender
          aStrikesLeft--;

          const cthRes = WesnothCombatCore.calculateCTH(
            attacker,
            defender,
            aWep,
            defenderDefenseVal,
          );
          const dmgRes = WesnothCombatCore.calculateDamage(
            attacker,
            defender,
            aWep,
            dWep,
            context,
            true,
          );

          const roll = secureRandom() * 100;
          const isHit = roll < cthRes.cth;

          let damage = 0;
          let drained = 0;
          const defenderHpBefore = defender.hp;

          let msg = '';
          if (isHit) {
            damage = dmgRes.damage;
            defender.hp = Math.max(0, defender.hp - damage);

            // Health Draining
            drained = WesnothCombatCore.calculateDrain(
              damage,
              aWep,
              defenderIsUndead,
            );
            if (drained > 0) {
              attacker.hp = Math.min(attacker.maxHp, attacker.hp + drained);
            }

            // Specials Application
            const statusEffectsApplied: string[] = [];
            if (aWep.specials?.includes('poison') && !defenderIsUndead) {
              defender.statuses.poisoned = true;
              statusEffectsApplied.push('POISONED');
            }
            if (aWep.specials?.includes('slow')) {
              defender.statuses.slowed = true;
              statusEffectsApplied.push('SLOWED');
            }
            if (aWep.specials?.includes('petrify')) {
              defender.statuses.petrified = true;
              statusEffectsApplied.push('PETRIFIED');
            }

            const statusStr =
              statusEffectsApplied.length > 0
                ? ` [${statusEffectsApplied.join(', ')}]`
                : '';
            msg = `${attacker.name} hit ${defender.name} with ${aWep.name} dealing ${damage} damage (roll: ${Math.floor(roll)} < CTH: ${cthRes.cth}%).${drained > 0 ? ` Drained ${drained} HP.` : ''}${statusStr}`;
          } else {
            msg = `${attacker.name} missed ${defender.name} with ${aWep.name} (roll: ${Math.floor(roll)} >= CTH: ${cthRes.cth}%).`;
          }

          logs.push({
            round: r,
            strikeNumber: strikeNumber++,
            attackerName: attacker.name,
            defenderName: defender.name,
            attackerId: options.attackerId,
            defenderId: options.defenderId,
            weaponName: aWep.name,
            isHit,
            damage,
            drained,
            attackerHpBefore: attacker.hp - (isHit ? drained : 0),
            attackerHpAfter: attacker.hp,
            defenderHpBefore,
            defenderHpAfter: defender.hp,
            attackerSlowed: attacker.statuses.slowed,
            defenderSlowed: defender.statuses.slowed,
            defenderPoisoned: defender.statuses.poisoned,
            defenderPetrified: defender.statuses.petrified,
            isDead: defender.hp <= 0,
            logMessage: msg,
          });

          if (defender.hp <= 0) {
            winner = 'attacker';
            break;
          }
        } else if (dWep && dStrikesLeft > 0) {
          // Defender counter-strikes attacker
          dStrikesLeft--;

          const cthRes = WesnothCombatCore.calculateCTH(
            defender,
            attacker,
            dWep,
            attackerDefenseVal,
          );
          const dmgRes = WesnothCombatCore.calculateDamage(
            defender,
            attacker,
            dWep,
            aWep,
            context,
            false,
          );

          const roll = secureRandom() * 100;
          const isHit = roll < cthRes.cth;

          let damage = 0;
          let drained = 0;
          const attackerHpBefore = attacker.hp;

          let msg = '';
          if (isHit) {
            damage = dmgRes.damage;
            attacker.hp = Math.max(0, attacker.hp - damage);

            // Draining
            drained = WesnothCombatCore.calculateDrain(
              damage,
              dWep,
              attackerIsUndead,
            );
            if (drained > 0) {
              defender.hp = Math.min(defender.maxHp, defender.hp + drained);
            }

            // Specials
            const statusEffectsApplied: string[] = [];
            if (dWep.specials?.includes('poison') && !attackerIsUndead) {
              attacker.statuses.poisoned = true;
              statusEffectsApplied.push('POISONED');
            }
            if (dWep.specials?.includes('slow')) {
              attacker.statuses.slowed = true;
              statusEffectsApplied.push('SLOWED');
            }
            if (dWep.specials?.includes('petrify')) {
              attacker.statuses.petrified = true;
              statusEffectsApplied.push('PETRIFIED');
            }

            const statusStr =
              statusEffectsApplied.length > 0
                ? ` [${statusEffectsApplied.join(', ')}]`
                : '';
            msg = `${defender.name} counter-hit ${attacker.name} with ${dWep.name} dealing ${damage} damage (roll: ${Math.floor(roll)} < CTH: ${cthRes.cth}%).${drained > 0 ? ` Drained ${drained} HP.` : ''}${statusStr}`;
          } else {
            msg = `${defender.name} missed counter-strike against ${attacker.name} with ${dWep.name} (roll: ${Math.floor(roll)} >= CTH: ${cthRes.cth}%).`;
          }

          logs.push({
            round: r,
            strikeNumber: strikeNumber++,
            attackerName: defender.name,
            defenderName: attacker.name,
            attackerId: options.defenderId,
            defenderId: options.attackerId,
            weaponName: dWep.name,
            isHit,
            damage,
            drained,
            attackerHpBefore: defender.hp - (isHit ? drained : 0),
            attackerHpAfter: defender.hp,
            defenderHpBefore: attackerHpBefore,
            defenderHpAfter: attacker.hp,
            attackerSlowed: defender.statuses.slowed,
            defenderSlowed: attacker.statuses.slowed,
            defenderPoisoned: attacker.statuses.poisoned,
            defenderPetrified: attacker.statuses.petrified,
            isDead: attacker.hp <= 0,
            logMessage: msg,
          });

          if (attacker.hp <= 0) {
            winner = 'defender';
            break;
          }
        }
      }
    }

    // Award XP
    const isKill = attacker.hp <= 0 || defender.hp <= 0;
    const wasAttackerKiller = defender.hp <= 0;
    const xpAwards = WesnothCombatCore.calculateXP(
      attacker,
      defender,
      isKill,
      wasAttackerKiller,
    );

    attacker.xp = Math.min(attacker.maxXp, attacker.xp + xpAwards.attackerXp);
    defender.xp = Math.min(defender.maxXp, defender.xp + xpAwards.defenderXp);

    return {
      attacker,
      defender,
      attackerWeapon: aWep,
      defenderWeapon: dWep,
      logs,
      winner,
      roundsRun,
      attackerXpGained: xpAwards.attackerXp,
      defenderXpGained: xpAwards.defenderXp,
    };
  },
} as const;
