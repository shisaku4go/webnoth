import type { WesnothAttack, WesnothUnitType } from '@webnoth/wesnoth-data';
import { describe, expect, it } from 'vitest';
import { WesnothBattleManager } from '../battle-manager';
import { WesnothCombatCore } from '../combat-core';
import type { CombatUnitState } from '../types';

describe('WesnothCombatCore Math Formulas', () => {
  it('roundDamage should correctly round and enforce minimum damage of 1', () => {
    // Normal damage, no modification
    expect(WesnothCombatCore.roundDamage(10, 10000, 10000)).toBe(10);
    // Slowed damage (divisor = 20000)
    expect(WesnothCombatCore.roundDamage(10, 10000, 20000)).toBe(5);
    // Integer rounding check: e.g., 5.4 should round to 5
    expect(WesnothCombatCore.roundDamage(9, 12000, 20000)).toBe(5); // 9 * 1.2 / 2 = 5.4 => rounds to 5
    // Minimum damage is 1
    expect(WesnothCombatCore.roundDamage(1, 1000, 10000)).toBe(1); // 1 * 0.1 => 0.1, rounds to 0 but min floor is 1
    // Base damage 0 is 0
    expect(WesnothCombatCore.roundDamage(0, 10000, 10000)).toBe(0);
  });

  it('calculateDamage should correctly compute final damage and breakdowns based on modifiers', () => {
    const baseWeapon: WesnothAttack = {
      name: 'Sword',
      description: '',
      type: 'blade',
      range: 'melee',
      damage: 10,
      number: 1,
    };

    const baseAttacker = {
      alignment: 'neutral',
      traits: [],
      statuses: {},
    } as unknown as CombatUnitState;

    const baseDefender = {
      traits: [],
      statuses: {},
    } as unknown as CombatUnitState;

    const baseContext = { lawfulBonus: 0 } as any;

    // 1. Basic calculation (no modifiers)
    let result = WesnothCombatCore.calculateDamage(
      baseAttacker,
      baseDefender,
      baseWeapon,
      null,
      baseContext,
      true,
    );
    expect(result.damage).toBe(10);
    expect(result.breakdown).toContain('Base damage: 10');

    // 2. Time of Day alignment bonus (Lawful +25%)
    const lawfulAttacker = {
      ...baseAttacker,
      alignment: 'lawful',
    } as CombatUnitState;
    result = WesnothCombatCore.calculateDamage(
      lawfulAttacker,
      baseDefender,
      baseWeapon,
      null,
      { lawfulBonus: 25 } as any,
      true,
    );
    expect(result.damage).toBe(12); // Math.floor((10 * 12500 + 4999) / 10000) -> 12

    // 3. Leadership bonus
    const leaderAttacker = {
      ...baseAttacker,
      traits: ['leadership_25'],
    } as CombatUnitState;
    result = WesnothCombatCore.calculateDamage(
      leaderAttacker,
      baseDefender,
      baseWeapon,
      null,
      baseContext,
      true,
    );
    expect(result.damage).toBe(12); // 10 * 1.25 -> 12
    expect(result.breakdown).toContain('Leadership: +25%');

    // 4. Charge weapon special
    const chargeWeapon = { ...baseWeapon, specials: ['charge'] };
    result = WesnothCombatCore.calculateDamage(
      baseAttacker,
      baseDefender,
      chargeWeapon,
      null,
      baseContext,
      true, // attacking side
    );
    expect(result.damage).toBe(20); // 10 * 2

    // 5. Resistance modifier
    const resistantDefender = {
      ...baseDefender,
      traits: ['resistance_blade_80'],
    } as CombatUnitState;
    result = WesnothCombatCore.calculateDamage(
      baseAttacker,
      resistantDefender,
      baseWeapon,
      null,
      baseContext,
      true,
    );
    expect(result.damage).toBe(8); // 10 * 0.8
    expect(result.breakdown).toContain(
      'Resistance (blade): 80% damage taken (20% resistant)',
    );

    // 6. Slowed status
    const slowedAttacker = {
      ...baseAttacker,
      statuses: { slowed: true },
    } as CombatUnitState;
    result = WesnothCombatCore.calculateDamage(
      slowedAttacker,
      baseDefender,
      baseWeapon,
      null,
      baseContext,
      true,
    );
    expect(result.damage).toBe(5); // 10 / 2
    expect(result.breakdown).toContain(
      'Slowed: damage halved (divisor = 20000)',
    );

    // 7. Combined modifiers (Lawful +25%, Leadership +25%, Charge x2, Resistance 80%, Slowed)
    const combinedAttacker = {
      alignment: 'lawful',
      traits: ['leadership_25'],
      statuses: { slowed: true },
    } as unknown as CombatUnitState;
    result = WesnothCombatCore.calculateDamage(
      combinedAttacker,
      resistantDefender,
      chargeWeapon,
      null,
      { lawfulBonus: 25 } as any,
      true,
    );
    // Multipliers applied sequentially with Math.floor at each step inside calculateDamage:
    // Start: 10000
    // ToD (+25%): floor(10000 * 1.25) = 12500
    // Leadership (+25%): floor(12500 * 1.25) = 15625
    // Charge (x2): 15625 * 2 = 31250
    // Resistance (80%): floor(31250 * 0.8) = 25000
    // Slowed divisor = 20000
    // Final round: (10 * 25000 + 9999) / 20000 => rounds to 12
    expect(result.damage).toBe(12);
  });

  it('calculateCTH should clamp values and respect magical/marksman specials', () => {
    const attacker = { traits: [], statuses: {} } as unknown as CombatUnitState;
    const defender = { traits: [], statuses: {} } as unknown as CombatUnitState;
    const normalAttack: WesnothAttack = {
      name: 'Sword',
      description: '',
      type: 'blade',
      range: 'melee',
      damage: 8,
      number: 4,
    };

    // Standard defense: defender defense on terrain is 40% (chance to be hit is 60%)
    // base cth = 100 - defender defense percentage
    // Wait! Defender defense on terrain resolves to defense percentage (e.g. 40% defense means 60% chance to be hit).
    // Let's pass 40 as defenderDefenseOnTerrain. base cth = 100 - 40 = 60%.
    expect(
      WesnothCombatCore.calculateCTH(attacker, defender, normalAttack, 40).cth,
    ).toBe(60);

    // Magical special overrides CTH to 70%
    const magicalAttack: WesnothAttack = {
      ...normalAttack,
      specials: ['magical'],
    };
    expect(
      WesnothCombatCore.calculateCTH(attacker, defender, magicalAttack, 20).cth,
    ).toBe(70);
    expect(
      WesnothCombatCore.calculateCTH(attacker, defender, magicalAttack, 80).cth,
    ).toBe(70);

    // Marksman special provides a floor of 60% CTH
    const marksmanAttack: WesnothAttack = {
      ...normalAttack,
      specials: ['marksman'],
    };
    expect(
      WesnothCombatCore.calculateCTH(attacker, defender, marksmanAttack, 30)
        .cth,
    ).toBe(70); // 100 - 30 = 70% (>= 60%)
    expect(
      WesnothCombatCore.calculateCTH(attacker, defender, marksmanAttack, 60)
        .cth,
    ).toBe(60); // 100 - 60 = 40% (< 60%, raised to 60)
  });

  it('calculateSwarmBlows should scale strikes linearly with current HP', () => {
    const swarmAttack: WesnothAttack = {
      name: 'Swarm',
      description: '',
      type: 'pierce',
      range: 'ranged',
      damage: 4,
      number: 4,
      specials: ['swarm'],
    };

    // Full HP => full strikes
    expect(WesnothCombatCore.calculateSwarmBlows(swarmAttack, 40, 40)).toBe(4);
    // Half HP => half strikes
    expect(WesnothCombatCore.calculateSwarmBlows(swarmAttack, 20, 40)).toBe(2);
    // Low HP => low strikes
    expect(WesnothCombatCore.calculateSwarmBlows(swarmAttack, 5, 40)).toBe(0); // 4 * 5 / 40 = 0.5 => 0
  });

  it('calculateDrain should return 50% damage dealt unless target is Undead', () => {
    const drainAttack: WesnothAttack = {
      name: 'Drain',
      description: '',
      type: 'arcane',
      range: 'melee',
      damage: 10,
      number: 2,
      specials: ['drain'],
    };

    // Standard target: drains 50%
    expect(WesnothCombatCore.calculateDrain(10, drainAttack, false)).toBe(5);
    expect(WesnothCombatCore.calculateDrain(11, drainAttack, false)).toBe(5); // rounds down (Math.floor)
    // Undead target: no drain
    expect(WesnothCombatCore.calculateDrain(10, drainAttack, true)).toBe(0);
  });

  it('calculateXP should correctly award XP based on kill status and levels', () => {
    const level0 = { level: 0 } as CombatUnitState;
    const level1 = { level: 1 } as CombatUnitState;
    const level2 = { level: 2 } as CombatUnitState;

    // Attacker kills defender
    // If defender is level 0, attacker gets 4 XP
    expect(WesnothCombatCore.calculateXP(level1, level0, true, true)).toEqual({
      attackerXp: 4,
      defenderXp: 0,
    });
    // If defender is level > 0, attacker gets defender.level * 8 XP
    expect(WesnothCombatCore.calculateXP(level1, level2, true, true)).toEqual({
      attackerXp: 16,
      defenderXp: 0,
    });

    // Defender kills attacker
    // If attacker is level 0, defender gets 4 XP
    expect(WesnothCombatCore.calculateXP(level0, level1, true, false)).toEqual({
      attackerXp: 0,
      defenderXp: 4,
    });
    // If attacker is level > 0, defender gets attacker.level * 8 XP
    expect(WesnothCombatCore.calculateXP(level2, level1, true, false)).toEqual({
      attackerXp: 0,
      defenderXp: 16,
    });

    // No kill
    // Each gets XP equal to the other's level. If level 0, then 0 XP.
    expect(WesnothCombatCore.calculateXP(level0, level0, false, false)).toEqual(
      { attackerXp: 0, defenderXp: 0 },
    );
    expect(WesnothCombatCore.calculateXP(level1, level2, false, false)).toEqual(
      { attackerXp: 2, defenderXp: 1 },
    );
    expect(WesnothCombatCore.calculateXP(level2, level0, false, false)).toEqual(
      { attackerXp: 0, defenderXp: 2 },
    );
  });
});

describe('WesnothBattleManager Terrain and Combat Loop', () => {
  it('should resolve detailed terrain codes to base keys correctly', () => {
    // Gg (Grassland) -> flat
    expect(WesnothBattleManager.resolveTerrainBaseIds('grassland')).toContain(
      'flat',
    );
    // Wwf (Ford) -> flat, shallow_water
    expect(WesnothBattleManager.resolveTerrainBaseIds('ford')).toContain(
      'flat',
    );
    expect(WesnothBattleManager.resolveTerrainBaseIds('ford')).toContain(
      'shallow_water',
    );
  });

  it('should run a basic 1v1 battle loop correctly', () => {
    const spearman: WesnothUnitType = {
      id: 'spearman',
      name: 'Spearman',
      race: 'human',
      image: 'units/human-loyalists/spearman.png',
      hitpoints: 36,
      movementType: 'smallfoot',
      movement: 5,
      experience: 46,
      level: 1,
      alignment: 'lawful',
      advancesTo: ['javelineer', 'pikeman', 'swordsman'],
      cost: 14,
      description: 'Spearman',
      attacks: [
        {
          name: 'spear',
          description: 'spear',
          type: 'pierce',
          range: 'melee',
          damage: 7,
          number: 3,
        },
        {
          name: 'javelin',
          description: 'javelin',
          type: 'pierce',
          range: 'ranged',
          damage: 6,
          number: 2,
        },
      ],
      sourceFile: 'units/human-loyalists/Spearman.cfg',
    };

    const walkingCorpse: WesnothUnitType = {
      id: 'walking_corpse',
      name: 'Walking Corpse',
      race: 'undead',
      image: 'units/undead-monsters/corpse.png',
      hitpoints: 18,
      movementType: 'undeadfoot',
      movement: 4,
      experience: 24,
      level: 0,
      alignment: 'chaotic',
      advancesTo: ['null'],
      cost: 8,
      description: 'Walking Corpse',
      attacks: [
        {
          name: 'touch',
          description: 'touch',
          type: 'impact',
          range: 'melee',
          damage: 6,
          number: 2,
        },
      ],
      sourceFile: 'units/undead/Walking_Corpse.cfg',
    };

    // Run battle simulation
    const result = WesnothBattleManager.runSimulation(spearman, walkingCorpse, {
      terrainId: 'grassland',
      timeOfDayId: 'morning', // +25% lawful bonus, -25% chaotic penalty
      attackerTraits: ['strong', 'resilient'], // strong gives +1 melee damage, resilient gives +4 HP
      defenderTraits: [],
    });

    expect(result.attacker.maxHp).toBe(41); // 36 + 4 resilient + 1 strong
    expect(result.attackerWeapon).not.toBeNull();
    expect(result.defenderWeapon).not.toBeNull();
    expect(result.logs.length).toBeGreaterThan(0);

    // Winner should be decided if someone dies, or none
    if (result.attacker.hp <= 0) {
      expect(result.winner).toBe('defender');
    } else if (result.defender.hp <= 0) {
      expect(result.winner).toBe('attacker');
    } else {
      expect(result.winner).toBe('none');
    }
  });
});
