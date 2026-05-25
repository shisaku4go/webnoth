import { describe, expect, it } from 'vitest';
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

  describe('edge cases', () => {
    it('should return empty string when no arguments are passed', () => {
      expect(cn()).toBe('');
    });

    it('should handle deeply nested arrays', () => {
      expect(cn(['a', ['b', ['c']]])).toBe('a b c');
    });

    it('should handle empty arrays and nested empty arrays', () => {
      expect(cn([], [[[]]])).toBe('');
    });

    it('should handle empty objects', () => {
      expect(cn({})).toBe('');
    });

    it('should ignore strings composed purely of whitespace', () => {
      expect(cn('   ', '\n\t')).toBe('');
    });

    it('should correctly merge Tailwind arbitrary values', () => {
      expect(cn('text-[14px]', 'text-[16px]')).toBe('text-[16px]');
    });

    it('should handle purely falsy combinations', () => {
      expect(cn(undefined, null, false, '', 0)).toBe('');
    });
  });
});
