import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/types': resolve(workspaceRoot, 'libs/types/src/index.ts')
};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'prompt-builder',
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
