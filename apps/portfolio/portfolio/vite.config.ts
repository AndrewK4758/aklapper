import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/portfolio/portfolio',
  server: {
    port: 4700,
    host: 'localhost',
    watch: {
      ignored: ['**/node_modules/**']
    }
  },
  preview: {
    port: 4800,
    host: 'localhost'
  },
  plugins: [
    react({ babel: { targets: { esmodules: true } } }),
    nxViteTsPaths({
      debug: true,
      buildLibsFromSource: true,
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'main']
    }),
    nxCopyAssetsPlugin(['./*.md'])
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  build: {
    outDir: `../../../dist/apps/portfolio`,
    minify: true,
    manifest: true,
    sourcemap: true,
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
      },
      plugins: [
        nodeResolve({
          browser: true,
          preferBuiltins: false,
          exportConditions: ['browser', 'development', 'module', 'import'],
          extensions: ['.js', '.ts', '.json', '.mjs', '.mts']
        })
      ]
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
      reportsDirectory: '../../../coverage/apps/portfolio/portfolio',
      provider: 'v8'
    }
  }
});
