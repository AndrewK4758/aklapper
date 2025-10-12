import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vite';
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

  plugins: [react()],

  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: [ nxViteTsPaths() ],
  // },

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
    minify: true,
    target: 'esnext',
    manifest: true,
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },

    rolldownOptions: {
      checks: { circularDependency: true },
      logLevel: 'info',
      transform: {
        target: 'esnext',
      },
    },
  },
});

export default config;
