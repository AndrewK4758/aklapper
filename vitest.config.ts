import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/*', { extends: true }, 'packages/*', { extends: true }],
  },
});
