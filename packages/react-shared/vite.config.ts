import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: cwd(),
  cacheDir: path.resolve(workspaceRoot, 'node_modules/.vite/packages/react-shared'),
  plugins: [
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

  dev: {
    sourcemap: true,
  },

  build: {
    outDir: './dist',
    minify: true,
    target: 'esnext',
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
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/*'],
      logLevel: 'debug',
      output: {
        esModule: true,
        format: 'esm',
      },
    },
  },

  test: {
    name: 'react-shared',
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
