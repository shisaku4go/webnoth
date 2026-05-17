/**
 * extract-units.ts — WML Unit Data Extraction Script
 *
 * Extracts unit types, races, movetypes from Wesnoth WML files and outputs
 * TypeScript source files into packages/wesnoth-data/src/generated/.
 *
 * Usage:
 *   pnpm --filter @webnoth/scripts-wesnoth run extract -- --wesnoth-root <path-to-wesnoth>
 *
 * Or from scripts/wesnoth/:
 *   pnpm run extract -- --wesnoth-root <path-to-wesnoth>
 */

import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { loadMacroDictionary } from './macro-loader.ts';
import {
  findChild,
  findChildren,
  getAttr,
  getListAttr,
  getNumAttr,
  type MacroDictionary,
  parseWml,
  type WmlNode,
} from './wml-parser.ts';

// ---------------------------------------------------------------------------
// CLI
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
    console.error('Usage: pnpm run extract -- --wesnoth-root <path>');
    process.exit(1);
  }

  wesnothRoot = resolve(wesnothRoot);
  if (!existsSync(join(wesnothRoot, 'data', 'core', 'units.cfg'))) {
    console.error(`Error: ${wesnothRoot} does not look like a wesnoth repo`);
    process.exit(1);
  }

  return { wesnothRoot };
}

// ---------------------------------------------------------------------------
// Source file tracking (provenance)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Collect .cfg files recursively
// ---------------------------------------------------------------------------

function collectCfgFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (entry.startsWith('.')) continue;
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectCfgFiles(fullPath));
    } else if (entry.endsWith('.cfg')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Extract races from [race] nodes
// ---------------------------------------------------------------------------

interface RaceData {
  id: string;
  name: string;
  femaleName?: string;
  pluralName: string;
  description: string;
  numTraits: number;
  undeadVariation?: string;
  traits?: string[];
  ignoreGlobalTraits?: boolean;
  helpTaxonomy?: string;
  markovChainSize?: number;
}

function extractRace(node: WmlNode): RaceData | null {
  const id = getAttr(node, 'id');
  if (!id) return null;

  // Extract trait macros
  const traits = node.macros
    .filter((m) => m.startsWith('TRAIT_'))
    .map((m) => m.split(/\s+/)[0]);

  // Name handling: 'name' or 'male_name'
  const name = getAttr(node, 'name') ?? getAttr(node, 'male_name') ?? id;

  return {
    id,
    name: cleanTranslation(name),
    femaleName: cleanTranslation(getAttr(node, 'female_name')),
    pluralName: cleanTranslation(getAttr(node, 'plural_name') ?? `${name}s`),
    description: cleanTranslation(getAttr(node, 'description') ?? ''),
    numTraits: getNumAttr(node, 'num_traits') ?? 0,
    undeadVariation: getAttr(node, 'undead_variation'),
    traits: traits.length > 0 ? traits : undefined,
    ignoreGlobalTraits:
      getAttr(node, 'ignore_global_traits') === 'yes' || undefined,
    helpTaxonomy: getAttr(node, 'help_taxonomy'),
    markovChainSize: getNumAttr(node, 'markov_chain_size'),
  };
}

// ---------------------------------------------------------------------------
// Extract movetypes from [movetype] nodes
// ---------------------------------------------------------------------------

interface MovetypeData {
  name: string;
  flying?: boolean;
  movementCosts: Record<string, number>;
  defense: Record<string, number>;
  resistance: Record<string, number>;
}

function extractMovetype(
  node: WmlNode,
  _macros: MacroDictionary,
): MovetypeData | null {
  const name = getAttr(node, 'name');
  if (!name) return null;

  const flyingAttr = getAttr(node, 'flying') ?? getAttr(node, 'flies');
  const flying = flyingAttr === 'yes' ? true : undefined;

  const movementCosts: Record<string, number> = {};
  const defense: Record<string, number> = {};
  const resistance: Record<string, number> = {};

  const mcNode = findChild(node, 'movement_costs');
  if (mcNode) {
    for (const [k, v] of Object.entries(mcNode.attributes)) {
      const n = Number(v);
      if (!Number.isNaN(n)) movementCosts[k] = n;
    }
  }

  const defNode = findChild(node, 'defense');
  if (defNode) {
    for (const [k, v] of Object.entries(defNode.attributes)) {
      const n = Number(v);
      if (!Number.isNaN(n)) defense[k] = n;
    }
  }

  const resNode = findChild(node, 'resistance');
  if (resNode) {
    for (const [k, v] of Object.entries(resNode.attributes)) {
      const n = Number(v);
      if (!Number.isNaN(n)) resistance[k] = n;
    }
  }

  return { name, flying, movementCosts, defense, resistance };
}

// ---------------------------------------------------------------------------
// Extract unit types from [unit_type] nodes
// ---------------------------------------------------------------------------

interface AttackData {
  name: string;
  description: string;
  type: string;
  range: string;
  damage: number;
  number: number;
  icon?: string;
  specials?: string[];
}

interface AnimationFrameData {
  image: string;
  duration?: number;
  sound?: string;
}

interface AnimationData {
  type: string;
  direction?: string;
  filterAttack?: string;
  frames: AnimationFrameData[];
}

interface UnitTypeData {
  id: string;
  name: string;
  race: string;
  gender?: string[];
  image: string;
  profile?: string;
  smallProfile?: string;
  hitpoints: number;
  movementType: string;
  movement: number;
  experience: number;
  level: number;
  alignment: string;
  advancesTo: string[];
  cost: number;
  usage?: string;
  description: string;
  attacks: AttackData[];
  abilities?: string[];
  animations?: AnimationData[];
  dieSound?: string;
  female?: Partial<UnitTypeData>;
  macros?: string[];
  movementCostOverrides?: Record<string, number>;
  defenseOverrides?: Record<string, number>;
  sourceFile: string;
}

function cleanImagePath(s: string | undefined): string | undefined {
  if (!s) return s;
  let cleaned = s.trim();

  // If there's a ~BLIT onto a shadow/halo/misc image, prefer the blitted image
  if ((cleaned.includes('shadow') || cleaned.includes('halo') || cleaned.includes('misc')) && cleaned.includes('~BLIT(')) {
    const match = cleaned.match(/~BLIT\s*\(\s*"?([^"~)]+)/);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
  }

  // Remove any remaining Image Path Functions starting with ~
  const tildeIndex = cleaned.indexOf('~');
  if (tildeIndex !== -1) {
    cleaned = cleaned.slice(0, tildeIndex);
  }

  // Remove trailing garbage like quotes, closing parens, or animation durations
  cleaned = cleaned.replace(/(:[0-9*~,\[\]]+)?["')]+$/, '').trim();
  cleaned = cleaned.replace(/:[0-9*~,\[\]]+$/, '').trim();

  return cleaned;
}

function extractAttack(node: WmlNode): AttackData {
  const specials = getListAttr(node, 'specials_list');
  return {
    name: getAttr(node, 'name') ?? '',
    description: cleanTranslation(getAttr(node, 'description') ?? ''),
    type: getAttr(node, 'type') ?? '',
    range: getAttr(node, 'range') ?? '',
    damage: getNumAttr(node, 'damage') ?? 0,
    number: getNumAttr(node, 'number') ?? 0,
    icon: cleanImagePath(getAttr(node, 'icon')),
    specials: specials.length > 0 ? specials : undefined,
  };
}

function extractAnimationFrames(node: WmlNode): AnimationFrameData[] {
  const frames: AnimationFrameData[] = [];
  const frameNodes = node.children.filter((c) => c.tag.endsWith('frame'));
  for (const frameNode of frameNodes) {
    const image = cleanImagePath(getAttr(frameNode, 'image'));
    if (!image) continue;
    frames.push({
      image,
      duration: getNumAttr(frameNode, 'duration'),
      sound: getAttr(frameNode, 'sound'),
    });
  }
  return frames;
}

function extractAnimations(node: WmlNode): AnimationData[] {
  const animations: AnimationData[] = [];

  // Standing animations
  for (const anim of findChildren(node, 'standing_anim')) {
    const frames = extractAnimationFrames(anim);
    if (frames.length > 0) {
      animations.push({
        type: 'standing',
        direction: getAttr(anim, 'direction'),
        frames,
      });
    }
  }

  // Idle animations
  for (const anim of findChildren(node, 'idle_anim')) {
    const frames = extractAnimationFrames(anim);
    if (frames.length > 0) {
      animations.push({
        type: 'idle',
        direction: getAttr(anim, 'direction'),
        frames,
      });
    }
  }

  // Death animations
  for (const anim of findChildren(node, 'death')) {
    const frames = extractAnimationFrames(anim);
    if (frames.length > 0) {
      animations.push({ type: 'death', frames });
    }
  }

  // Attack animations
  for (const anim of findChildren(node, 'attack_anim')) {
    const filterNode = findChild(anim, 'filter_attack');
    const filterAttack = filterNode ? getAttr(filterNode, 'name') : undefined;
    const frames = extractAnimationFrames(anim);
    if (frames.length > 0) {
      animations.push({
        type: 'attack',
        direction: getAttr(anim, 'direction'),
        filterAttack,
        frames,
      });
    }
  }

  return animations;
}

function extractUnitType(
  node: WmlNode,
  sourceFile: string,
  wesnothRoot: string,
): UnitTypeData | null {
  const id = getAttr(node, 'id');
  if (!id) return null;

  const attacks = findChildren(node, 'attack').map(extractAttack);
  const animations = extractAnimations(node);
  const abilities = getListAttr(node, 'abilities_list');

  // Check for inline movement_costs / defense overrides
  const mcOverride = findChild(node, 'movement_costs');
  const defOverride = findChild(node, 'defense');
  let movementCostOverrides: Record<string, number> | undefined;
  let defenseOverrides: Record<string, number> | undefined;

  if (mcOverride) {
    movementCostOverrides = {};
    for (const [k, v] of Object.entries(mcOverride.attributes)) {
      const n = Number(v);
      if (!Number.isNaN(n)) movementCostOverrides[k] = n;
    }
    if (Object.keys(movementCostOverrides).length === 0)
      movementCostOverrides = undefined;
  }
  if (defOverride) {
    defenseOverrides = {};
    for (const [k, v] of Object.entries(defOverride.attributes)) {
      const n = Number(v);
      if (!Number.isNaN(n)) defenseOverrides[k] = n;
    }
    if (Object.keys(defenseOverrides).length === 0)
      defenseOverrides = undefined;
  }

  // Filter macros: exclude name-generation macros and known-processed ones
  const significantMacros = node.macros.filter(
    (m) =>
      !m.includes('_NAMES') &&
      !m.startsWith('SOUND_LIST:') &&
      !m.startsWith('SOUND:') &&
      !m.startsWith('wmllint:') &&
      !m.startsWith('wmlscope:'),
  );

  // Female variant
  let female: Partial<UnitTypeData> | undefined;
  const femaleNode = findChild(node, 'female');
  if (femaleNode) {
    const femaleAnims = extractAnimations(femaleNode);
    female = {
      name: cleanTranslation(getAttr(femaleNode, 'name')),
      gender: ['female'],
      image: cleanImagePath(getAttr(femaleNode, 'image')),
      profile: cleanImagePath(getAttr(femaleNode, 'profile')),
      smallProfile: cleanImagePath(getAttr(femaleNode, 'small_profile')),
      dieSound: getAttr(femaleNode, 'die_sound'),
      animations: femaleAnims.length > 0 ? femaleAnims : undefined,
    };
    // Remove undefined fields
    female = removeUndefined(female) as Partial<UnitTypeData>;
    if (Object.keys(female).length === 0) female = undefined;
  }

  const baseUnitNode = findChild(node, 'base_unit');
  const baseUnitId = baseUnitNode ? getAttr(baseUnitNode, 'id') : undefined;
  const hideHelp = getAttr(node, 'hide_help') === 'yes' || undefined;
  const doNotList = getAttr(node, 'do_not_list') === 'yes' || undefined;

  let image = cleanImagePath(getAttr(node, 'image')) ?? '';
  if (!image || image.includes('blank-hex') || image.includes('halo/')) {
    const betterFrame = animations.flatMap((a) => a.frames).find((f) => f.image && !f.image.includes('blank-hex') && !f.image.includes('halo/'));
    if (betterFrame) {
      image = betterFrame.image;
    }
  }

  return {
    id,
    name: cleanTranslation(getAttr(node, 'name') ?? id),
    race: getAttr(node, 'race') ?? '',
    gender: getListAttr(node, 'gender'),
    image,
    profile: cleanImagePath(getAttr(node, 'profile')),
    smallProfile: cleanImagePath(getAttr(node, 'small_profile')),
    hitpoints: getNumAttr(node, 'hitpoints') ?? 0,
    movementType: getAttr(node, 'movement_type') ?? '',
    movement: getNumAttr(node, 'movement') ?? 0,
    experience: getNumAttr(node, 'experience') ?? 0,
    level: getNumAttr(node, 'level') ?? 0,
    alignment: getAttr(node, 'alignment') ?? 'neutral',
    advancesTo: getListAttr(node, 'advances_to'),
    cost: getNumAttr(node, 'cost') ?? 0,
    usage: getAttr(node, 'usage'),
    description: cleanTranslation(getAttr(node, 'description') ?? ''),
    attacks,
    abilities: abilities.length > 0 ? abilities : undefined,
    animations: animations.length > 0 ? animations : undefined,
    dieSound: getAttr(node, 'die_sound'),
    female,
    macros: significantMacros.length > 0 ? significantMacros : undefined,
    movementCostOverrides,
    defenseOverrides,
    baseUnitId,
    hideHelp,
    doNotList,
    sourceFile: relative(wesnothRoot, sourceFile),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanTranslation(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  // Remove race^ and female^ prefixes from translated names
  let cleaned = s.replace(/^(race|female|race\+female|race\+plural)\^/, '');
  // Remove any remaining WML markup
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

function removeUndefined(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value) && value.length === 0) continue;
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Code Generation
// ---------------------------------------------------------------------------

function generateTypeImport(): string {
  return `// Auto-generated by scripts/wesnoth/src/extract-units.ts
// Do not edit manually. Re-run the extraction script to update.
`;
}

function stringifyData(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

function writeGeneratedFile(
  outDir: string,
  filename: string,
  varName: string,
  typeName: string,
  data: unknown,
): void {
  const importPath = '../types.ts';
  const content = `${generateTypeImport()}
import type { ${typeName} } from "${importPath}";

export const ${varName}: ${typeName}[] = ${stringifyData(data)};
`;
  writeFileSync(join(outDir, filename), content, 'utf-8');
  console.log(
    `  Written: ${filename} (${Array.isArray(data) ? data.length : 0} entries)`,
  );
}

function writeProvenanceFile(
  outDir: string,
  wesnothRoot: string,
  revision: string,
): void {
  const importPath = '../types.ts';
  const provenance = {
    revision,
    extractedAt: new Date().toISOString(),
    sourceFiles,
    imageStats: {
      totalFiles: 0,
      totalSizeBytes: 0,
      directories: [],
    },
  };

  const content = `${generateTypeImport()}
import type { WesnothProvenance } from "${importPath}";

export const provenance: WesnothProvenance = ${stringifyData(provenance)};
`;
  writeFileSync(join(outDir, 'provenance.ts'), content, 'utf-8');
  console.log('  Written: provenance.ts');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { wesnothRoot } = parseArgs();
  console.log(`\nWesnoth root: ${wesnothRoot}`);

  // Determine output directory
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

  // Get git revision
  let revision = 'unknown';
  try {
    revision = execSync('git rev-parse HEAD', { cwd: wesnothRoot })
      .toString()
      .trim();
  } catch {
    console.warn('  Warning: Could not determine git revision');
  }
  console.log(`Wesnoth revision: ${revision}`);

  // Load macro dictionary
  console.log('\nPhase 1: Loading macro dictionary...');
  const macroDir = join(wesnothRoot, 'data', 'core', 'macros');
  const macros = loadMacroDictionary(macroDir);
  // Track macro files
  for (const file of collectCfgFiles(macroDir)) {
    trackFile(wesnothRoot, file, 'macro');
  }

  // Parse units.cfg for races, movetypes, etc.
  console.log('\nPhase 2: Parsing units.cfg...');
  const unitsCfgPath = join(wesnothRoot, 'data', 'core', 'units.cfg');
  const unitsCfgContent = readFileSync(unitsCfgPath, 'utf-8');
  trackFile(wesnothRoot, unitsCfgPath, 'units_cfg');

  const unitsCfgTree = parseWml(unitsCfgContent, macros);
  const unitsRoot = findChild(unitsCfgTree, 'units') ?? unitsCfgTree;

  // Extract races
  const races: RaceData[] = [];
  for (const raceNode of findChildren(unitsRoot, 'race')) {
    const race = extractRace(raceNode);
    if (race) races.push(race);
  }
  console.log(`  Found ${races.length} races`);

  // Extract movetypes
  const movetypes: MovetypeData[] = [];
  for (const mtNode of findChildren(unitsRoot, 'movetype')) {
    const mt = extractMovetype(mtNode, macros);
    if (mt) movetypes.push(mt);
  }
  console.log(`  Found ${movetypes.length} movetypes`);

  // Parse individual unit files
  console.log('\nPhase 3: Parsing unit files...');
  const unitsDir = join(wesnothRoot, 'data', 'core', 'units');
  const unitFiles = collectCfgFiles(unitsDir);
  console.log(`  Found ${unitFiles.length} .cfg files`);

  const unitTypes: UnitTypeData[] = [];
  let parseErrors = 0;

  for (const filePath of unitFiles) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const tree = parseWml(content, macros);
      trackFile(wesnothRoot, filePath, 'unit_type');

      // Find all [unit_type] nodes (usually 1 per file)
      const unitTypeNodes = findChildren(tree, 'unit_type');
      for (const utNode of unitTypeNodes) {
        const ut = extractUnitType(utNode, filePath, wesnothRoot);
        if (ut) unitTypes.push(ut);
      }
    } catch (err) {
      parseErrors++;
      console.error(`  Error parsing ${basename(filePath)}: ${err}`);
    }
  }

  console.log(
    `  Extracted ${unitTypes.length} unit types (${parseErrors} errors)`,
  );

  // Phase 3b: Resolve [base_unit] inheritance
  console.log('\nPhase 3b: Resolving [base_unit] inheritance...');
  const unitMap = new Map<string, UnitTypeData>();
  for (const ut of unitTypes) {
    unitMap.set(ut.id, ut);
  }

  for (const ut of unitTypes) {
    if (ut.baseUnitId) {
      const baseUt = unitMap.get(ut.baseUnitId);
      if (baseUt) {
        if (!ut.race) ut.race = baseUt.race;
        if (!ut.image) ut.image = baseUt.image;
        if (!ut.profile) ut.profile = baseUt.profile;
        if (!ut.smallProfile) ut.smallProfile = baseUt.smallProfile;
        if (!ut.hitpoints) ut.hitpoints = baseUt.hitpoints;
        if (!ut.movementType) ut.movementType = baseUt.movementType;
        if (!ut.movement) ut.movement = baseUt.movement;
        if (!ut.experience) ut.experience = baseUt.experience;
        if (!ut.level) ut.level = baseUt.level;
        if (!ut.alignment || ut.alignment === 'neutral') ut.alignment = baseUt.alignment;
        if (!ut.cost) ut.cost = baseUt.cost;
        if (!ut.usage) ut.usage = baseUt.usage;
        if (!ut.description) ut.description = baseUt.description;
        if (ut.attacks.length === 0) ut.attacks = [...baseUt.attacks];
        if (!ut.animations) ut.animations = baseUt.animations ? [...baseUt.animations] : undefined;
      }
    }
  }

  // Sort unit types by id for stable output
  unitTypes.sort((a, b) => a.id.localeCompare(b.id));
  races.sort((a, b) => a.id.localeCompare(b.id));
  movetypes.sort((a, b) => a.name.localeCompare(b.name));

  // Write output files
  console.log('\nPhase 4: Writing output...');
  writeGeneratedFile(
    outDir,
    'units.ts',
    'unitTypes',
    'WesnothUnitType',
    unitTypes,
  );
  writeGeneratedFile(outDir, 'races.ts', 'races', 'WesnothRace', races);
  writeGeneratedFile(
    outDir,
    'movetypes.ts',
    'movetypes',
    'WesnothMovetype',
    movetypes,
  );
  writeProvenanceFile(outDir, wesnothRoot, revision);

  console.log('\nDone! ✓');
  console.log(`  Output directory: ${outDir}`);
  console.log(`  Unit types: ${unitTypes.length}`);
  console.log(`  Races: ${races.length}`);
  console.log(`  Movetypes: ${movetypes.length}`);
  console.log(`  Source files tracked: ${sourceFiles.length}`);
}

main();
