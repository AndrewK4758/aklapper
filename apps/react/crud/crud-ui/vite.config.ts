import { workspaceRoot } from '@nx/devkit';
import react from '@vitejs/plugin-react-oxc';
import { resolve } from 'path';
import { cwd } from 'process';
import { defineConfig } from 'vite';

export default defineConfig({
  root: cwd(),
  cacheDir: `${workspaceRoot}/node_modules/.vite/apps/crud/crud-ui`,
  server: {
    port: 4200,
    host: 'localhost',
  },
  preview: {
    port: 4300,
    host: 'localhost',
    strictPort: true,
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },

  resolve: {
    alias: {
      '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),
      '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),
    },
  },

  build: {
    outDir: './dist',
    emptyOutDir: true,
    manifest: true,
    sourcemap: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        esModule: true,
        format: 'esm',
      },
    },
    target: 'esnext',
  },

  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',

  test: {
    name: 'crud-ui',
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
