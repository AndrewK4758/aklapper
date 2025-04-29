import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  root: cwd(),
  test: {
    name: 'crud-api',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    globalSetup: './tests/support/global-setup.ts',
    teardownTimeout: 1000,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
  envDir: './env/.env',
});

export default config;
