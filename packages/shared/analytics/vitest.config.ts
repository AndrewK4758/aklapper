import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared-analytics',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
  },
});
