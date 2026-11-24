import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'node-api-analytics-e2e',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    globalSetup: [
      resolve(import.meta.dirname, '../../../../packages/tooling/src/vitest-pg-setup.ts'),
    ],
  },
});
