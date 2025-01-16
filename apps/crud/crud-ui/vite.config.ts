import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getNodeEnv } from '../../../libs/types/types-game/src/index.ts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/crud/crud-ui',
  server: {
    port: 4200,
    host: 'localhost'
  },
  preview: {
    port: 4300,
    host: 'localhost'
  },
  plugins: [
    react({ babel: { targets: { esmodules: true } } }),
    nxViteTsPaths({
      debug: getNodeEnv() !== 'production',
      buildLibsFromSource: getNodeEnv() !== 'production',
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'module', 'main']
    }),
    nxCopyAssetsPlugin(['*.md'])
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared':
        getNodeEnv() === 'production' ? 'dist/libs/react-shared/index.js' : 'libs/react-shared/src/index.ts'
    }
  },

  build: {
    outDir: `../../../dist/apps/crud`,
    emptyOutDir: true,
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
      reportsDirectory: '../../../coverage/apps/crud/crud-ui',
      provider: 'v8'
    }
  }
});
