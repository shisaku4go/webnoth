import { units } from '@webnoth/wesnoth-data/units';
import { WesnothBattleManager } from './apps/experiments/src/lib/combat/battle-manager';

// Create a basic benchmark
console.log('Setting up benchmark...');
const attackerBase = units.find((u) => u.id === 'Orcish Grunt');
const defenderBase = units.find((u) => u.id === 'Elvish Fighter');

if (!attackerBase || !defenderBase) {
  console.error('Could not find units!');
  process.exit(1);
}

const N = 10000;
const start = performance.now();

for (let i = 0; i < N; i++) {
  WesnothBattleManager.simulateBattle(
    {
      id: 'attacker',
      baseId: attackerBase.id,
      name: 'Attacker',
      hp: attackerBase.hitpoints,
      maxHp: attackerBase.hitpoints,
      xp: 0,
      maxXp: attackerBase.experience,
      traits: [],
      activeWeaponIndex: -1,
      statuses: {},
    },
    attackerBase,
    {
      id: 'defender',
      baseId: defenderBase.id,
      name: 'Defender',
      hp: defenderBase.hitpoints,
      maxHp: defenderBase.hitpoints,
      xp: 0,
      maxXp: defenderBase.experience,
      traits: [],
      activeWeaponIndex: -1,
      statuses: {},
    },
    defenderBase,
    {
      terrainId: 'flat',
      timeOfDayId: 'dawn',
    },
  );
}

const end = performance.now();
console.log(`Simulated ${N} battles in ${(end - start).toFixed(2)}ms`);
