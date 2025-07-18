import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cwd } from 'process';
import { defineConfig } from 'vite';

export default defineConfig({
  root: cwd(),
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/games/games-ui'),
  server: {
    port: 4700,
    host: 'localhost',
  },
  preview: {
    port: 4800,
    host: 'localhost',
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),
      '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),
      '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
    },
  },

  build: {
    outDir: './dist',
    minify: process.env.NODE_ENV === 'production',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },

  envDir: 'env',
  test: {
    name: 'games-ui',
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
