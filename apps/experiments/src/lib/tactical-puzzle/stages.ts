export interface PuzzleUnitPlacement {
  unitTypeId: string;
  side: number;
  x: number;
  y: number;
  isLeader?: boolean;
}

export interface PuzzleStage {
  id: string;
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
];
