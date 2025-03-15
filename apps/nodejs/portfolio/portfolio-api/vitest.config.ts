import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'portfolio-api',
    alias: modules,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    }
  }
});

export default config;
