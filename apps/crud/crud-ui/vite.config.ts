/// <reference types='vitest' />
import react from '@vitejs/plugin-react';
import { cwd } from 'process';
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: cwd(),
  cacheDir: '../../../node_modules/.vite/apps/crud/crud-ui',
  server: {
    port: 4200,
    host: 'localhost'
  },
  preview: {
    port: 4300,
    host: 'localhost'
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared': resolve('../../../', 'libs/react-shared/src/index.ts'),
      '@aklapper/utils': resolve('../../../', 'libs/utils/src/index.ts'),
      '@aklapper/types': resolve('../../../', 'libs/types/src/index.ts'),

      '.prisma/client/index-browser': '@prisma/client/index-browser.js'
    }
  },

  build: {
    outDir: './dist',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    rollupOptions: {
      perf: true,
      output: {
        esModule: true,
        format: 'esm',
        generatedCode: {
          arrowFunctions: true,
          constBindings: true,
          symbols: true
        }
      }
    },
    target: 'esnext'
  },
  esbuild: {
    jsx: 'automatic',
    format: 'esm',
    color: true,
    platform: 'browser'
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
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    }
  }
});
