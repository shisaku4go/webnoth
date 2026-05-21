// =============================================================================
// @webnoth/wesnoth-data — Type Definitions
//
// TypeScript types representing Wesnoth game data extracted from WML files.
// These types are designed to be comprehensive enough for:
//   - Unit encyclopedias (図鑑)
//   - Battle simulators
//   - Full web-based Wesnoth implementation
//
// Future considerations (next phases):
//   - Era / Faction types (from data/multiplayer/)
//   - Terrain types (from data/core/terrain.cfg)
//   - Full [specials] block parsing (currently only specials_list is parsed;
//     the full [specials] block notation is used by only 2 of 327 unit files)
//   - Complex macro expansion (AMLA_DEFAULT, DEFENSE_ANIM, TRAIT_* etc.)
// =============================================================================

// === Damage & Attack ===

export type DamageType =
  | 'blade'
  | 'pierce'
  | 'impact'
  | 'fire'
  | 'cold'
  | 'arcane';

export type AttackRange = 'melee' | 'ranged';

export interface WesnothAttack {
  name: string;
  description: string;
  type: DamageType;
  range: AttackRange;
  damage: number;
  number: number;
  icon?: string;
  /**
   * Weapon specials parsed from `specials_list` (comma-separated).
   * Examples: ["firststrike"], ["magical"], ["backstab", "poison"]
   *
   * NOTE: The full [specials] block notation (used by Ant Queen etc.)
   * is recorded as macro names rather than fully expanded.
   */
  specials?: string[];
}

// === Animation ===

export interface WesnothAnimationFrame {
  /** Image path in WML notation (may include range syntax like [1~4]) */
  image: string;
  /** Frame duration in milliseconds */
  duration?: number;
  /** Sound file path */
  sound?: string;
}

export type AnimationType = 'standing' | 'idle' | 'death' | 'attack' | 'defend';

export interface WesnothAnimation {
  type: AnimationType;
  /** Comma-separated direction filter, e.g. "s,se,sw" */
  direction?: string;
  /** Attack name filter for attack/defend animations */
  filterAttack?: string;
  frames: WesnothAnimationFrame[];
}

// === Unit Type ===

export type Alignment = 'lawful' | 'neutral' | 'chaotic' | 'liminal';

export interface WesnothUnitType {
  id: string;
  name: string;
  race: string;
  gender?: string[];
  image: string;
  profile?: string;
  smallProfile?: string;
  hitpoints: number;
  /** Reference to a WesnothMovetype.name */
  movementType: string;
  movement: number;
  experience: number;
  level: number;
  alignment: Alignment;
  /** Unit IDs this unit can advance to. Empty array or ["null"] for max level. */
  advancesTo: string[];
  cost: number;
  /** Usage hint for AI: "fighter", "archer", "mixed fighter", "scout", etc. */
  usage?: string;
  description: string;
  attacks: WesnothAttack[];
  /**
   * Abilities parsed from `abilities_list` (comma-separated).
   * Examples: ["leadership"], ["heals_8", "cures"], ["skirmisher"]
   */
  abilities?: string[];
  animations?: WesnothAnimation[];
  dieSound?: string;
  /** Male variant overrides (partial) */
  male?: Partial<WesnothUnitType>;
  /** Female variant overrides (partial) */
  female?: Partial<WesnothUnitType>;
  /**
   * Unexpanded macro invocations found in this unit definition.
   * These are complex macros (multi-line, parameterized) that were
   * not expanded during extraction. Examples: "AMLA_DEFAULT",
   * "DEFENSE_ANIM ...", "TRAIT_STRONG"
   */
  macros?: string[];
  /**
   * Inline movement cost overrides (some units override their movetype).
   * Example: Ant Queen overrides fungus movement cost.
   */
  movementCostOverrides?: Record<string, number>;
  /** Inline defense overrides. */
  defenseOverrides?: Record<string, number>;
  /** ID of the base unit this unit inherits from */
  baseUnitId?: string;
  /** Whether this unit is hidden from the help/encyclopedia */
  hideHelp?: boolean;
  /** Whether this unit is excluded from encyclopedia listings */
  doNotList?: boolean;
  /** WML source file path relative to wesnoth repo root */
  sourceFile: string;
}

// === Race ===

export interface WesnothRace {
  id: string;
  name: string;
  femaleName?: string;
  pluralName: string;
  description: string;
  numTraits: number;
  undeadVariation?: string;
  /**
   * Trait macro names. Examples: ["TRAIT_HEALTHY"], ["TRAIT_WEAK", "TRAIT_SLOW"]
   */
  traits?: string[];
  ignoreGlobalTraits?: boolean;
  /** Taxonomy override for help system, e.g. "human" for dunefolk */
  helpTaxonomy?: string;
  /** Markov chain size for name generation */
  markovChainSize?: number;
}

// === Movetype ===

export interface WesnothMovetype {
  name: string;
  flying?: boolean;
  /** Movement cost per terrain type (lower = easier). Missing = impassable. */
  movementCosts: Record<string, number>;
  /** Defense chance per terrain (% chance of being hit; lower = better defense) */
  defense: Record<string, number>;
  /** Damage resistance per type (100 = normal, <100 = resistant, >100 = vulnerable) */
  resistance: Record<string, number>;
}

// === Trait ===

export interface WesnothTraitEffect {
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
  abilities?: Record<string, unknown>; // Parsed custom abilities block if any
}

export interface WesnothTrait {
  id: string;
  name: string;
  femaleName?: string;
  description?: string;
  helpText?: string;
  availability?: string; // e.g. "musthave"
  effects: WesnothTraitEffect[];
}

// === Time of Day & Schedule ===

export interface WesnothTimeOfDay {
  id: string;
  name: string;
  image: string;
  lawfulBonus?: number;
  red?: number;
  green?: number;
  blue?: number;
  sound?: string;
}

export interface WesnothSchedule {
  id: string;
  name?: string;
  description?: string;
  times: string[]; // Array of WesnothTimeOfDay IDs
}

// === Terrain ===

export interface WesnothTerrain {
  id: string;
  name: string;
  editorName?: string;
  code: string; // WML representation e.g. "Gg", "^Ft"
  aliasOf?: string[];
  submerge?: number;
  editorGroup?: string[];
  heals?: number;
  light?: number;
  defaultBase?: string;
  helpTopicText?: string;
}

// === Provenance (出所情報) ===

export interface WesnothProvenance {
  /** Git revision (SHA) of the wesnoth repository used for extraction */
  revision: string;
  /** Extraction timestamp in ISO 8601 format */
  extractedAt: string;
  /** List of all source files processed */
  sourceFiles: ProvenanceSourceFile[];
  /** Statistics about copied image assets */
  imageStats: {
    totalFiles: number;
    totalSizeBytes: number;
    directories: string[];
  };
}

export interface ProvenanceSourceFile {
  /** Path relative to wesnoth repo root */
  relativePath: string;
  /** Category: "unit_type", "race", "movetype", "macro", "image_dir" */
  category: string;
}

// === Era & Faction ===

export interface WesnothEra {
  id: string;
  name: string;
  description: string;
}

export interface WesnothFaction {
  id: string;
  name: string;
  image: string;
  recruit: string[];
  leader: string[];
  randomLeader?: string[];
  terrainLiked?: string[];
  description?: string;
  eraId: string;
}

// === Aggregate ===

export interface WesnothData {
  unitTypes: WesnothUnitType[];
  races: WesnothRace[];
  movetypes: WesnothMovetype[];
  eras?: WesnothEra[];
  factions?: WesnothFaction[];
  traits?: WesnothTrait[];
  schedules?: WesnothSchedule[];
  terrains?: WesnothTerrain[];
  provenance: WesnothProvenance;
}
