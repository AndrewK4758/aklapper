import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { getNodeEnv } from '../types/types-game/src/index.ts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/media-recorder',
  plugins: [
    nxViteTsPaths({
      debug: getNodeEnv() !== 'production',
      buildLibsFromSource: getNodeEnv() !== 'production',
      mainFields: [['exports', '.', 'types', 'import', 'default'], 'types', 'module', 'main']
    }),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      outDir: '../../dist/libs/media-recorder/src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json')
    })
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vitejs.dev/guide/build.html#library-mode

  build: {
    outDir: '../../dist/libs/media-recorder',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'media-recorder',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es']
    },
    target: 'esnext',
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [],
      output: {
        esModule: true,
        format: 'esm'
      }
    }
  },
  esbuild: {
    format: 'esm',
    color: true,
    platform: 'browser'
  },
  logLevel: 'info'
});
