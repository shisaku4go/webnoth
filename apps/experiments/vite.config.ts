import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import babel from '@rolldown/plugin-babel';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // TanStack Router — ファイルベースルーティングの自動コード生成
    TanStackRouterVite(),
    // React (JSX 変換)
    react(),
    // Tailwind CSS v4
    tailwindcss(),
    // React Compiler — useMemo/useCallback の自動最適化
    babel({
      presets: [reactCompilerPreset()],
    }),
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