import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { UserConfig } from 'vite';
import { defineConfig } from 'vite';

const modules: { [key: string]: string } = {
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder/src/index.ts'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src/index.ts'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),

  '@aklapper/utils': resolve(workspaceRoot, 'packages/utils/src/index.ts'),

  '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),
};

const config: UserConfig = defineConfig({
  root: './',
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/react/portfolio/portfolio'),

  plugins: [react()],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: modules,
  },

  ssr: {
    noExternal: ['@mui/material', '@mui/icons-material', '@mui/x-date-pickers', '@mui/x-data-grid'],
  },

  mode: process.env['NODE_ENV'],

  base: '/server',
  build: {
    ssr: true,
    ssrEmitAssets: false,
    ssrManifest: true,
    outDir: './dist/server',
    minify: true,
    emptyOutDir: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      input: {
        server: './server.ts',
      },
      perf: true,
      output: {
        entryFileNames: 'server.js',
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
    },
    target: 'node24',
  },

  logLevel: 'info',
  appType: 'custom',
  publicDir: false,
  envDir: './env',
});

export default config;
