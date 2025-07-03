import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'password',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
    passWithNoTests: true,
  },
});

export default config;
