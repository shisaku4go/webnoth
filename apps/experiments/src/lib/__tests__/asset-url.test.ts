import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wesnothAssetUrl } from '../asset-url';

describe('wesnothAssetUrl', () => {
  const originalBaseUrl = import.meta.env.BASE_URL;

  afterEach(() => {
    // Restore the original BASE_URL after each test
    import.meta.env.BASE_URL = originalBaseUrl;
  });

  it('should return empty string if assetPath is not provided', () => {
    expect(wesnothAssetUrl()).toBe('');
    expect(wesnothAssetUrl('')).toBe('');
  });

  it('should prepend clean base URL without trailing slash', () => {
    import.meta.env.BASE_URL = '/base';
    expect(wesnothAssetUrl('images/unit.png')).toBe(
      '/base/wesnoth-assets/images/unit.png',
    );
  });

  it('should not add extra slash if base URL has trailing slash', () => {
    import.meta.env.BASE_URL = '/base/';
    expect(wesnothAssetUrl('images/unit.png')).toBe(
      '/base/wesnoth-assets/images/unit.png',
    );
  });

  it('should handle root base URL correctly', () => {
    import.meta.env.BASE_URL = '/';
    expect(wesnothAssetUrl('images/unit.png')).toBe(
      '/wesnoth-assets/images/unit.png',
    );
  });
});
