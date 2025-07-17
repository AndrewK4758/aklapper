import { workspaceRoot } from '@nx/devkit';
import { pigment } from '@pigment-css/vite-plugin';
import react from '@vitejs/plugin-react-oxc';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig, type UserConfig } from 'rolldown-vite';
import Theme from './src/styles/themes/theme';
import MODULES from './vite_modules';

//Server
const HOST = 'localhost';
const PORT_DEV = 4700;
const PORT_PREVIEW = 4800;

//Build
const BASE = '/';
const NODE_ENV = process.env.NODE_ENV;
const OUT_DIR = './dist';
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

  css: {
    devSourcemap: true,
  },

  plugins: [
    pigment({
      theme: Theme,
      transformLibraries: ['@mui/material'],
      transformSx: true,
      packageMap: {
        '@pigment-css/react': '@mui/material-pigment-css',
      },
      debug: {
        print: true,
      },
      babelOptions: {
        compact: false,
      },
    }),
    react(),
  ],

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
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  dev: {
    sourcemap: true,
  },

  experimental: {
    enableNativePlugin: true,
    hmrPartialAccept: true,
  },

  oxc: {
    target: 'esnext',
    typescript: {
      rewriteImportExtensions: 'rewrite',
    },
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

    rollupOptions: {
      logLevel: 'debug',
      optimization: {
        inlineConst: true,
      },
      platform: 'browser',
      output: {
        esModule: true,
        format: 'esm',
      },
    },
  },

  test: {
    name: 'portfolio',
    watch: false,
    globals: true,
    environment: 'jsdom',
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
