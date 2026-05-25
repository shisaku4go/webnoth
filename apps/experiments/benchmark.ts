import { performance } from 'perf_hooks';
import { getAllEras, getFactionsByEra } from './src/lib/wesnoth-data';

const eras = getAllEras();
const allFactions = eras.flatMap((era) => getFactionsByEra(era.id));
const uniqueMap = new Map<string, (typeof allFactions)[number]>();
for (const f of allFactions) {
  if (!uniqueMap.has(f.id)) {
    uniqueMap.set(f.id, f);
  }
}
const factions = Array.from(uniqueMap.values());

const factionMap = new Map(factions.map((f) => [f.id, f]));

const ITERATIONS = 1_000_000;
const searchId = factions[factions.length - 1].id;

const startFind = performance.now();
let resultFind;
for (let i = 0; i < ITERATIONS; i++) {
  resultFind = factions.find((f) => f.id === searchId);
}
const endFind = performance.now();

const startMap = performance.now();
let resultMap;
for (let i = 0; i < ITERATIONS; i++) {
  resultMap = factionMap.get(searchId);
}
const endMap = performance.now();

console.log(`Array.find: ${(endFind - startFind).toFixed(2)} ms`);
console.log(`Map.get: ${(endMap - startMap).toFixed(2)} ms`);
