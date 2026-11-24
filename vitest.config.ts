import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'root-config',
    projects: [
      'apps/*/*',
      'apis/node/*/*',
      'packages/shared/*',
      'packages/node/*',
      'packages/legacy/*',
    ],
  },
});
