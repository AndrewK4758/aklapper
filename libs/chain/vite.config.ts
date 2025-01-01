/// <reference types='vitest' />
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import * as path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/libs/chain',
  plugins: [
    nxViteTsPaths({ debug: true }),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      logLevel: 'info',
      entryRoot: 'src',
      outDir: '../../dist/libs/chain/src',
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
    outDir: '../../dist/libs/chain',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: 'chain',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es']
    },
    target: 'node23',
    rollupOptions: {
      // External packages that should not be bundled into your library.
      external: [],
      output: {
        esModule: true,
        format: 'esm',
        sourcemap: true
      }
    }
  },
  esbuild: {
    format: 'esm',
    color: true,
    platform: 'node'
  },
  logLevel: 'info'
});
