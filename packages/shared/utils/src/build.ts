import { join } from 'node:path';

import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import type { Config as ReactRouterConfig } from '@react-router/dev/config';
import { reactRouter } from '@react-router/dev/vite';
import dts from 'vite-plugin-dts';
import { defineConfig, type ViteUserConfig } from 'vitest/config';

export const SOURCE_CLIENT_CONDITIONS: string[] = [
  '@aklapper/source',
  'module',
  'browser',
  'development|production',
];

export const SOURCE_SERVER_CONDITIONS: string[] = [
  '@aklapper/source',
  'module',
  'node',
  'development|production',
];

export const LIGHTNINGCSS_MODULES = Object.freeze({ customIdents: true, container: false });

export const external = (id: string): boolean =>
  !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(id) && !id.startsWith('\0');

export function createReactRouterAppConfig(): ReactRouterConfig {
  return {
    appDirectory: './src/app',
    basename: '/',
    buildDirectory: 'dist',
    future: {
      unstable_enableNodeReadableStream: true,
      unstable_optimizeDeps: true,
    },
    serverBuildFile: 'index.js',
    ssr: true,
    splitRouteModules: 'enforce',
    routeDiscovery: { mode: 'lazy', manifestPath: '/__manifest' },
    serverModuleFormat: 'esm',
  };
}

export interface SsrAppViteConfigOptions {
  name: string;
  root: string;
  cacheDir: string;
  defaultPort: number;
}

export function createSsrViteConfig(options: SsrAppViteConfigOptions): ViteUserConfig {
  const { name, root, cacheDir, defaultPort } = options;

  return defineConfig({
    root,
    envDir: join(root, '../../..'),
    cacheDir,
    base: '/',
    publicDir: 'public',

    server: {
      port: Number(process.env['PORT']) || defaultPort,
      strictPort: true,
      host: true,
    },

    css: {
      devSourcemap: true,
      modules: {
        scopeBehaviour: 'local',
        localsConvention: 'camelCaseOnly',
      },
      transformer: 'lightningcss',
      lightningcss: {
        cssModules: LIGHTNINGCSS_MODULES,
      },
    },

    dev: {
      sourcemap: true,
      preTransformRequests: true,
    },

    oxc: {
      jsx: {
        runtime: 'automatic',
      },
      typescript: {
        allowNamespaces: true,
        optimizeEnums: true,
      },
    },

    ssr: {
      target: 'node',
      resolve: {
        conditions: SOURCE_SERVER_CONDITIONS,
      },
      optimizeDeps: {
        noDiscovery: true,
      },
    },

    resolve: {
      conditions: SOURCE_CLIENT_CONDITIONS,
      dedupe: ['react', 'react-dom', '@base-ui/react'],
    },

    optimizeDeps: {
      include: ['react', 'react-dom', '@base-ui/react', 'zod'],
    },

    plugins: [...(process.env['VITEST'] ? [] : [reactRouter()]), nxReadySignal()],

    test: {
      name,
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      pool: 'forks',
      sequence: { shuffle: true },
      reporters: ['verbose'],
      coverage: {
        reportsDirectory: './test-output/vitest/coverage',
        provider: 'v8',
        exclude: ['**/*.css'],
      },
    },
  });
}

export interface UiLibViteConfigOptions {
  name: string;
  testName?: string;
  root: string;
  cacheDir: string;
  tsconfigPath: string;
  entry?: Record<string, string>;
}

export function createUiLibViteConfig(options: UiLibViteConfigOptions): ViteUserConfig {
  const {
    name,
    testName = name,
    root,
    cacheDir,
    tsconfigPath,
    entry = { index: 'src/index.ts' },
  } = options;

  return defineConfig({
    root,
    cacheDir,
    resolve: {
      conditions: SOURCE_CLIENT_CONDITIONS,
    },
    ssr: {
      resolve: {
        conditions: SOURCE_SERVER_CONDITIONS,
      },
    },
    plugins: process.env['VITEST']
      ? []
      : [
          dts({
            entryRoot: 'src',
            tsconfigPath,
          }),
        ],
    css: {
      devSourcemap: true,
      modules: {
        scopeBehaviour: 'local',
        localsConvention: 'camelCaseOnly',
      },
      transformer: 'lightningcss',
      lightningcss: {
        cssModules: LIGHTNINGCSS_MODULES,
      },
    },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      cssMinify: 'lightningcss',
      target: 'esnext',
      lib: {
        entry,
        name,
        cssFileName: 'index',
        formats: ['es'],
      },
      rolldownOptions: {
        external,
      },
    },
    test: {
      name: testName,
      watch: false,
      globals: true,
      environment: 'jsdom',
      include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    },
  });
}
