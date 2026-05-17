# Wesnoth Data Extraction Scripts

A suite of scripts that generate TypeScript objects from Wesnoth WML files.

## Prerequisites

- Node.js 24+
- A local clone of the [Wesnoth repository](https://github.com/wesnoth/wesnoth)

## Scripts

### `extract-units.ts` — Unit Data Extraction

Parses WML files and outputs the following data to `packages/wesnoth-data/src/generated/`:

- `units.ts` — All unit types (including attacks, abilities, and animations)
- `races.ts` — All race definitions
- `movetypes.ts` — All move types (terrain costs, defenses, and resistances)
- `provenance.ts` — Extraction source info (Git revision, file list)

```bash
pnpm run extract -- --wesnoth-root <path-to-wesnoth>
```

### `extract-images.ts` — Image Asset Extraction

Copies image assets from the Wesnoth repository to `packages/wesnoth-data/assets/`:

```bash
pnpm run extract:images -- --wesnoth-root <path-to-wesnoth>
```

### Extract All (`extract:all`)

Runs both scripts sequentially:

```bash
pnpm run extract:all -- --wesnoth-root <path-to-wesnoth>
```

## About the WML Parser

`src/wml-parser.ts` supports the following WML syntax:

| Syntax | Supported | Notes |
|------|---------|------|
| `[tag]` / `[/tag]` nesting | ✅ | |
| `key=value` pairs | ✅ | Includes removing translation markers `_ "..."` |
| `{MACRO}` constant macros without args | ✅ | Expanded using the macro dictionary |
| `{MACRO args...}` macros with parameters | ⚠️ | Recorded as macro names (unexpanded) |
| `[+tag]` merge syntax | ✅ | |
| String concatenation (`+`) | ✅ | |
| Multi-line strings | ✅ | |
| `#define` / `#enddef` | ✅ | Skipped (handled separately by macro-loader) |
| `#ifdef` / `#else` / `#endif` | ❌ | Not supported |
| WML expressions `$(...)` | ❌ | Not supported |

### Macro Expansion Policy

`src/macro-loader.ts` reads parameter-less, single-line constant macros from `data/core/macros/` into a dictionary and expands them inline during parsing.

**Examples of expanded macros:**
- `{SOUND_LIST:HUMAN_DIE}` → `"human-die-[1~3].ogg"`
- `{SOUND_LIST:SWORD_SWISH}` → `"sword-1.ogg"`

**Examples of unexpanded macros (only names are recorded):**
- `{AMLA_DEFAULT}` — Multi-line advancement definitions
- `{DEFENSE_ANIM "img1.png" "img2.png" sound.ogg}` — Animations with parameters
- `{TRAIT_STRONG}` — Trait definitions (multi-line)
