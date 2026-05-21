/**
 * extract-maps.ts — Map, Scenario, and Campaign Data Extraction Script
 *
 * Scans the Wesnoth repository to retrieve all official campaign maps
 * and multiplayer maps, parsing WML files and grid data.
 *
 * Usage:
 *   pnpm --filter @webnoth/scripts-wesnoth run extract-maps -- --wesnoth-root <path-to-wesnoth>
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, resolve, relative } from 'node:path';
import {
  findChild,
  findChildren,
  getAttr,
  getListAttr,
  getNumAttr,
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
    console.error('Usage: pnpm run extract-maps -- --wesnoth-root <path>');
    process.exit(1);
  }

  wesnothRoot = resolve(wesnothRoot);
  if (!existsSync(join(wesnothRoot, 'data', 'core', 'units.cfg'))) {
    console.error(`Error: ${wesnothRoot} does not look like a wesnoth repo`);
    process.exit(1);
  }

  return { wesnothRoot };
}

function cleanTranslation(s: string | undefined): string | undefined {
  if (s === undefined) return undefined;
  // Remove context prefix like "campaign^"
  let cleaned = s.replace(/^[a-zA-Z0-9_+^]+\^/, '');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

// ---------------------------------------------------------------------------
// Catalog map files recursively
// ---------------------------------------------------------------------------

function catalogMapFiles(dir: string, mapCatalog: Map<string, string>): void {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        catalogMapFiles(fullPath, mapCatalog);
      } else if (entry.endsWith('.map')) {
        mapCatalog.set(entry.toLowerCase(), fullPath);
      }
    }
  } catch (err) {
    // Ignore unreadable directories
  }
}

// ---------------------------------------------------------------------------
// Grid Parsing
// ---------------------------------------------------------------------------

interface WesnothMapPlacement<T> {
  x: number;
  y: number;
  value: T;
}

interface WesnothMap {
  id: string;
  name: string;
  width: number;
  height: number;
  grid: string[][];
  items?: WesnothMapPlacement<{ image: string }>[];
  labels?: WesnothMapPlacement<{ text: string }>[];
}

interface WesnothCampaign {
  id: string;
  name: string;
  icon?: string;
  firstScenario?: string;
  scenarios: WesnothMap[];
}

function parseMapGrid(filePath: string): { width: number; height: number; grid: string[][] } | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if (lines.length === 0) return null;

    const grid = lines.map((line) => {
      // Split by comma
      return line.split(',').map((cell) => cell.trim());
    });

    const height = grid.length;
    const width = height > 0 ? grid[0].length : 0;

    return { width, height, grid };
  } catch (err) {
    console.error(`  Error reading map file: ${filePath}`, err);
    return null;
  }
}

function extractPlacements(scenarioNode: WmlNode): {
  items: WesnothMapPlacement<{ image: string }>[];
  labels: WesnothMapPlacement<{ text: string }>[];
} {
  const items: WesnothMapPlacement<{ image: string }>[] = [];
  const labels: WesnothMapPlacement<{ text: string }>[] = [];

  for (const itemNode of findChildren(scenarioNode, 'item')) {
    const x = getNumAttr(itemNode, 'x');
    const y = getNumAttr(itemNode, 'y');
    const image = getAttr(itemNode, 'image');
    if (x !== undefined && y !== undefined && image) {
      // Convert WML 1-indexed to 0-indexed
      items.push({
        x: x - 1,
        y: y - 1,
        value: { image },
      });
    }
  }

  for (const labelNode of findChildren(scenarioNode, 'label')) {
    const x = getNumAttr(labelNode, 'x');
    const y = getNumAttr(labelNode, 'y');
    const text = getAttr(labelNode, 'text');
    if (x !== undefined && y !== undefined && text) {
      // Convert WML 1-indexed to 0-indexed
      labels.push({
        x: x - 1,
        y: y - 1,
        value: { text: cleanTranslation(text) ?? '' },
      });
    }
  }

  return { items, labels };
}

// ---------------------------------------------------------------------------
// Main Extraction Logic
// ---------------------------------------------------------------------------

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

  // 1. Catalog all map files in the repo to easily map scenario 'map_file' names
  console.log('\nStep 1: Cataloging map files...');
  const mapCatalog = new Map<string, string>();
  catalogMapFiles(join(wesnothRoot, 'data'), mapCatalog);
  console.log(`  Cataloged ${mapCatalog.size} map files.`);

  // 2. Parse campaigns
  console.log('\nStep 2: Parsing campaigns...');
  const campaignsDir = join(wesnothRoot, 'data', 'campaigns');
  const campaignEntries = readdirSync(campaignsDir);
  const campaigns: WesnothCampaign[] = [];

  for (const entry of campaignEntries) {
    const campaignPath = join(campaignsDir, entry);
    if (!statSync(campaignPath).isDirectory()) continue;

    const mainCfgPath = join(campaignPath, '_main.cfg');
    if (!existsSync(mainCfgPath)) continue;

    console.log(`  Processing campaign: ${entry}`);
    try {
      const mainContent = readFileSync(mainCfgPath, 'utf-8');
      const mainTree = parseWml(mainContent);
      const campaignNode = findChild(mainTree, 'campaign');
      if (!campaignNode) {
        // Some directories might just contain resources and no [campaign] tag
        continue;
      }

      const campaignId = getAttr(campaignNode, 'id') ?? entry;
      const campaignName = cleanTranslation(getAttr(campaignNode, 'name')) ?? campaignId;
      const firstScenario = getAttr(campaignNode, 'first_scenario');
      const icon = getAttr(campaignNode, 'icon');

      // Now scan all scenarios in campaigns/<name>/scenarios/
      const scenarios: WesnothMap[] = [];
      const scenariosDir = join(campaignPath, 'scenarios');
      if (existsSync(scenariosDir)) {
        const scenarioFiles = readdirSync(scenariosDir).filter((f) => f.endsWith('.cfg'));

        for (const sFile of scenarioFiles) {
          const sPath = join(scenariosDir, sFile);
          const sContent = readFileSync(sPath, 'utf-8');
          const sTree = parseWml(sContent);
          const scenarioNode = findChild(sTree, 'scenario') || findChild(sTree, 'test');

          if (!scenarioNode) continue;

          const sId = getAttr(scenarioNode, 'id');
          const sName = cleanTranslation(getAttr(scenarioNode, 'name')) ?? sId;
          const mapFilePathAttr = getAttr(scenarioNode, 'map_file');

          if (!sId || !mapFilePathAttr) continue;

          // Resolve map file using the catalog
          const mapFilename = basename(mapFilePathAttr).toLowerCase();
          const actualMapPath = mapCatalog.get(mapFilename);

          if (!actualMapPath) {
            // Map file could not be found, skip this scenario
            continue;
          }

          const gridData = parseMapGrid(actualMapPath);
          if (!gridData) continue;

          const { items, labels } = extractPlacements(scenarioNode);

          scenarios.push({
            id: sId,
            name: sName,
            width: gridData.width,
            height: gridData.height,
            grid: gridData.grid,
            items: items.length > 0 ? items : undefined,
            labels: labels.length > 0 ? labels : undefined,
          });
        }
      }

      if (scenarios.length > 0) {
        campaigns.push({
          id: campaignId,
          name: campaignName,
          icon,
          firstScenario,
          scenarios,
        });
      }
    } catch (err) {
      console.error(`  Error parsing campaign ${entry}:`, err);
    }
  }

  // 3. Parse Multiplayer Maps
  console.log('\nStep 3: Parsing multiplayer maps...');
  const multiplayerScenarios: WesnothMap[] = [];
  const mpScenariosDir = join(wesnothRoot, 'data', 'multiplayer', 'scenarios');

  if (existsSync(mpScenariosDir)) {
    const mpFiles = readdirSync(mpScenariosDir).filter((f) => f.endsWith('.cfg'));

    for (const f of mpFiles) {
      const filePath = join(mpScenariosDir, f);
      try {
        const content = readFileSync(filePath, 'utf-8');
        const tree = parseWml(content);
        const mpNode = findChild(tree, 'multiplayer') || findChild(tree, 'scenario');

        if (!mpNode) continue;

        const id = getAttr(mpNode, 'id');
        const name = cleanTranslation(getAttr(mpNode, 'name')) ?? id;
        const mapFilePathAttr = getAttr(mpNode, 'map_file');

        if (!id || !mapFilePathAttr) continue;

        const mapFilename = basename(mapFilePathAttr).toLowerCase();
        const actualMapPath = mapCatalog.get(mapFilename);

        if (!actualMapPath) continue;

        const gridData = parseMapGrid(actualMapPath);
        if (!gridData) continue;

        const { items, labels } = extractPlacements(mpNode);

        multiplayerScenarios.push({
          id,
          name,
          width: gridData.width,
          height: gridData.height,
          grid: gridData.grid,
          items: items.length > 0 ? items : undefined,
          labels: labels.length > 0 ? labels : undefined,
        });
      } catch (err) {
        console.error(`  Error parsing multiplayer scenario ${f}:`, err);
      }
    }
  }

  // 4. Output TypeScript Files
  console.log('\nStep 4: Writing generated files...');

  const writeMapFile = (filename: string, varName: string, typeName: string, data: unknown) => {
    const fileContent = `// Auto-generated by scripts/wesnoth/src/extract-maps.ts
// Do not edit manually. Re-run the extraction script to update.
import type { ${typeName} } from '../types.ts';

export const ${varName}: ${typeName}[] = ${JSON.stringify(data, null, 2)};
`;
    writeFileSync(join(outDir, filename), fileContent, 'utf-8');
    console.log(`  Written: ${filename}`);
  };

  writeMapFile('campaigns.ts', 'campaigns', 'WesnothCampaign', campaigns);
  writeMapFile('multiplayer.ts', 'multiplayerMaps', 'WesnothMap', multiplayerScenarios);

  console.log('\nDone! ✓');
}

main().catch(console.error);
