export interface PuzzleUnitPlacement {
  unitTypeId: string;
  side: number;
  x: number;
  y: number;
  isLeader?: boolean;
}

export interface PuzzleStage {
  id: string;
  seriesId: 'tutorial' | 'rebels_campaign';
  name: string;
  description: string;
  mapName: string;
  width: number;
  height: number;
  grid: string[][];
  turnLimit: number;
  objective: 'defeat_all';
  startingUnits: PuzzleUnitPlacement[];
  hints: string[];
}

export const puzzleStages: PuzzleStage[] = [
  {
    id: 'stage_1',
    seriesId: 'tutorial',
    name: 'Stage 1: Forest Ambush',
    description:
      'You are ambushed in a dense pine forest! Orcish invaders are advancing. Use the high defensive cover of the forest to outmaneuver them.',
    mapName: 'Forest Arena',
    width: 7,
    height: 7,
    grid: [
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg^Fp', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 6,
    objective: 'defeat_all',
    startingUnits: [
      // Player units (Rebels)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 2, y: 4, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 1, y: 5 },
      // Enemy units (Northerners)
      { unitTypeId: 'Orcish Grunt', side: 2, x: 4, y: 2 },
      { unitTypeId: 'Goblin Spearman', side: 2, x: 5, y: 1 },
    ],
    hints: [
      'Elves get 60% defense in Forest (Gg^Fp) compared to 40% in Grassland (Gg). Try to end your turns on forest tiles.',
      'Keep your Elvish Archer behind the Fighter to avoid taking heavy melee damage.',
      'The Village (Gg^Vh) heals the occupant by 8 HP at the start of each turn. Occupy it to deny the enemy healing!',
    ],
  },
  {
    id: 'stage_2',
    seriesId: 'tutorial',
    name: 'Stage 2: Mountain Chokepoint',
    description:
      'A critical mountain pass is guarded by an Orcish Assassin and their grunt ally. Dwarvish fighters are extremely resilient on mountainous terrains—hold the line!',
    mapName: 'Mountain Pass',
    width: 8,
    height: 8,
    grid: [
      ['Mm', 'Mm', 'Mm', 'Hh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Mm', 'Mm', 'Hh', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Mm', 'Hh', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Hh', 'Gg', 'Gg', 'Ch', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Ch', 'Kh', 'Ch', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Ch', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 8,
    objective: 'defeat_all',
    startingUnits: [
      // Player units (Knalgan Alliance)
      { unitTypeId: 'Dwarvish Fighter', side: 1, x: 2, y: 5, isLeader: true },
      { unitTypeId: 'Dwarvish Thunderer', side: 1, x: 1, y: 6 },
      // Enemy units (Northerners)
      { unitTypeId: 'Orcish Assassin', side: 2, x: 3, y: 2 },
      { unitTypeId: 'Orcish Grunt', side: 2, x: 4, y: 3 },
    ],
    hints: [
      'Dwarves get 70% defense on Mountains (Mm) and 60% on Hills (Hh). Position your Dwarvish Fighter there.',
      'The Orcish Assassin uses ranged poison attacks. Poison drains 8 HP every turn and cannot be cured except by resting in a Village.',
      'Dwarvish Thunderer has a very powerful ranged attack (Thunderstick) but only 1 strike. Use it carefully!',
    ],
  },
  {
    id: 'stage_3',
    seriesId: 'tutorial',
    name: 'Stage 3: River Defense',
    description:
      'An Undead force is trying to cross the river. You must hold the riverbank. Do not venture into the water, and exploit the Skeletons vulnerabilities!',
    mapName: 'River Ford',
    width: 8,
    height: 8,
    grid: [
      ['Gg', 'Gg', 'Gg^Fp', 'Ww', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Ww', 'Ww', 'Gg', 'Gg^Fp', 'Gg', 'Gg'],
      ['Gg', 'Ww', 'Ww', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg^Vh', 'Ww', 'Gg', 'Gg', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Ww', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Ww', 'Ww', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Ww', 'Ww', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Ww', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 10,
    objective: 'defeat_all',
    startingUnits: [
      // Player units (Loyalists)
      { unitTypeId: 'Spearman', side: 1, x: 4, y: 3, isLeader: true },
      { unitTypeId: 'Mage', side: 1, x: 4, y: 4 },
      { unitTypeId: 'Heavy Infantryman', side: 1, x: 5, y: 2 },
      // Enemy units (Undead)
      { unitTypeId: 'Skeleton', side: 2, x: 1, y: 2 },
      { unitTypeId: 'Dark Adept', side: 2, x: 2, y: 1 },
      { unitTypeId: 'Walking Corpse', side: 2, x: 0, y: 3 },
    ],
    hints: [
      'Water (Ww) is extremely dangerous. Units standing in water have only 20% defense and take full damage.',
      'Skeletons are highly resistant to pierce and blade damage, but vulnerable to impact (Heavy Infantryman) and fire (Mage).',
      'The Spearman has Firststrike on their melee pierce attack—they strike first when attacked, which is excellent for defending choke points.',
    ],
  },
  {
    id: 'stage_rebels_1',
    seriesId: 'rebels_campaign',
    name: 'Rebels 1: Forest Patrol',
    description:
      'Rebels Campaign - Stage 1: You are patrolling the border when orc scouts ambush your squad. Coordinate your Fighter, Archer, and Shaman using the high forest defense!',
    mapName: 'Border Forest',
    width: 7,
    height: 7,
    grid: [
      ['Gg', 'Gg', 'Gg^Fp', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 7,
    objective: 'defeat_all',
    startingUnits: [
      // Player units templates (Rebels starting squad)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 2, y: 4, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 1, y: 5 },
      { unitTypeId: 'Elvish Shaman', side: 1, x: 3, y: 5 },
      // Enemy units (Northerners)
      { unitTypeId: 'Orcish Grunt', side: 2, x: 4, y: 2 },
      { unitTypeId: 'Goblin Spearman', side: 2, x: 5, y: 1 },
      { unitTypeId: 'Orcish Archer', side: 2, x: 3, y: 1 },
    ],
    hints: [
      'Elves get 60% defense in Forest (Gg^Fp). Lure the Grunts into the trees and fight from cover.',
      'The Elvish Shaman can heal adjacent allies for +4 HP at the start of your turn. Keep her adjacent to wounded units.',
      'The Shaman\'s ranged attack "Entangle" inflicts the "Slowed" status, which halves target\'s movement and damage. Use it to neutralize the heavy hitting Grunt.',
    ],
  },
  {
    id: 'stage_rebels_2',
    seriesId: 'rebels_campaign',
    name: 'Rebels 2: Swamp Escape',
    description:
      'Rebels Campaign - Stage 2: Fleeing from reinforcements, your squad reaches a swamp. Undead forces rise from the mud. Maintain high defensive ground and watch out for the swamp water!',
    mapName: 'Dead Swamps',
    width: 8,
    height: 8,
    grid: [
      ['Gg', 'Gg^Fp', 'Gg^Fp', 'Ss', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Ss', 'Ss', 'Gg', 'Gg^Fp', 'Gg', 'Gg'],
      ['Gg', 'Ss', 'Ss', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg^Vh', 'Ss', 'Gg', 'Gg^Fp', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Ss', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Ss', 'Ss', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Ss', 'Ss', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Ss', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 8,
    objective: 'defeat_all',
    startingUnits: [
      // Player units templates (carried over)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 4, y: 3, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 4, y: 4 },
      { unitTypeId: 'Elvish Shaman', side: 1, x: 5, y: 2 },
      // Enemy units (Undead)
      { unitTypeId: 'Skeleton', side: 2, x: 1, y: 2 },
      { unitTypeId: 'Skeleton Archer', side: 2, x: 2, y: 1 },
      { unitTypeId: 'Walking Corpse', side: 2, x: 0, y: 3 },
    ],
    hints: [
      'Swamp (Ss) is bad terrain for Elves (only 30% defense). Do not stand in the water; force the undead to fight you while they are in the swamp and you are on land.',
      "Skeletons are resistant to Blade and Pierce, but take full damage from Impact. The Shaman's melee/ranged attacks deal Impact damage!",
      "Use the Archer's ranged attacks to chip the Skeleton without taking counter-attacks.",
    ],
  },
  {
    id: 'stage_rebels_3',
    seriesId: 'rebels_campaign',
    name: 'Rebels 3: Siege of the Keep',
    description:
      "Rebels Campaign - Stage 3: The enemy leader has barricaded himself inside a stone keep. Use all the skills you've learned, and leverage your leveled-up units to take the keep!",
    mapName: 'Stone Keep',
    width: 8,
    height: 8,
    grid: [
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Hh', 'Hh', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Ch', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Kh', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Ch', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Hh', 'Hh', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg^Vh', 'Gg', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg^Vh', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 10,
    objective: 'defeat_all',
    startingUnits: [
      // Player units templates (carried over)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 3, y: 6, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 2, y: 6 },
      { unitTypeId: 'Elvish Shaman', side: 1, x: 4, y: 6 },
      // Enemy units (Northerners)
      { unitTypeId: 'Orcish Warrior', side: 2, x: 3, y: 3, isLeader: true },
      { unitTypeId: 'Orcish Grunt', side: 2, x: 2, y: 4 },
      { unitTypeId: 'Orcish Archer', side: 2, x: 4, y: 4 },
    ],
    hints: [
      'The Orcish Warrior is a Level 2 unit and deals massive melee damage. Never attack him directly in melee unless he is slowed by the Shaman.',
      'Castle (Ch) and Keep (Kh) tiles provide 60% defense to the Orcs inside. Lure the guards out onto the hills/grassland to attack them.',
      'If your Elvish Fighter advanced to Elvish Captain, he has the Leadership ability: adjacent level 1 units deal +25% damage!',
    ],
  },
  {
    id: 'stage_rebels_4',
    seriesId: 'rebels_campaign',
    name: 'Rebels 4: Mountain Chokepoint',
    description:
      'Rebels Campaign - Stage 4: Orcish reinforcements are marching through a narrow mountain pass. Hold the chokepoint and defeat the vanguard before they overrun the outpost!',
    mapName: 'Mountain Pass',
    width: 8,
    height: 8,
    grid: [
      ['Mm', 'Mm', 'Mm', 'Mm', 'Mm', 'Mm', 'Mm', 'Mm'],
      ['Mm', 'Mm', 'Mm', 'Hh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Mm', 'Mm', 'Hh', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Mm', 'Hh', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Hh', 'Gg', 'Gg', 'Ch', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Ch', 'Ch', 'Ch', 'Gg^Fp', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Ch', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 10,
    objective: 'defeat_all',
    startingUnits: [
      // Player units templates (carried over)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 2, y: 6, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 1, y: 6 },
      { unitTypeId: 'Elvish Shaman', side: 1, x: 3, y: 6 },
      // Enemy units (Northerners Vanguard)
      { unitTypeId: 'Orcish Slayer', side: 2, x: 3, y: 2 },
      { unitTypeId: 'Orcish Crossbowman', side: 2, x: 2, y: 1 },
      { unitTypeId: 'Troll Rocklobber', side: 2, x: 4, y: 1 },
    ],
    hints: [
      'The Orcish Slayer has the Skirmisher ability, allowing him to ignore your Zone of Control. Protect your vulnerable healers and archers!',
      'Troll Rocklobber deals massive ranged impact damage. Keep your units on high defense terrain like Hills (60% defense) or Forest (60% defense).',
      'Position your leader (especially if advanced to Elvish Captain) adjacent to your units to apply the Leadership bonus (+25% damage)!',
    ],
  },
  {
    id: 'stage_rebels_5',
    seriesId: 'rebels_campaign',
    name: 'Rebels 5: Confronting the Warlord',
    description:
      'Rebels Campaign - Stage 5: You have tracked the main force to their keep. Defeat the Orcish Warlord and his elite bodyguard to end the invasion once and for all!',
    mapName: 'Warlords Keep',
    width: 8,
    height: 8,
    grid: [
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Hh', 'Hh', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Ch', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Kh', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Hh', 'Ch', 'Ch', 'Ch', 'Hh', 'Gg', 'Gg'],
      ['Gg', 'Gg^Fp', 'Hh', 'Hh', 'Gg^Fp', 'Gg', 'Gg', 'Gg'],
      ['Gg^Vh', 'Gg', 'Gg', 'Gg^Vh', 'Gg', 'Gg', 'Gg^Vh', 'Gg'],
      ['Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg', 'Gg'],
    ],
    turnLimit: 12,
    objective: 'defeat_all',
    startingUnits: [
      // Player units templates (carried over)
      { unitTypeId: 'Elvish Fighter', side: 1, x: 3, y: 6, isLeader: true },
      { unitTypeId: 'Elvish Archer', side: 1, x: 2, y: 6 },
      { unitTypeId: 'Elvish Shaman', side: 1, x: 4, y: 6 },
      // Enemy units (Northerners Boss & Bodyguards)
      { unitTypeId: 'Orcish Warlord', side: 2, x: 3, y: 3, isLeader: true },
      { unitTypeId: 'Troll Warrior', side: 2, x: 2, y: 4 },
      { unitTypeId: 'Orcish Crossbowman', side: 2, x: 4, y: 4 },
    ],
    hints: [
      "The Orcish Warlord is a Level 3 unit with devastating melee strikes. Slow him using the Shaman's Entangle before attempting to attack him.",
      'Troll Warriors regenerate +8 HP at the start of their turn. Coordinate your attacks to defeat them in a single turn to deny their regeneration.',
      "Exploit terrain: occupy the Castle tiles (60% defense) to block the Troll's advance and maintain high-defense positioning.",
    ],
  },
];
