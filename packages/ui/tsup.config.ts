import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/components/**/*.tsx',
    'src/lib/**/*.ts',
    'src/hooks/**/*.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'react',
    'react-dom',
    'lucide-react',
    'radix-ui',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
});
