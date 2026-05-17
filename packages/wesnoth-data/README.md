# @webnoth/wesnoth-data

A shared package providing Wesnoth game data (units, races, movetypes) as TypeScript objects.

## Overview

Structured data extracted from the WML (Wesnoth Markup Language) files of [Battle for Wesnoth](https://wesnoth.org/). Planned for use in the following projects:

- **Unit Encyclopedia** — Display all unit parameters, images, and animations
- **Battle Simulator** — Mock battles using combat parameters
- **Web-based Wesnoth** — Full implementation of the browser game

## Usage

```typescript
// Type definitions for all data
import type { WesnothUnitType, WesnothRace, WesnothMovetype } from '@webnoth/wesnoth-data';

// Import individual data modules (supports tree-shaking)
import { unitTypes } from '@webnoth/wesnoth-data/units';
import { races } from '@webnoth/wesnoth-data/races';
import { movetypes } from '@webnoth/wesnoth-data/movetypes';
import { provenance } from '@webnoth/wesnoth-data/provenance';
```

## Data Content

| Data | Count | Description |
|--------|------|------|
| `unitTypes` | 328 | Unit types (including attacks, abilities, and animations) |
| `races` | 24 | Race definitions |
| `movetypes` | 38 | Move types (terrain costs, defenses, and resistances) |
| `provenance` | 1 | Extraction source info (Git revision, file list, etc.) |

## Image Assets

All unit-related images are stored in the `assets/` directory:

| Directory | Content | Size |
|-------------|------|--------|
| `assets/units/` | Unit sprites and animation frames | ~8.5 MB |
| `assets/portraits/` | Portrait images | ~32 MB |
| `assets/attacks/` | Attack icons | ~937 KB |
| `assets/projectiles/` | Projectile animations | ~842 KB |

> **Note:** Image assets total over 42MB. Migrating to Git LFS or separating them from the package is being considered for the future.

## Updating Data

To re-extract data from the Wesnoth repository:

```bash
# Execute from scripts/wesnoth/
cd scripts/wesnoth

# Extract unit data
npx tsx src/extract-units.ts --wesnoth-root <path-to-wesnoth>

# Extract image assets
npx tsx src/extract-images.ts --wesnoth-root <path-to-wesnoth>
```

## Future Extensions (Next Phases)

### Era / Faction Data
Planning to extract multiplayer Era/Faction information from `data/multiplayer/eras.cfg` and `data/multiplayer/factions/`. Factions refer to unit IDs (`WesnothUnitType.id`) in their `leader` and `recruit` fields, so they can naturally integrate with this package's unit data.

### Terrain Data
Extracting terrain definitions from `data/core/terrain.cfg`. Maps to Movetype keys (e.g., `shallow_water`, `forest`).

### Expanded Macro Expansion
Currently, only constant macros without arguments are expanded. Future considerations:
- Trait macros like `{TRAIT_STRONG}`, `{TRAIT_QUICK}`
- Ability macros like `{ABILITY_HEALS}`
- Animation macros like `{DEFENSE_ANIM ...}`

### `specials_list` vs `[specials]` Blocks
Currently, only the shorthand `specials_list` (comma-separated strings) is parsed. The `[specials]` block format is used in only 2 out of 327 unit files (Ant Queen variants) and is recorded as a macro name.

### Image Asset Optimization
- Git LFS integration
- WebP conversion/compression
- Sprite sheet generation
