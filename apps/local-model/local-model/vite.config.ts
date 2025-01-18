import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getNodeEnv } from '../../../libs/types/types-game/src/index';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/local-model/local-model',
  server: {
    port: 5800,
    host: 'localhost'
  },
  preview: {
    port: 5900,
    host: 'localhost'
  },
  plugins: [
    react({ babel: { targets: { esmodules: true } } }),
    nxViteTsPaths({
      debug: getNodeEnv() !== 'production',
      buildLibsFromSource: getNodeEnv() !== 'production',
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'module', 'main']
    }),
    nxCopyAssetsPlugin(['**/*.md'])
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared':
        getNodeEnv() === 'production' ? 'dist/libs/react-shared/index.js' : 'libs/react-shared/src/index.ts',
      '@aklapper/utils': getNodeEnv() === 'production' ? 'dist/libs/utils/index.js' : 'libs/utils/src/index.ts',
      '@aklapper/types-game':
        getNodeEnv() === 'production' ? 'dist/libs/types/types-game/index.js' : 'libs/types/types-game/src/index.ts'
    }
  },

  build: {
    outDir: '../../../dist/apps/local-model',
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
      reportsDirectory: '../../../coverage/apps/local-model/local-model',
      provider: 'v8'
    }
  }
});
