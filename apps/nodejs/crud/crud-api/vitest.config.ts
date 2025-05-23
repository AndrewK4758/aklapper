import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  root: cwd(),
  test: {
    name: 'crud-api',
    watch: false,
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      DB_URL_TEST: 'postgresql://postgres:postgres@localhost:5432/chinook',
    },
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globalSetup: './tests/support/global-setup.ts',
    teardownTimeout: 1000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});

export default config;
