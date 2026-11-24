import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'node-api-analytics',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
