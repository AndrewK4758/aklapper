import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getNodeEnv } from '../../../libs/types/types-game/src/index.ts';

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
      debug: getNodeEnv() !== 'production',
      buildLibsFromSource: getNodeEnv() !== 'production',
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'module', 'main']
    }),
    nxCopyAssetsPlugin(['./*.md'])
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/games-components':
        getNodeEnv() === 'production' ? 'dist/libs/games-components/index.js' : 'libs/games-components/src/index.ts',
      '@aklapper/media-recorder':
        getNodeEnv() === 'production' ? 'dist/libs/media-recorder/index.js' : 'libs/media-recorder/src/index.ts',
      '@aklapper/prompt-builder':
        getNodeEnv() === 'production'
          ? 'dist/libs/gen-ai/prompt-builder/index.js'
          : 'libs/gen-ai/prompt-builder/src/index.ts',
      '@aklapper/react-shared':
        getNodeEnv() === 'production' ? 'dist/libs/react-shared/index.js' : 'libs/react-shared/src/index.ts',
      '@aklapper/socket-io-client':
        getNodeEnv() === 'production' ? 'dist/libs/socket-io/client/index.js' : 'libs/socket-io/client/src/index.ts',
      '@aklapper/types-ai':
        getNodeEnv() === 'production' ? 'dist/libs/types/types-ai/index.js' : 'libs/types/types-ai/src/index.ts',
      '@aklapper/types-game':
        getNodeEnv() === 'production' ? 'dist/libs/types/types-game/index.js' : 'libs/types/types-game/src/index.ts',
      '@aklapper/utils': getNodeEnv() === 'production' ? 'dist/libs/utils/index.js' : 'libs/utils/src/index.ts'
    }
  },

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
