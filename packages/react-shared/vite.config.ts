import { workspaceRoot } from '@nx/devkit';
import { pigment } from '@pigment-css/vite-plugin';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import Theme from './src/lib/styles/theme';

export default defineConfig({
  root: cwd(),
  cacheDir: path.resolve(workspaceRoot, 'node_modules/.vite/packages/react-shared'),
  plugins: [
    pigment({
      theme: Theme,
      transformLibraries: ['@mui/material'],
      evaluate: true,
      transformSx: true,
      debug: {
        print: true,
      },
      babelOptions: {
        compact: false,
      },
    }),
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(cwd(), 'tsconfig.lib.json'),
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  build: {
    minify: true,
    outDir: './dist',
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'react-shared',
      fileName: 'index',
      formats: ['es'],
    },
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      perf: true,
      output: {
        esModule: true,
        format: 'esm',
      },
    },
    target: 'esnext',
  },
  esbuild: {
    jsx: 'automatic',
    format: 'esm',
    color: true,
    platform: 'browser',
  },

  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});
