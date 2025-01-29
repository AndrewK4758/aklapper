import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/prisma': resolve(workspaceRoot, 'libs/prisma/src/index.ts')
};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'crud-api',
    alias: modules,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globalSetup: './tests/support/global-setup.ts',
    teardownTimeout: 1000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    }
  }
});

export default config;
