import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'node-e2e-kit',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
