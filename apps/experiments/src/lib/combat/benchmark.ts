import { unitTypes as units } from '@webnoth/wesnoth-data/units';
import { WesnothBattleManager } from './battle-manager';

// Create a basic benchmark
console.log('Setting up benchmark...');
const attackerBase = units.find((u) => u.id === 'Orcish Grunt');
const defenderBase = units.find((u) => u.id === 'Elvish Fighter');

if (!attackerBase || !defenderBase) {
  throw new Error('Could not find units!');
}

const N = 100000;
const start = performance.now();

for (let i = 0; i < N; i++) {
  WesnothBattleManager.runSimulation(attackerBase, defenderBase, {
    terrainId: 'flat',
    timeOfDayId: 'dawn',
  });
}

const end = performance.now();
console.log(`Simulated ${N} battles in ${(end - start).toFixed(2)}ms`);
