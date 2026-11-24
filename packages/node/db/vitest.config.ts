import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'node-db',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
    globalSetup: [resolve(import.meta.dirname, '../../tooling/src/vitest-pg-setup.ts')],
  },
});
