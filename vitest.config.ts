import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'apps/*/vite.config.ts',

      'apps/*/vitest.config.ts',

      'packages/*/vite.config.ts',

      'packages/*/vitest.config.ts',
    ],
  },
});
