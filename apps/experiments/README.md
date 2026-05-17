# @webnoth/experiments

Experimental implementations of Wesnoth features on the Web.

**Tech Stack:** Vite 8 · React 19 · TypeScript 6 · TanStack Router · Tailwind CSS v4 · shadcn/ui

## Features

### Unit Encyclopedia (`/encyclopedia`)

A searchable unit encyclopedia for Battle for Wesnoth, powered by [`@webnoth/wesnoth-data`](../../packages/wesnoth-data/). Provides information equivalent to [units.wesnoth.org](https://units.wesnoth.org/1.19/mainline/en_US/mainline.html).

**Implemented:**

- Unit list page with race-based filtering and unit counts
- Name search
- Unit detail page with stats, attacks, resistances, and terrain modifiers
- Male/female variant display (side-by-side)
- Advancement links (Advances To)
- Resistance display in Wesnoth-standard format (e.g. "Blade: 20%")
- Terrain movement cost and defense tables

---

## Development Issues

The following items are deferred to future work, primarily requiring upstream changes in `@webnoth/wesnoth-data`.

### Data Layer — `@webnoth/wesnoth-data` Enhancements

#### 🔲 Advances From (Reverse Advancement Lookup)

**Status:** Placeholder displayed — `"⚠ In development — see @webnoth/wesnoth-data"`  
**Context:** The `advancesTo` field exists on each unit (e.g. `Elvish Archer → [Elvish Ranger, Elvish Marksman]`), but there is no corresponding `advancesFrom` field. The reverse lookup is trivial to compute, but should be provided by the library to avoid inconsistencies when the extraction pipeline is re-run.  
**Proposed:** Add a pre-computed `advancesFrom: string[]` field to `WesnothUnitType`, populated during extraction by scanning all `advancesTo` arrays.

#### 🔲 Terrain Display Names & Icons

**Status:** Placeholder displayed — `"⚠ Terrain names and icons are under development."`  
**Context:** The movetype data uses raw terrain keys (e.g. `shallow_water`, `forest`, `castle`). The application currently formats these with basic string manipulation (e.g. `shallow_water` → "Shallow Water"), but this does not match the official Wesnoth terrain names.  
**Proposed:** Extract terrain definitions from `data/core/terrain.cfg` in the wesnoth repository. This would provide:
- Official terrain display names (e.g. "Shallow Water", "Dense Forest")
- Terrain icon image paths
- Terrain type categorization

See `@webnoth/wesnoth-data` README → "Future Extensions → Terrain Data" for details.

#### 🔲 Ability Descriptions

**Status:** Displayed as name-only badges (e.g. `"heals_8"`, `"leadership"`)  
**Context:** The current WML parser extracts ability identifiers from the `abilities_list` shorthand but not the full `[abilities]` block that contains descriptions. Users must rely on Wesnoth game knowledge to understand what each ability does.  
**Proposed:** Either:
1. Parse the `[abilities]` block in WML to extract descriptions, or
2. Create a manually curated mapping file: `abilityId → { name, description }`

#### 🔲 Attack Special Descriptions

**Status:** Displayed as name-only badges (e.g. `"magical"`, `"backstab"`, `"poison"`)  
**Context:** Similar to abilities — the `specials_list` shorthand provides identifiers but not descriptions. The full `[specials]` block notation is used by only 2 of 327 unit files (Ant Queen variants).  
**Proposed:** Same approach as abilities — either parser enhancement or manual mapping.

#### 🔲 Trait Expansion

**Status:** Not displayed  
**Context:** Race data includes trait macro names (e.g. `TRAIT_STRONG`, `TRAIT_QUICK`, `TRAIT_HEALTHY`) but the parser does not expand these into their actual effects (+1 HP, +1 damage, etc.).  
**Proposed:** Expand well-known trait macros during extraction to provide structured trait data.

#### 🔲 AMLA (After Max Level Advancement)

**Status:** Not displayed  
**Context:** The `AMLA_DEFAULT` macro is recorded in the `macros` array but not expanded. AMLA defines what happens when a max-level unit gains enough experience.  
**Proposed:** Parse `AMLA_DEFAULT` and custom AMLA blocks to provide structured advancement-after-max-level data.

### UI Enhancements

#### 🔲 Era / Faction Filtering

**Context:** The encyclopedia currently filters by race only. Wesnoth multiplayer has "Eras" containing "Factions", where each faction defines leader and recruit unit pools.  
**Prerequisite:** Era/Faction data extraction in `@webnoth/wesnoth-data` (see README → "Future Extensions → Era / Faction Data").

#### 🔲 Advanced Search & Filters

**Context:** The current search is name-only. Future enhancements could include:
- Filter by level range
- Filter by alignment
- Filter by damage type or attack range
- Sort by HP, cost, level, etc.

#### 🔲 Full Advancement Tree Visualization

**Context:** Currently shows simple "Advances To" links. A tree visualization showing the full lineage (e.g. Elvish Fighter L1 → Elvish Captain L2 → Elvish Marshal L3 → ...) would be more useful.

---

## Known Limitations of the WML Parser

These are inherent limitations of the current WML parser and data extraction pipeline in `@webnoth/wesnoth-data`. They affect the completeness of displayed data but do not prevent the encyclopedia from functioning.

### 1. No `#ifdef` / `#else` / `#endif` Support

The WML preprocessor supports conditional compilation directives. The current parser does not evaluate these — all branches are flattened into the output. This may result in some units having properties from mutually exclusive branches combined.

### 2. No Complex Macro Expansion

Only constant macros without arguments (e.g. `{AMLA_DEFAULT}`) are recorded. Parameterized macros like `{DEFENSE_ANIM "image.png" "base.png" sound.ogg}` are stored as raw strings in the `macros` array. This means:
- Defense animations from `DEFENSE_ANIM` are not parsed into structured `WesnothAnimation` objects
- Trait macros (`TRAIT_STRONG`, `TRAIT_QUICK`) are not expanded into stat modifiers
- Ability macros (`ABILITY_HEALS`) are not expanded into descriptions

### 3. No WML Expressions (`$(...)`)

WML supports inline expressions like `$({ABILITY_HEALS 8})`. The parser does not evaluate these and will skip or record them as-is.

### 4. `specials_list` vs `[specials]` Blocks

Only the comma-separated `specials_list` shorthand is parsed. The full `[specials]` block notation (used by 2 of 327 unit files — Ant Queen variants) is recorded as macro names rather than fully structured data.

### 5. Movetype Inheritance

Some movetypes inherit from others (e.g. `drakefly` inherits from a base flying type). The current extraction captures the final merged values, so this is transparent to consumers. However, if a movetype has empty `movementCosts` or `defense` objects, it means those values are entirely inherited and not explicitly defined in the WML file. Flying movetypes use a `1` cost for all terrains by default.

---

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start dev server
pnpm --filter @webnoth/experiments run dev

# Build
pnpm --filter @webnoth/experiments run build

# Test
pnpm --filter @webnoth/experiments run test
```
