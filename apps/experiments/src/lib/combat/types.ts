import type { Alignment, WesnothAttack } from '@webnoth/wesnoth-data';

export interface CombatUnitState {
  unitTypeId: string;
  name: string;
  gender: string;
  level: number;
  maxHp: number;
  hp: number;
  alignment: Alignment;
  traits: string[];
  statuses: {
    poisoned: boolean;
    slowed: boolean;
    petrified: boolean;
  };
  activeWeaponIndex: number; // -1 if none selected
  xp: number;
  maxXp: number;
}

export interface CombatContext {
  terrainId: string; // The resolved base terrain ID (e.g. "flat", "shallow_water")
  timeOfDayId: string; // The phase ID (e.g. "morning", "dusk")
  lawfulBonus: number; // The alignment modifier (e.g. 25, -25, 0)
}

export interface StrikeEvent {
  round: number;
  strikeNumber: number;
  attackerName: string;
  defenderName: string;
  weaponName: string;
  isHit: boolean;
  damage: number;
  drained: number;
  attackerHpBefore: number;
  attackerHpAfter: number;
  defenderHpBefore: number;
  defenderHpAfter: number;
  attackerSlowed: boolean;
  defenderSlowed: boolean;
  defenderPoisoned: boolean;
  defenderPetrified: boolean;
  isDead: boolean;
  logMessage: string;
}

export interface BattleResult {
  attacker: CombatUnitState;
  defender: CombatUnitState;
  attackerWeapon: WesnothAttack | null;
  defenderWeapon: WesnothAttack | null;
  logs: StrikeEvent[];
  winner: 'attacker' | 'defender' | 'none';
  roundsRun: number;
  attackerXpGained: number;
  defenderXpGained: number;
}
