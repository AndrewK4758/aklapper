import { existsSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';

import { nxReadySignal } from '@nx/vite/plugins/nx-ready-signal.plugin';
import type { Config as ReactRouterConfig } from '@react-router/dev/config';
import { reactRouter } from '@react-router/dev/vite';
import { build as viteBuild } from 'vite';
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

export interface ReactRouterAppConfigOptions {
  prerender?: ReactRouterConfig['prerender'];
}

export function createReactRouterAppConfig(
  options: ReactRouterAppConfigOptions = {},
): ReactRouterConfig {
  return {
    appDirectory: './src/app',
    basename: '/',
    buildDirectory: 'dist',
    future: {
      unstable_enableNodeReadableStream: true,
      unstable_optimizeDeps: true,
    },
    prerender: options.prerender ?? true,
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

function createInjectCssImportPlugin(cssFileName: string) {
  const cssAsset = `${cssFileName}.css`;
  return {
    name: 'aklapper-inject-page-css-import',
    enforce: 'post' as const,
    generateBundle(
      _options: unknown,
      bundle: Record<string, { type: string; isEntry?: boolean; code?: string }>,
    ) {
      if (!(cssAsset in bundle)) {
        return;
      }
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && output.isEntry && typeof output.code === 'string') {
          output.code = `import './${cssAsset}';\n${output.code}`;
        }
      }
    },
  };
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

export interface AppPageArtifactsBuildOptions {
  root: string;
  pagesDir?: string;
  outDir?: string;
  tsconfigPath?: string;
  cacheDir?: string;
}

/**
 * Builds every route page under `<root>/src/pages/<slug>/` into an isolated app-level built
 * artifact at `<root>/build/pages/<slug>/` (`index.js` + `index.css` + `index.d.ts`). Injects
 * `./index.css` into the built ESM entry so thin React Router route modules render the built
 * artifact directly via `#pages/<slug>`.
 */
export async function buildAppPageArtifacts(
  options: AppPageArtifactsBuildOptions,
): Promise<readonly string[]> {
  const {
    root,
    pagesDir = join(root, 'src', 'pages'),
    outDir = join(root, 'build', 'pages'),
    tsconfigPath = join(root, 'tsconfig.pages.json'),
    cacheDir = join(root, '../../../node_modules/.vite/apps', basename(root), 'pages'),
  } = options;

  if (!existsSync(pagesDir)) {
    throw new Error(`Pages directory not found: ${pagesDir}`);
  }

  const pageSlugs = readdirSync(pagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  rmSync(outDir, { recursive: true, force: true });

  const builtSlugs: string[] = [];
  const appName = basename(root);

  for (const slug of pageSlugs) {
    const pageDir = join(pagesDir, slug);
    const tsEntry = join(pageDir, 'index.ts');
    const tsxEntry = join(pageDir, 'index.tsx');
    const entryFile = existsSync(tsEntry) ? tsEntry : existsSync(tsxEntry) ? tsxEntry : null;
    if (!entryFile) {
      continue;
    }

    const pageOutDir = join(outDir, slug);

    await viteBuild({
      configFile: false,
      root,
      publicDir: false,
      cacheDir: join(cacheDir, slug),
      resolve: {
        conditions: SOURCE_CLIENT_CONDITIONS,
      },
      ssr: {
        resolve: {
          conditions: SOURCE_SERVER_CONDITIONS,
        },
      },
      oxc: {
        jsx: {
          runtime: 'automatic',
        },
      },
      plugins: [
        dts({
          entryRoot: pageDir,
          outDirs: pageOutDir,
          tsconfigPath,
          include: [pageDir],
          exclude: ['**/*.spec.*', '**/*.test.*'],
        }),
        createInjectCssImportPlugin('index'),
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
        outDir: pageOutDir,
        emptyOutDir: true,
        reportCompressedSize: true,
        cssMinify: 'lightningcss',
        target: 'esnext',
        lib: {
          entry: { index: entryFile },
          name: `${appName}-page-${slug}`,
          cssFileName: 'index',
          formats: ['es'],
        },
        rolldownOptions: {
          external,
        },
      },
    });

    builtSlugs.push(slug);
  }

  return builtSlugs;
}
