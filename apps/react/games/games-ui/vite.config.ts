/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cwd } from 'process';
import { resolve } from 'path';
import { workspaceRoot } from '@nx/devkit';

export default defineConfig({
  root: cwd(),
  cacheDir: resolve(workspaceRoot, 'node_modules/.vite/apps/games/games-ui'),
  server: {
    port: 4700,
    host: 'localhost'
  },
  preview: {
    port: 4800,
    host: 'localhost'
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
      '@aklapper/utils': resolve(workspaceRoot, 'packages/utils/src/index.ts'),
      '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts')
    }
  },

  build: {
    outDir: './dist',
    minify: false,
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    }
  }
});
