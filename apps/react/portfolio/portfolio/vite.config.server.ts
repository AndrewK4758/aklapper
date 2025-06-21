import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cwd } from 'process';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';
import MODULES from './vite_modules.js';

//Server
const HOST = 'localhost';
const PORT_DEV = 8080;

//Build
const BASE = '/server';
const NODE_ENV = process.env.NODE_ENV;
const OUT_DIR = './dist/server';
const ROOT = cwd();

const config: UserConfig = defineConfig({
  root: ROOT,
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/react/portfolio/portfolio'),

  server: {
    port: PORT_DEV,
    host: HOST,
  },

  plugins: [react()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: MODULES,
    conditions: ['mui-modern', 'module', 'browser', 'development|production'],
    noExternal: [
      // '@mui/material',
      // '@mui/icons-material',
      // '@emotion/styled',
      // '@emotion/react',
      // '@mui/x-date-pickers',
      // '@mui/x-data-grid',
      // '@mui/styled-engine-sc',
    ],
  },

  css: {
    devSourcemap: true,
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
    target: 'node24',
    ssr: true,
    ssrEmitAssets: true,
    ssrManifest: true,
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },

    rollupOptions: {
      input: {
        server: './server.ts',
      },
      output: {
        entryFileNames: '[name].js',
        esModule: true,
        format: 'esm',
        generatedCode: {
          arrowFunctions: true,
          constBindings: true,
          symbols: true,
          objectShorthand: true,
          reservedNamesAsProps: true,
        },
        strict: true,
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
});

export default config;
