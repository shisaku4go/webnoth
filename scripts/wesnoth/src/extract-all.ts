/**
 * extract-all.ts — Wrapper script to run both unit and image extraction
 *
 * Usage:
 *   pnpm run extract:all -- --wesnoth-root <path-to-wesnoth>
 */

import { execFileSync } from 'node:child_process';

function main() {
  const args = process.argv.slice(2);

  console.log('=== Starting Wesnoth Data Extraction ===\n');

  try {
    console.log('--- Step 1: Extracting Units ---');
    execFileSync('pnpm', ['exec', 'tsx', 'src/extract-units.ts', ...args], {
      stdio: 'inherit',
    });

    console.log('\n--- Step 2: Extracting Images ---');
    execFileSync('pnpm', ['exec', 'tsx', 'src/extract-images.ts', ...args], {
      stdio: 'inherit',
    });

    console.log('\n--- Step 3: Extracting Maps ---');
    execFileSync('pnpm', ['exec', 'tsx', 'src/extract-maps.ts', ...args], {
      stdio: 'inherit',
    });

    console.log('\n--- Step 4: Formatting Generated Files with Biome ---');
    execFileSync(
      'npx',
      [
        'biome',
        'check',
        '--write',
        '../../packages/wesnoth-data/src/generated',
      ],
      {
        stdio: 'inherit',
      },
    );

    console.log('\n=== All extractions completed successfully! ===');
  } catch (_err) {
    console.error('\nExtraction failed.');
    process.exit(1);
  }
}

main();
