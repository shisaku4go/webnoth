/**
 * extract-images.ts — Image Asset Extraction Script
 *
 * Copies all unit-related image assets from the Wesnoth repository
 * into packages/wesnoth-data/assets/.
 *
 * Directories copied:
 *   - data/core/images/units/      → assets/units/       (~28MB)
 *   - data/core/images/portraits/  → assets/portraits/   (~33MB)
 *   - data/core/images/attacks/    → assets/attacks/      (~1.3MB)
 *   - data/core/images/projectiles/ → assets/projectiles/
 *
 * Usage:
 *   pnpm run extract:images -- --wesnoth-root <path-to-wesnoth>
 *
 * NOTE: Total asset size is 60MB+. Currently committed to Git as regular files.
 * Future considerations:
 *   - Migrate to Git LFS for .png/.webp files
 *   - Exclude assets from the npm package and provide separate download
 *   - Generate optimized/compressed variants (WebP, sprite sheets)
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

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
    console.error('Usage: pnpm run extract:images -- --wesnoth-root <path>');
    process.exit(1);
  }

  wesnothRoot = resolve(wesnothRoot);
  if (!existsSync(join(wesnothRoot, 'data', 'core', 'images'))) {
    console.error(`Error: ${wesnothRoot}/data/core/images/ not found`);
    process.exit(1);
  }

  return { wesnothRoot };
}

// ---------------------------------------------------------------------------
// Directory copy
// ---------------------------------------------------------------------------

interface CopyStats {
  files: number;
  bytes: number;
}

function copyDirectoryRecursive(
  src: string,
  dest: string,
  stats: CopyStats,
): void {
  if (!existsSync(src)) {
    console.warn(`  Warning: Source directory not found: ${src}`);
    return;
  }

  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src);

  for (const entry of entries) {
    if (entry.startsWith('.')) continue;

    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, stats);
    } else {
      // Ensure parent directory exists
      mkdirSync(dirname(destPath), { recursive: true });
      copyFileSync(srcPath, destPath);
      stats.files++;
      stats.bytes += stat.size;
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Update provenance
// ---------------------------------------------------------------------------

function updateProvenanceImageStats(
  provenancePath: string,
  stats: CopyStats,
  directories: string[],
): void {
  if (!existsSync(provenancePath)) {
    console.warn('  Warning: provenance.ts not found, skipping update');
    return;
  }

  let content = readFileSync(provenancePath, 'utf-8');

  // Replace the imageStats block
  const imageStatsStr = JSON.stringify(
    {
      totalFiles: stats.files,
      totalSizeBytes: stats.bytes,
      directories,
    },
    null,
    4,
  );

  // Use regex to replace the imageStats object
  content = content.replace(
    /"imageStats":\s*\{[^}]*\}/s,
    `"imageStats": ${imageStatsStr}`,
  );

  writeFileSync(provenancePath, content, 'utf-8');
  console.log('  Updated provenance.ts with image stats');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const { wesnothRoot } = parseArgs();
  console.log(`\nWesnoth root: ${wesnothRoot}`);

  const scriptDir = new URL('.', import.meta.url).pathname;
  const projectRoot = resolve(scriptDir, '..', '..', '..');
  const assetsDir = join(projectRoot, 'packages', 'wesnoth-data', 'assets');

  // Directories to copy
  const imageDirs = [
    { src: 'data/core/images/units', dest: 'units' },
    { src: 'data/core/images/portraits', dest: 'portraits' },
    { src: 'data/core/images/attacks', dest: 'attacks' },
    { src: 'data/core/images/projectiles', dest: 'projectiles' },
  ];

  const totalStats: CopyStats = { files: 0, bytes: 0 };
  const copiedDirs: string[] = [];

  console.log('\nCopying image assets...');

  for (const { src, dest } of imageDirs) {
    const srcPath = join(wesnothRoot, src);
    const destPath = join(assetsDir, dest);

    if (!existsSync(srcPath)) {
      console.log(`  Skipping ${src} (not found)`);
      continue;
    }

    const dirStats: CopyStats = { files: 0, bytes: 0 };
    console.log(`  Copying ${src}/ → assets/${dest}/`);
    copyDirectoryRecursive(srcPath, destPath, dirStats);
    console.log(`    ${dirStats.files} files, ${formatBytes(dirStats.bytes)}`);

    totalStats.files += dirStats.files;
    totalStats.bytes += dirStats.bytes;
    copiedDirs.push(dest);
  }

  console.log(
    `\nTotal: ${totalStats.files} files, ${formatBytes(totalStats.bytes)}`,
  );

  // Update provenance
  const provenancePath = join(
    projectRoot,
    'packages',
    'wesnoth-data',
    'src',
    'generated',
    'provenance.ts',
  );
  updateProvenanceImageStats(provenancePath, totalStats, copiedDirs);

  console.log('\nDone! ✓');
}

main();
