import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

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
      debug: true,
      buildLibsFromSource: false,
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'main']
    }),
    nxCopyAssetsPlugin(['**/*.md'])
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
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
