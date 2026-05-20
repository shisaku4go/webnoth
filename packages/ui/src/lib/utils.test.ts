import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility function', () => {
  it('should merge basic class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle arrays of class names', () => {
    expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
  });

  it('should handle conditional objects', () => {
    expect(cn({ class1: true, class2: false, class3: true })).toBe(
      'class1 class3',
    );
  });

  it('should ignore falsy values', () => {
    expect(cn('class1', null, undefined, false, 0, '', 'class2')).toBe(
      'class1 class2',
    );
  });

  it('should correctly merge Tailwind classes overriding each other', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
  });

  it('should handle complex combinations', () => {
    expect(
      cn(
        'base-class',
        ['array-class1', 'array-class2'],
        { 'cond-class1': true, 'cond-class2': false },
        null,
        'p-4 p-8', // Tailwind merge scenario inside string
      ),
    ).toBe('base-class array-class1 array-class2 cond-class1 p-8');
  });
});
