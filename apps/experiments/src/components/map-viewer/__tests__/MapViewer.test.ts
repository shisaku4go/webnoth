import { describe, expect, it, test, vi } from 'vitest';

// Mock @pixi/react to avoid node/React environment import issues
vi.mock('@pixi/react', () => ({
  Application: vi.fn(),
  extend: vi.fn(),
}));

// Mock pixi.js as it also might cause issues if not fully supported in the test environment
vi.mock('pixi.js', () => ({
  Assets: { load: vi.fn() },
  Container: vi.fn(),
  Graphics: vi.fn(),
  Polygon: vi.fn(),
  Sprite: vi.fn(),
  Text: vi.fn(),
}));

import { parseCell, getHexPosition } from '../MapViewer';

describe('MapViewer parseCell', () => {
  it('parses a plain base code', () => {
    const result = parseCell('Gs');
    expect(result).toEqual({
      baseCode: 'Gs',
      startPos: undefined,
      overlayCode: undefined,
    });
  });

  it('parses a base code with an overlay', () => {
    const result = parseCell('Gs^Fms');
    expect(result).toEqual({
      baseCode: 'Gs',
      overlayCode: 'Fms',
      startPos: undefined,
    });
  });

  it('parses a starting position and a base code', () => {
    const result = parseCell('2 Khr');
    expect(result).toEqual({
      baseCode: 'Khr',
      startPos: '2',
      overlayCode: undefined,
    });
  });

  it('parses a starting position, base code, and overlay code', () => {
    const result = parseCell('3 Gs^Fms');
    expect(result).toEqual({
      baseCode: 'Gs',
      overlayCode: 'Fms',
      startPos: '3',
    });
  });

  it('handles irregular whitespaces', () => {
    const result = parseCell('  2   Khr  ');
    expect(result).toEqual({
      baseCode: 'Khr',
      startPos: '2',
      overlayCode: undefined,
    });
  });

  it('handles empty string', () => {
    const result = parseCell('');
    expect(result).toEqual({
      baseCode: '',
      startPos: undefined,
      overlayCode: undefined,
    });
  });
});

describe('getHexPosition', () => {
  test.each([
    // Even columns (no y-stagger)
    { col: 0, row: 0, expectedX: 0, expectedY: 0 },
    { col: 0, row: 1, expectedX: 0, expectedY: 72 },
    { col: 2, row: 0, expectedX: 108, expectedY: 0 },
    { col: 2, row: 2, expectedX: 108, expectedY: 144 },

    // Odd columns (y-stagger by 36)
    { col: 1, row: 0, expectedX: 54, expectedY: 36 },
    { col: 1, row: 1, expectedX: 54, expectedY: 108 },
    { col: 3, row: 0, expectedX: 162, expectedY: 36 },
    { col: 3, row: 2, expectedX: 162, expectedY: 180 },
  ])('calculates correct position for col: $col, row: $row', ({ col, row, expectedX, expectedY }) => {
    const position = getHexPosition(col, row);
    expect(position).toEqual({ x: expectedX, y: expectedY });
  });
});
