/**
 * extract-battle-data.ts — Extraction script for Traits, Terrains, and schedules
 *
 * Extracts battle-related WML configurations into TypeScript files.
 *
 * Usage:
 *   pnpm --filter @webnoth/scripts-wesnoth run extract-battle -- --wesnoth-root <path-to-wesnoth>
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  promises as fsPromises,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import {
  findChild,
  findChildren,
  getAttr,
  getListAttr,
  getNumAttr,
  type MacroDictionary,
  type MacroEntry,
  parseWml,
  type WmlNode,
} from './wml-parser.ts';

// ---------------------------------------------------------------------------
// CLI & Setup
// ---------------------------------------------------------------------------

function parseArgs(): { wesnothRoot: string } {
  const args = process.argv.slice(2);
  let wesnothRoot = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--wesnoth-root' && args[i + 1]) {
      wesnothRoot = args[i + 1];
      i++;
    }
  }

  if (!wesnothRoot) {
    console.error('Usage: pnpm run extract-battle -- --wesnoth-root <path>');
    process.exit(1);
  }

  wesnothRoot = resolve(wesnothRoot);
  if (!existsSync(join(wesnothRoot, 'data', 'core', 'units.cfg'))) {
    console.error(`Error: ${wesnothRoot} does not look like a wesnoth repo`);
    process.exit(1);
  }

  return { wesnothRoot };
}

interface SourceFileEntry {
  relativePath: string;
  category: string;
}

const sourceFiles: SourceFileEntry[] = [];

function trackFile(wesnothRoot: string, absPath: string, category: string) {
  sourceFiles.push({
    relativePath: relative(wesnothRoot, absPath),
    category,
  });
}

function cleanTranslation(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  let cleaned = s.replace(/^(race|male|female|race\+female|race\+plural)\^/, '');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

// ---------------------------------------------------------------------------
// Macro Parsing Utilities
// ---------------------------------------------------------------------------

interface MacroBlock {
  name: string;
  body: string;
  params: string[];
}

function parseDefineLine(restAfterName: string): {
  params: string[];
  bodyStart: string;
} {
  const trimmed = restAfterName.trim();
  if (trimmed.length === 0) {
    return { params: [], bodyStart: '' };
  }

  const tokens = trimmed.split(/\s+/);
  const params: string[] = [];
  let bodyStartIdx = tokens.length;

  for (let i = 0; i < tokens.length; i++) {
    if (/^[A-Z_][A-Z0-9_]*$/.test(tokens[i])) {
      params.push(tokens[i]);
    } else {
      bodyStartIdx = i;
      break;
    }
  }

  const bodyStart = tokens.slice(bodyStartIdx).join(' ');
  return { params, bodyStart };
}

function scanMacros(content: string): MacroBlock[] {
  const lines = content.split('\n');
  const results: MacroBlock[] = [];
  let inDefine = false;
  let currentName = '';
  let currentParams: string[] = [];
  let currentBody: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const defineMatch = line.match(/^\s*#define\s+(\S+)(.*)$/);
    if (defineMatch) {
      inDefine = true;
      currentName = defineMatch[1];
      const rest = defineMatch[2];
      const { params, bodyStart } = parseDefineLine(rest);

      if (bodyStart.includes('#enddef')) {
        const body = bodyStart.replace(/\s*#enddef.*$/, '').trim();
        results.push({
          name: currentName,
          params,
          body,
        });
        inDefine = false;
      } else {
        currentParams = params;
        currentBody = bodyStart.length > 0 ? [bodyStart] : [];
      }
      continue;
    }

    if (inDefine) {
      if (line.includes('#enddef')) {
        const before = line.replace(/\s*#enddef.*$/, '').trim();
        if (before.length > 0) currentBody.push(before);
        results.push({
          name: currentName,
          params: currentParams,
          body: currentBody.join('\n'),
        });
        inDefine = false;
      } else {
        currentBody.push(line);
      }
    }
  }
  return results;
}

function buildMacroDict(blocks: MacroBlock[]): MacroDictionary {
  const dict: MacroDictionary = new Map();
  for (const block of blocks) {
    dict.set(block.name, {
      params: block.params,
      body: block.body,
    });
  }
  return dict;
}

// ---------------------------------------------------------------------------
// Traits Extraction
// ---------------------------------------------------------------------------

interface TraitEffectData {
  applyTo: string;
  add?: string;
  ellipse?: string;
  increaseDamage?: number | string;
  increaseTotal?: number | string;
  increase?: number | string;
  times?: string;
  range?: string;
  replace?: boolean;
  defense?: Record<string, number>;
  abilities?: Record<string, unknown>;
}

interface TraitData {
  id: string;
  name: string;
  femaleName?: string;
  description?: string;
  helpText?: string;
  availability?: string;
  effects: TraitEffectData[];
}

function extractTraitEffects(traitNode: WmlNode): TraitEffectData[] {
  const effects: TraitEffectData[] = [];
  for (const effectNode of findChildren(traitNode, 'effect')) {
    const applyTo = getAttr(effectNode, 'apply_to') ?? '';
    const add = getAttr(effectNode, 'add');
    const ellipse = getAttr(effectNode, 'ellipse');
    const times = getAttr(effectNode, 'times');
    const range = getAttr(effectNode, 'range');
    const replace = getAttr(effectNode, 'replace') === 'yes' ? true : undefined;

    let increaseDamage: number | string | undefined =
      getNumAttr(effectNode, 'increase_damage') ?? getAttr(effectNode, 'increase_damage');
    let increaseTotal: number | string | undefined =
      getNumAttr(effectNode, 'increase_total') ?? getAttr(effectNode, 'increase_total');
    let increase: number | string | undefined =
      getNumAttr(effectNode, 'increase') ?? getAttr(effectNode, 'increase');

    // Parse defense block if present
    let defense: Record<string, number> | undefined;
    const defNode = findChild(effectNode, 'defense');
    if (defNode) {
      defense = {};
      for (const [k, v] of Object.entries(defNode.attributes)) {
        const val = Number(v);
        if (!Number.isNaN(val)) defense[k] = val;
      }
    }

    // Parse abilities block if present (simplistic serialization)
    let abilities: Record<string, unknown> | undefined;
    const abNode = findChild(effectNode, 'abilities');
    if (abNode) {
      abilities = {};
      for (const child of abNode.children) {
        const childAttrs: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(child.attributes)) {
          const num = Number(v);
          childAttrs[k] = Number.isNaN(num) ? v : num;
        }
        abilities[child.tag] = childAttrs;
      }
    }

    effects.push({
      applyTo,
      add,
      ellipse,
      increaseDamage,
      increaseTotal,
      increase,
      times,
      range,
      replace,
      defense,
      abilities,
    });
  }
  return effects;
}

function extractTraits(
  blocks: MacroBlock[],
  macroDict: MacroDictionary,
): TraitData[] {
  const traits: TraitData[] = [];
  const processedIds = new Set<string>();

  for (const block of blocks) {
    if (
      !block.body.includes('[trait]') &&
      !block.body.includes('[+trait]')
    ) {
      continue;
    }

    // Parse the macro body. We expand internal macro references using macroDict
    const tree = parseWml(block.body, macroDict);
    const traitNodes = [
      ...findChildren(tree, 'trait'),
      ...findChildren(tree, '+trait'),
    ];

    for (const node of traitNodes) {
      const id = getAttr(node, 'id');
      if (!id) continue;

      if (processedIds.has(id)) {
        // Merge or skip if already processed. Usually traits are uniquely defined in macros
        continue;
      }
      processedIds.add(id);

      const name = cleanTranslation(getAttr(node, 'male_name') ?? getAttr(node, 'name')) ?? id;
      const femaleName = cleanTranslation(getAttr(node, 'female_name'));
      const description = cleanTranslation(getAttr(node, 'description'));
      const helpText = cleanTranslation(getAttr(node, 'help_text'));
      const availability = getAttr(node, 'availability');
      const effects = extractTraitEffects(node);

      traits.push({
        id,
        name,
        femaleName,
        description,
        helpText,
        availability,
        effects,
      });
    }
  }

  return traits;
}

// ---------------------------------------------------------------------------
// Schedules Extraction
// ---------------------------------------------------------------------------

interface TimeOfDayData {
  id: string;
  name: string;
  image: string;
  lawfulBonus?: number;
  red?: number;
  green?: number;
  blue?: number;
  sound?: string;
}

interface ScheduleData {
  id: string;
  name?: string;
  description?: string;
  times: string[];
}

function extractSchedulesAndTimes(
  blocks: MacroBlock[],
  macroDict: MacroDictionary,
): { times: TimeOfDayData[]; schedules: ScheduleData[] } {
  const timesMap = new Map<string, TimeOfDayData>();
  const schedules: ScheduleData[] = [];

  // Phase 1: Extract Time of Days
  for (const block of blocks) {
    if (!block.body.includes('[time]')) continue;

    const tree = parseWml(block.body, macroDict);
    const timeNodes = findChildren(tree, 'time');

    for (const node of timeNodes) {
      const id = getAttr(node, 'id');
      if (!id) continue;

      timesMap.set(id, {
        id,
        name: cleanTranslation(getAttr(node, 'name')) ?? id,
        image: getAttr(node, 'image') ?? '',
        lawfulBonus: getNumAttr(node, 'lawful_bonus'),
        red: getNumAttr(node, 'red'),
        green: getNumAttr(node, 'green'),
        blue: getNumAttr(node, 'blue'),
        sound: getAttr(node, 'sound'),
      });
    }
  }

  // Phase 2: Extract Schedules
  for (const block of blocks) {
    // A schedule macro usually has no parameters, does not define [time] directly,
    // and calls multiple other time macros (e.g. {DAWN} {MORNING})
    if (
      block.params.length > 0 ||
      block.body.includes('[time]') ||
      !block.name.endsWith('_SCHEDULE')
    ) {
      continue;
    }

    const tree = parseWml(block.body, macroDict);
    // After macro expansion, all [time] child nodes are generated in sequence
    const timeNodes = findChildren(tree, 'time');
    if (timeNodes.length === 0) continue;

    const timeIds = timeNodes
      .map((node) => getAttr(node, 'id'))
      .filter((id): id is string => !!id);

    schedules.push({
      id: block.name.toLowerCase(),
      name: cleanTranslation(block.name.replace(/_SCHEDULE$/, '').replace(/_/g, ' ')),
      times: timeIds,
    });
  }

  return {
    times: Array.from(timesMap.values()),
    schedules,
  };
}

// ---------------------------------------------------------------------------
// Terrains Extraction
// ---------------------------------------------------------------------------

interface TerrainData {
  id: string;
  name: string;
  editorName?: string;
  code: string;
  aliasOf?: string[];
  submerge?: number;
  editorGroup?: string[];
  heals?: number;
  light?: number;
  defaultBase?: string;
  helpTopicText?: string;
}

function extractTerrains(tree: WmlNode): TerrainData[] {
  const terrains: TerrainData[] = [];
  const terrainNodes = findChildren(tree, 'terrain_type');

  for (const node of terrainNodes) {
    const id = getAttr(node, 'id');
    const code = getAttr(node, 'string');
    if (!id || !code) continue;

    const name = cleanTranslation(getAttr(node, 'name') ?? getAttr(node, 'editor_name')) ?? id;
    const editorName = cleanTranslation(getAttr(node, 'editor_name'));
    const aliasOf = getListAttr(node, 'aliasof');
    const submerge = getNumAttr(node, 'submerge');
    const editorGroup = getListAttr(node, 'editor_group');
    const heals = getNumAttr(node, 'heals');
    const light = getNumAttr(node, 'light');
    const defaultBase = getAttr(node, 'default_base');
    const helpTopicText = cleanTranslation(getAttr(node, 'help_topic_text'));

    terrains.push({
      id,
      name,
      editorName,
      code,
      aliasOf: aliasOf.length > 0 ? aliasOf : undefined,
      submerge,
      editorGroup: editorGroup.length > 0 ? editorGroup : undefined,
      heals,
      light,
      defaultBase,
      helpTopicText,
    });
  }

  return terrains;
}

// ---------------------------------------------------------------------------
// Main Output Writers
// ---------------------------------------------------------------------------

function writeGeneratedFile(
  outDir: string,
  filename: string,
  varName: string,
  typeName: string,
  data: unknown,
): void {
  const header = `// Auto-generated by scripts/wesnoth/src/extract-battle-data.ts
// Do not edit manually. Re-run the extraction script to update.
import type { ${typeName} } from "../types.ts";

export const ${varName}: ${typeName}[] = ${JSON.stringify(data, null, 2)};
`;
  writeFileSync(join(outDir, filename), header, 'utf-8');
  console.log(
    `  Written: ${filename} (${Array.isArray(data) ? data.length : 0} entries)`,
  );
}

async function main() {
  const { wesnothRoot } = parseArgs();
  console.log(`\nWesnoth root: ${wesnothRoot}`);

  const scriptDir = new URL('.', import.meta.url).pathname;
  const projectRoot = resolve(scriptDir, '..', '..', '..');
  const outDir = join(
    projectRoot,
    'packages',
    'wesnoth-data',
    'src',
    'generated',
  );
  mkdirSync(outDir, { recursive: true });

  // 1. Process schedules.cfg
  console.log('\nPhase 1: Parsing schedules.cfg...');
  const schedulesPath = join(wesnothRoot, 'data', 'core', 'macros', 'schedules.cfg');
  if (existsSync(schedulesPath)) {
    trackFile(wesnothRoot, schedulesPath, 'schedules_cfg');
    const content = await fsPromises.readFile(schedulesPath, 'utf-8');
    const blocks = scanMacros(content);
    const macroDict = buildMacroDict(blocks);
    const { times, schedules } = extractSchedulesAndTimes(blocks, macroDict);

    writeGeneratedFile(outDir, 'times.ts', 'times', 'WesnothTimeOfDay', times);
    writeGeneratedFile(outDir, 'schedules.ts', 'schedules', 'WesnothSchedule', schedules);
  } else {
    console.error('Error: schedules.cfg not found.');
  }

  // 2. Process traits.cfg
  console.log('\nPhase 2: Parsing traits.cfg...');
  const traitsPath = join(wesnothRoot, 'data', 'core', 'macros', 'traits.cfg');
  if (existsSync(traitsPath)) {
    trackFile(wesnothRoot, traitsPath, 'traits_cfg');
    const content = await fsPromises.readFile(traitsPath, 'utf-8');
    const blocks = scanMacros(content);
    const macroDict = buildMacroDict(blocks);
    const traits = extractTraits(blocks, macroDict);

    writeGeneratedFile(outDir, 'traits.ts', 'traits', 'WesnothTrait', traits);
  } else {
    console.error('Error: traits.cfg not found.');
  }

  // 3. Process terrain.cfg
  console.log('\nPhase 3: Parsing terrain.cfg...');
  const terrainPath = join(wesnothRoot, 'data', 'core', 'terrain.cfg');
  if (existsSync(terrainPath)) {
    trackFile(wesnothRoot, terrainPath, 'terrain_cfg');
    const content = await fsPromises.readFile(terrainPath, 'utf-8');
    // We can parse the full terrain file directly since terrain_type is top-level
    const tree = parseWml(content);
    const terrains = extractTerrains(tree);

    writeGeneratedFile(outDir, 'terrains.ts', 'terrains', 'WesnothTerrain', terrains);
  } else {
    console.error('Error: terrain.cfg not found.');
  }

  console.log('\nDone! ✓');
}

main().catch(console.error);
