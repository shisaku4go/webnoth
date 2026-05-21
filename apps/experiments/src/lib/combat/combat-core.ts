import type { Alignment, DamageType, WesnothAttack } from '@webnoth/wesnoth-data';
import type { CombatContext, CombatUnitState } from './types';

/**
 * Mathematically precise Wesnoth combat calculations.
 * Stateless pure functions modeled after C++ source code.
 */
export class WesnothCombatCore {
  /**
   * Helper to round damage using Wesnoth's integer rounding rules:
   * Round to nearest integer. If the divisor is > 1 and modifier > divisor,
   * we subtract 1 from the rounding constant. Always returns at least 1 unless base is 0.
   */
  static roundDamage(baseDamage: number, multiplier: number, divisor: number): number {
    if (baseDamage === 0) return 0;
    const rounding = Math.floor(divisor / 2) - (multiplier <= divisor || divisor === 1 ? 0 : 1);
    return Math.max(1, Math.floor((baseDamage * multiplier + rounding) / divisor));
  }

  /**
   * Computes the alignment modifier (Time of Day bonus/penalty) as a percentage.
   */
  static getAlignmentBonus(alignment: Alignment, lawfulBonus: number, hasFearless: boolean): number {
    let bonus = 0;
    if (alignment === 'lawful') {
      bonus = lawfulBonus;
    } else if (alignment === 'chaotic') {
      bonus = -lawfulBonus;
    } else if (alignment === 'liminal') {
      // Liminal units get a +25% bonus at dawn/dusk (when lawfulBonus is 0)
      // and 0% otherwise (when lawfulBonus is +25 or -25).
      bonus = 25 - Math.abs(lawfulBonus);
    }

    // Fearless units ignore negative Time of Day modifiers
    if (hasFearless && bonus < 0) {
      return 0;
    }
    return bonus;
  }

  /**
   * Calculates the final damage a single hit from the attacker will deal to the defender.
   * Returns both the final damage and a breakdown of the math.
   */
  static calculateDamage(
    attacker: CombatUnitState,
    defender: CombatUnitState,
    weapon: WesnothAttack,
    defenderWeapon: WesnothAttack | null,
    context: CombatContext,
    isAttackingSide: boolean, // true if attacker is active unit on their turn
  ): { damage: number; breakdown: string[] } {
    const breakdown: string[] = [];
    const baseDamage = weapon.damage;
    breakdown.push(`Base damage: ${baseDamage}`);

    // Start multiplier at 100% (10000 in integer math)
    let multiplier = 10000;

    // 1. Time of Day alignment bonus
    const hasFearless = attacker.traits.includes('fearless');
    const alignmentBonus = this.getAlignmentBonus(attacker.alignment, context.lawfulBonus, hasFearless);
    if (alignmentBonus !== 0) {
      const alignmentMult = 100 + alignmentBonus;
      multiplier = Math.floor((multiplier * alignmentMult) / 100);
      breakdown.push(`Time of Day (${attacker.alignment}${hasFearless ? ' + fearless' : ''}): ${alignmentBonus > 0 ? '+' : ''}${alignmentBonus}%`);
    } else {
      breakdown.push(`Time of Day (${attacker.alignment}): no modifier`);
    }

    // 2. Leadership Bonus
    // Standard simulator has toggles or modifiers for leadership
    // Here we can support a leadership bonus from the unit state traits or a parameter.
    // For now we assume leadership bonus is applied directly if a "leadership_X" trait or ability is present.
    // Since leadership is usually +25% per level difference, let's look for leadership in traits.
    // E.g., leadership_25 = +25%, leadership_50 = +50%, etc.
    const leadershipTrait = attacker.traits.find((t) => t.startsWith('leadership_'));
    if (leadershipTrait) {
      const bonusPct = parseInt(leadershipTrait.replace('leadership_', ''), 10);
      if (!isNaN(bonusPct) && bonusPct > 0) {
        multiplier = Math.floor((multiplier * (100 + bonusPct)) / 100);
        breakdown.push(`Leadership: +${bonusPct}%`);
      }
    }

    // 3. Charge weapon special
    const hasCharge = weapon.specials?.includes('charge');
    if (hasCharge && isAttackingSide) {
      multiplier *= 2;
      breakdown.push('Charge (attacker offense): x2');
    }

    // 4. Resistance Modifier
    // Resistance in movetypes is represented as % damage taken (e.g. 80 means takes 80% damage, i.e., 20% resistant)
    // Defender resistance defaults to 100 (normal)
    // We fetch this from defender's effective resistance logic.
    // For pure core math, we receive the defender resistance percentage as a parameter or compute it.
    // Let's assume the state passes defender resistances, or we look it up.
    // In our system, defender's resistance is fetched by type.
    // Let's check defender's resistance modifier:
    const resistancePct = this.getUnitResistanceTo(defender, weapon.type);
    if (resistancePct !== 100) {
      multiplier = Math.floor((multiplier * resistancePct) / 100);
      breakdown.push(`Resistance (${weapon.type}): ${resistancePct}% damage taken (${100 - resistancePct}% resistant)`);
    } else {
      breakdown.push(`Resistance (${weapon.type}): 100% (neutral)`);
    }

    // Calculate final damage (divisor is 10000 normally, 20000 if slowed)
    const isSlowed = attacker.statuses.slowed;
    const divisor = isSlowed ? 20000 : 10000;
    if (isSlowed) {
      breakdown.push('Slowed: damage halved (divisor = 20000)');
    }

    const finalDamage = this.roundDamage(baseDamage, multiplier, divisor);
    breakdown.push(`Final damage calculation: round(${baseDamage} * ${multiplier} / ${divisor}) = ${finalDamage}`);

    return { damage: finalDamage, breakdown };
  }

  /**
   * Helper to look up unit resistance percentage.
   * Currently placeholder logic, but we can compute it using movetypes.ts or lookups.
   */
  static getUnitResistanceTo(unit: CombatUnitState, damageType: DamageType): number {
    // In our system, this will be handled by WesnothBattleManager which resolves unit and movetype details.
    // For stateless calculation, if a resistance is injected or we resolve it, we apply it.
    // Let's support injecting resistance via unit.traits or standard unit lookup.
    // We will pass the resistance value if available in unit state, or use a default 100.
    // We will check if the unit state has a resistance override map or we can resolve it in the manager.
    // Let's look for a trait like `resistance_pierce_80` or resolve from the global data.
    const resistanceOverride = unit.traits.find((t) => t.startsWith(`resistance_${damageType}_`));
    if (resistanceOverride) {
      const val = parseInt(resistanceOverride.replace(`resistance_${damageType}_`, ''), 10);
      if (!isNaN(val)) return val;
    }
    return 100;
  }

  /**
   * Calculates the Chance to Hit (CTH) as a percentage.
   */
  static calculateCTH(
    attacker: CombatUnitState,
    defender: CombatUnitState,
    weapon: WesnothAttack,
    defenderDefenseOnTerrain: number, // 0 to 100 (percentage defense)
  ): { cth: number; breakdown: string[] } {
    const breakdown: string[] = [];

    // Weapon specials that override CTH entirely
    if (weapon.specials?.includes('magical')) {
      breakdown.push('Magical weapon special: flat 70% chance to hit');
      return { cth: 70, breakdown };
    }

    // Base chance to hit is defender's hit probability (100% - defense%)
    const baseCth = 100 - defenderDefenseOnTerrain;
    breakdown.push(`Base CTH (100% - ${defenderDefenseOnTerrain}% defender defense): ${baseCth}%`);

    // Accuracy and parry modifiers
    // (In Wesnoth, accuracy is attacker weapon accuracy, parry is defender weapon parry)
    let accuracy = 0;
    let parry = 0;

    // Look for accuracy / parry values from weapon traits/specials
    // E.g., Honed accuracy +10%
    if (weapon.specials?.includes('honed')) {
      accuracy = 10;
      breakdown.push('Honed special: +10% accuracy');
    }

    let cth = Math.min(100, Math.max(0, baseCth + accuracy - parry));
    breakdown.push(`Adjusted CTH: clamp(${baseCth} + ${accuracy} - ${parry}) = ${cth}%`);

    // Marksman floor
    if (weapon.specials?.includes('marksman')) {
      if (cth < 60) {
        cth = 60;
        breakdown.push('Marksman weapon special: CTH raised to floor of 60%');
      } else {
        breakdown.push('Marksman weapon special: CTH already >= 60%');
      }
    }

    return { cth, breakdown };
  }

  /**
   * Calculates number of strikes scaled by Swarm special if applicable.
   */
  static calculateSwarmBlows(weapon: WesnothAttack, hp: number, maxHp: number): number {
    const defaultStrikes = weapon.number;
    if (!weapon.specials?.includes('swarm')) {
      return defaultStrikes;
    }

    // Swarm can be parameterized, but default Wesnoth swarm scales strikes down to 0 at 0 HP.
    // Minimum blows is typically 0.
    // Formula: min_blows + (max_blows - min_blows) * hp / max_hp
    const minBlows = 0;
    const maxBlows = defaultStrikes;

    if (hp >= maxHp) return maxBlows;
    return maxBlows < minBlows
      ? minBlows - Math.floor(((minBlows - maxBlows) * hp) / maxHp)
      : minBlows + Math.floor(((maxBlows - minBlows) * hp) / maxHp);
  }

  /**
   * Calculates health drained by the striker.
   */
  static calculateDrain(damageDealt: number, weapon: WesnothAttack, defenderIsUndead: boolean): number {
    if (!weapon.specials?.includes('drain') || defenderIsUndead) {
      return 0;
    }
    // Default drain is 50% of damage dealt
    return Math.floor(damageDealt * 0.5);
  }

  /**
   * Calculates XP earned after combat engagement.
   */
  static calculateXP(
    attacker: CombatUnitState,
    defender: CombatUnitState,
    isKill: boolean,
    wasAttackerKiller: boolean,
  ): { attackerXp: number; defenderXp: number } {
    if (isKill) {
      if (wasAttackerKiller) {
        // Attacker killed defender
        const xp = defender.level === 0 ? 4 : defender.level * 8;
        return { attackerXp: xp, defenderXp: 0 };
      } else {
        // Defender killed attacker
        const xp = attacker.level === 0 ? 4 : attacker.level * 8;
        return { attackerXp: 0, defenderXp: xp };
      }
    } else {
      // No kill
      const attackerXp = defender.level === 0 ? 0 : defender.level;
      const defenderXp = attacker.level === 0 ? 0 : attacker.level;
      return { attackerXp, defenderXp };
    }
  }
}
