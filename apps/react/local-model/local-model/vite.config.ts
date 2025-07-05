/// <reference types='vitest' />
import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cwd } from 'process';
import { defineConfig } from 'vite';

export default defineConfig({
  root: cwd(),
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/react/local-model/local-model'),
  server: {
    port: 5800,
    host: 'localhost',
  },
  preview: {
    port: 5900,
    host: 'localhost',
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),
      '@aklapper/socket-io-client': resolve(workspaceRoot, 'packages/socket-io/client/src/index.ts'),
    },
  },

  build: {
    outDir: './dist',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      perf: true,
      output: {
        esModule: true,
        format: 'esm',
        generatedCode: {
          arrowFunctions: true,
          constBindings: true,
          symbols: true,
        },
      },
    },
    target: 'esnext',
  },

  esbuild: {
    jsx: 'automatic',
    format: 'esm',
    color: true,
    platform: 'browser',
    sourcemap: true,
    target: 'esnext',
  },

  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    passWithNoTests: true,
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});
