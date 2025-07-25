import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
  '@aklapper/utils': resolve(workspaceRoot, 'packages/utils/src/index.ts'),
};

export default defineConfig({
  test: {
    name: 'crud-api',
    root: cwd(),
    alias: modules,
    watch: false,
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DB_URL_TEST: 'postgresql://postgres:postgres@localhost:5432/chinook',
    },
    globalSetup: './tests/support/global-setup.ts',
    teardownTimeout: 1000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});
