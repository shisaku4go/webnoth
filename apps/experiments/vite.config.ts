import fs from 'node:fs';
import { resolve } from 'node:path';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Resolve @webnoth/wesnoth-data assets via import.meta.resolve.
// This follows the workspace symlink automatically.
const wesnothDataEntry = import.meta.resolve('@webnoth/wesnoth-data');
const wesnothDataRoot = resolve(
  new URL(wesnothDataEntry).pathname,
  '../..',
);
const wesnothAssetsDir = resolve(wesnothDataRoot, 'assets');

/**
 * Vite plugin to serve @webnoth/wesnoth-data assets at /wesnoth-assets/.
 * In dev, serves files directly from the package.
 * In build, copies referenced assets into the output.
 */
function wesnothAssetsPlugin(): Plugin {
  return {
    name: 'vite-plugin-wesnoth-assets',
    configureServer(server) {
      server.middlewares.use('/wesnoth-assets', (req, res, next) => {
        if (!req.url) return next();
        // Delegate to Vite's static file serving
        const filePath = resolve(wesnothAssetsDir, `.${req.url}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        // Use send to serve static files
        import('node:fs').then((fs) => {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = filePath.split('.').pop() ?? '';
            const mimeTypes: Record<string, string> = {
              png: 'image/png',
              webp: 'image/webp',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              svg: 'image/svg+xml',
            };
            res.setHeader(
              'Content-Type',
              mimeTypes[ext] ?? 'application/octet-stream',
            );
            fs.createReadStream(filePath).pipe(res);
          } else {
            res.statusCode = 404;
            res.end('Not found');
          }
        });
      });
    },
    writeBundle() {
      const outDir = resolve(__dirname, 'dist', 'wesnoth-assets');
      if (fs.existsSync(wesnothAssetsDir)) {
        fs.cpSync(wesnothAssetsDir, outDir, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/webnoth/' : '/',
  plugins: [
    // TanStack Router — file-based routing code generation
    TanStackRouterVite(),
    // React (JSX transform)
    react(),
    // Tailwind CSS v4
    tailwindcss(),
    // React Compiler — automatic useMemo/useCallback optimization
    babel({
      presets: [reactCompilerPreset()],
    }),
    // Serve @webnoth/wesnoth-data assets at /wesnoth-assets/
    wesnothAssetsPlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
