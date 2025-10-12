import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'portfolio',
    watch: false,
    globals: true,
    environment: 'jsdom',
    css: true,
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
    setupFiles: ['tests/__mocks__/react_router.tsx', 'tests/__mocks__/__mocks__.tsx'],
  },
});
