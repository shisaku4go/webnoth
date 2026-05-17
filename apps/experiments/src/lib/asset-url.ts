/**
 * Resolve a wesnoth-data asset path to a URL.
 * In dev, served by the custom Vite plugin at /wesnoth-assets/.
 * In production, this path prefix is preserved.
 */
export function wesnothAssetUrl(assetPath?: string): string {
  if (!assetPath) return '';
  return `/wesnoth-assets/${assetPath}`;
}
