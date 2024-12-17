/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cwd } from 'process';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/apps/games-ui/games-ui',
  server: {
    port: 4200,
    host: 'localhost'
  },
  preview: {
    port: 4300,
    host: 'localhost'
  },
  plugins: [react()],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  build: {
    outDir: `${cwd()}/dist/apps/games`,
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
      }
    },
    target: 'esnext'
  },
  esbuild: {
    jsx: 'automatic',
    format: 'esm',
    color: true,
    platform: 'browser'
  },
  logLevel: 'info',
  appType: 'spa',
  publicDir: 'public',
  envDir: './env',
  test: {
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../../coverage/apps/games-ui/games-ui',
      provider: 'v8'
    }
  }
});
