import { performance } from 'perf_hooks';
import { factions } from '../../packages/wesnoth-data/src/generated/factions.js';

// Setup
const factionsList = factions;
const map = new Map(factionsList.map((f) => [f.id, f]));
const searchId = factionsList[factionsList.length - 1].id;

const ITERATIONS = 1_000_000;

// Benchmark array.find
const startFind = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  factionsList.find((f) => f.id === searchId);
}
const endFind = performance.now();

// Benchmark Map.get
const startMap = performance.now();
for (let i = 0; i < ITERATIONS; i++) {
  map.get(searchId);
}
const endMap = performance.now();

console.log(`Array.find: ${(endFind - startFind).toFixed(2)} ms`);
console.log(`Map.get: ${(endMap - startMap).toFixed(2)} ms`);
