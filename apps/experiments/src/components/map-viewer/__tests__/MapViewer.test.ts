import { describe, expect, test, vi } from 'vitest';

// Mock pixi and other UI components to avoid rendering/import issues during pure logic tests
vi.mock('@pixi/react', () => ({
  extend: vi.fn(),
  Application: vi.fn(),
}));
vi.mock('pixi.js', () => ({
  Sprite: vi.fn(),
  Container: vi.fn(),
  Graphics: vi.fn(),
  Text: vi.fn(),
  Polygon: vi.fn(),
  Assets: { load: vi.fn() },
}));

import { getHexPosition } from '../MapViewer';

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
