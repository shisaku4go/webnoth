import { describe, expect, it, vi } from 'vitest';

// Mock @pixi/react to avoid node/React environment import issues
vi.mock('@pixi/react', () => ({
  Application: () => null,
  extend: () => null,
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

import { parseCell } from '../MapViewer';

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
