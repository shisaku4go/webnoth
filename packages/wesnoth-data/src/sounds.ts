export interface SoundMapping {
  ui: Record<string, string>;
  attacks: Record<string, string>;
  hits: Record<string, string[]>;
  die: Record<string, string>;
  miss: string;
}

export const sounds: SoundMapping = {
  ui: {
    select: 'sounds/ui/select-unit.wav',
    click: 'sounds/ui/button.wav',
  },
  attacks: {
    sword: 'sounds/combat/sword-1.ogg',
    bow: 'sounds/combat/bow.ogg',
    spear: 'sounds/combat/spear.ogg',
    axe: 'sounds/combat/axe.ogg',
    thunderstick: 'sounds/combat/thunderstick.ogg',
    'throwing knife': 'sounds/combat/throwing-knife.ogg',
    staff: 'sounds/combat/staff.ogg',
    'magic missile': 'sounds/combat/magic-missile-1.ogg',
    mace: 'sounds/combat/mace.ogg',
    club: 'sounds/combat/mace.ogg', // fallback
    'zombie attack': 'sounds/combat/zombie-attack.wav',
    'magic dark': 'sounds/combat/magic-dark.ogg',
    shadow: 'sounds/combat/magic-dark.ogg', // fallback
  },
  hits: {
    elf: ['sounds/combat/elf-hit-1.ogg', 'sounds/combat/elf-hit-2.ogg'],
    human: ['sounds/combat/human-hit-1.ogg', 'sounds/combat/human-hit-2.ogg'],
    orc: ['sounds/combat/orc-hit-1.ogg', 'sounds/combat/orc-hit-2.ogg'],
    goblin: [
      'sounds/combat/orc-small-hit-1.ogg',
      'sounds/combat/orc-small-hit-2.ogg',
    ],
    dwarf: ['sounds/combat/dwarf-hit-1.ogg', 'sounds/combat/dwarf-hit-2.ogg'],
    skeleton: [
      'sounds/combat/skeleton-hit-1.ogg',
      'sounds/combat/skeleton-hit-2.ogg',
    ],
    zombie: ['sounds/combat/zombie-hit-1.ogg'],
  },
  die: {
    elf: 'sounds/combat/human-die-1.ogg', // elves fallback to human die in sounds
    human: 'sounds/combat/human-die-1.ogg',
    orc: 'sounds/combat/orc-die-1.ogg',
    goblin: 'sounds/combat/orc-small-die-1.ogg',
    dwarf: 'sounds/combat/dwarf-die-1.ogg',
    skeleton: 'sounds/combat/skeleton-die-1.ogg',
    zombie: 'sounds/combat/zombie-hit-1.ogg', // zombies hit/die is same
  },
  miss: 'sounds/combat/miss-1.ogg',
};
