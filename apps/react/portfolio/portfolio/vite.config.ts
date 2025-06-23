import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig, type UserConfig } from 'vite';
import MODULES from './vite_modules.js';

process.env.NODE_ENV = 'development';

//Server
const HOST = 'localhost';
const PORT_DEV = 4700;
const PORT_PREVIEW = 4800;

//Build
const BASE = '/client';
const NODE_ENV = process.env.NODE_ENV;
const OUT_DIR = './dist/client';
const ROOT = cwd();

const config: UserConfig = defineConfig({
  root: ROOT,
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/react/portfolio/portfolio'),
  server: {
    port: PORT_DEV,
    host: HOST,
  },
  preview: {
    port: PORT_PREVIEW,
    host: HOST,
  },
  plugins: [
    react({
      reactRefreshHost: `http://${HOST}:${PORT_DEV}`,
    }),
  ],

  css: {
    devSourcemap: true,
  },

  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: MODULES,
    conditions: ['mui-modern', 'module', 'browser', 'development|production'],
  },

  base: BASE,

  mode: NODE_ENV,

  logLevel: 'info',
  appType: 'custom',
  publicDir: 'public',
  envDir: './env',

  build: {
    outDir: OUT_DIR,
    minify: NODE_ENV === 'production',
    target: 'esnext',
    manifest: true,
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },

    rollupOptions: {
      logLevel: 'info',
      experimentalLogSideEffects: true,
      input: {
        browser: '/src/main.tsx',
      },
      output: {
        assetFileNames: '[name]-[hash].[ext]',
        strict: true,
        esModule: true,
        format: 'esm',
        generatedCode: {
          arrowFunctions: true,
          constBindings: true,
          symbols: true,
          objectShorthand: true,
          reservedNamesAsProps: true,
        },
      },
      strictDeprecations: true,
      perf: true,
    },
  },

  esbuild: {
    color: true,
    format: 'esm',
    jsx: 'automatic',
    platform: 'browser',
    sourcemap: true,
    target: 'esnext',
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

export default config;
