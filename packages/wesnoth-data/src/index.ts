// @webnoth/wesnoth-data — Public API
//
// Re-exports all types. Generated data modules are available via subpath exports:
//   import { unitTypes } from '@webnoth/wesnoth-data/units';
//   import { races } from '@webnoth/wesnoth-data/races';
//   import { movetypes } from '@webnoth/wesnoth-data/movetypes';
//   import { provenance } from '@webnoth/wesnoth-data/provenance';
//   import { traits } from '@webnoth/wesnoth-data/traits';
//   import { schedules } from '@webnoth/wesnoth-data/schedules';
//   import { terrains } from '@webnoth/wesnoth-data/terrains';

export type {
  Alignment,
  AnimationType,
  AttackRange,
  DamageType,
  ProvenanceSourceFile,
  WesnothAnimation,
  WesnothAnimationFrame,
  WesnothAttack,
  WesnothData,
  WesnothEra,
  WesnothFaction,
  WesnothMovetype,
  WesnothProvenance,
  WesnothRace,
  WesnothSchedule,
  WesnothTerrain,
  WesnothTimeOfDay,
  WesnothTrait,
  WesnothTraitEffect,
  WesnothUnitType,
} from './types.ts';
