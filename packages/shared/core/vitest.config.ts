import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared-core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
