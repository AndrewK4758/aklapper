import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
  root: cwd(),
  cacheDir: path.resolve(workspaceRoot, 'node_modules/.vite/packages/react-shared'),
  plugins: [
    react(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(cwd(), 'tsconfig.lib.json'),
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  dev: {
    sourcemap: true,
  },

  resolve: {
    alias: {
      '@styles': resolve(workspaceRoot, 'packages/react-shared/src/lib/styles'),
    },
  },

  experimental: {
    enableNativePlugin: true,
  },

  build: {
    outDir: './dist',
    minify: 'oxc',
    sourcemap: true,
    emptyOutDir: true,
    reportCompressedSize: true,
    lib: {
      cssFileName: '[name].css',
      entry: 'src/index.ts',
      name: 'react-shared',
      fileName: 'index',
      formats: ['es'],
    },
    rolldownOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/*', '@base-ui', '@base-ui/react'],
      logLevel: 'debug',
      output: {
        esModule: true,
        format: 'esm',
      },
    },
  },

  test: {
    name: 'react-shared',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});
