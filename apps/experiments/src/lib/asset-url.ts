/**
 * Resolve a wesnoth-data asset path to a URL.
 * In dev, served by the custom Vite plugin at /wesnoth-assets/.
 * In production, this path prefix is preserved and respects BASE_URL.
 */
export function wesnothAssetUrl(assetPath?: string): string {
  if (!assetPath) return '';
  const base = import.meta.env.BASE_URL;
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  return `${cleanBase}wesnoth-assets/${assetPath}`;
}
