import { describe, expect, it } from 'vitest';
import { generateTacticalContext } from '../ai-tactician';
import type { TacticalUnitState } from '../pathfinder';
import type { PuzzleStage } from '../stages';

describe('ai-tactician', () => {
  it('should generate tactical context prompt correctly', () => {
    const mockStage: PuzzleStage = {
      id: 'test_stage',
      seriesId: 'tutorial',
      name: 'Test Stage Name',
      description: 'Test Stage Description',
      mapName: 'Test Map Arena',
      width: 3,
      height: 3,
      grid: [
        ['Gg', 'Gg', 'Gg^Fp'],
        ['Gg', 'Gg^Vh', 'Gg'],
        ['Gg', 'Gg', 'Gg'],
      ],
      turnLimit: 5,
      objective: 'defeat_all',
      startingUnits: [],
      hints: [],
    };

    const mockUnits: TacticalUnitState[] = [
      {
        id: 'test_unit_1',
        unitTypeId: 'Elvish Fighter',
        side: 1,
        x: 0,
        y: 0,
        hp: 30,
        maxHp: 32,
        alignment: 'lawful',
        traits: ['strong', 'resilient'],
        statuses: {
          poisoned: false,
          slowed: false,
          petrified: false,
        },
        activeWeaponIndex: 0,
        xp: 10,
        maxXp: 32,
        name: 'Galdrad',
        gender: 'male',
        level: 1,
        moves: 5,
        maxMoves: 5,
        isLeader: true,
        hasAttacked: false,
      },
      {
        id: 'test_unit_2',
        unitTypeId: 'Orcish Grunt',
        side: 2,
        x: 1,
        y: 1,
        hp: 15,
        maxHp: 38,
        alignment: 'chaotic',
        traits: ['strong'],
        statuses: {
          poisoned: false,
          slowed: true,
          petrified: false,
        },
        activeWeaponIndex: 0,
        xp: 0,
        maxXp: 38,
        name: 'Ugg',
        gender: 'male',
        level: 1,
        moves: 0,
        maxMoves: 5,
        isLeader: false,
        hasAttacked: true,
      },
    ];

    const mockLogs = [
      { id: '1', text: 'Galdrad moved to (1,1).' },
      { id: '2', text: 'Galdrad attacked Ugg, dealing 10 damage.' },
    ];

    const promptText = generateTacticalContext(
      mockStage,
      mockUnits,
      2,
      mockLogs,
    );

    // Verify key info exists in the output prompt
    expect(promptText).toContain(
      'WESNOTH TACTICAL PUZZLE - AI TACTICIAN PROMPT CONTEXT',
    );
    expect(promptText).toContain('Test Stage Name');
    expect(promptText).toContain('Test Stage Description');
    expect(promptText).toContain('Turn: 2 / 5');
    expect(promptText).toContain('Remaining Turns: 4');
    expect(promptText).toContain('Galdrad');
    expect(promptText).toContain('Elvish Fighter');
    expect(promptText).toContain('Ugg');
    expect(promptText).toContain('Orcish Grunt');
    expect(promptText).toContain('Slowed');
    expect(promptText).toContain('Galdrad attacked Ugg');
  });
});
