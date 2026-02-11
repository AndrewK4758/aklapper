import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';
import MODULES from './vite_modules.js';

//Server
const HOST = 'localhost';
const PORT_DEV = 4700;
const PORT_PREVIEW = 4800;

//Build
const BASE = '/';
const NODE_ENV = process.env.NODE_ENV;
const OUT_DIR = './dist';
const ROOT = cwd();
console.log(ROOT);
const config = defineConfig({
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

  css: {
    devSourcemap: true,
  },

  dev: {
    sourcemap: true,
  },

  plugins: [react()],

  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: [ nxViteTsPaths() ],
  // },

  optimizeDeps: {
    noDiscovery: NODE_ENV === 'development',
  },

  resolve: {
    alias: MODULES,
    conditions: ['module', 'browser', 'development', 'production'],
  },

  base: BASE,

  mode: NODE_ENV,

  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  experimental: {
    enableNativePlugin: true,
  },

  build: {
    outDir: OUT_DIR,
    cssMinify: 'lightningcss',
    minify: 'oxc',
    manifest: true,
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    rolldownOptions: {
      checks: { circularDependency: true },
      logLevel: 'info',
      experimental: {
        attachDebugInfo: 'full',
      },
    },
  },

  test: {
    name: 'portfolio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    css: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
    setupFiles: ['tests/__mocks__/react_router.tsx', 'tests/__mocks__/__mocks__.tsx'],
  },
});

export default config;
