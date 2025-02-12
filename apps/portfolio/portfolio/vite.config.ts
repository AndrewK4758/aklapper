/// <reference types='vitest' />
import { defineConfig, UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { workspaceRoot } from '@nx/devkit';

const modules = {
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder/src/index.ts'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src/index.ts'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),

  '@aklapper/socket-io-client': resolve(workspaceRoot, 'packages/socket-io/client/src/index.ts'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),

  '@aklapper/utils': resolve(workspaceRoot, 'packages/utils/src/index.ts'),

  '.prisma/client/index-browser': '@prisma/client/index-browser.js'
};

const config: UserConfig = defineConfig({
  root: resolve(workspaceRoot, 'apps/portfolio/portfolio'),
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/portfolio/portfolio'),
  server: {
    port: 4700,
    host: 'localhost'
  },
  preview: {
    port: 4800,
    host: 'localhost'
  },
  plugins: [
    react({
      babel: { targets: { esmodules: true } }
    })
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: modules
  },

  build: {
    outDir: './dist',
    minify: process.env['NODE_ENV'] !== 'production',
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
        strict: true,
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
    platform: 'browser',
    sourcemap: true,
    target: 'esnext'
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

export default config;
