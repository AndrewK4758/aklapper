import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/types': resolve(workspaceRoot, 'libs/types/src/index.ts')
};

const config = defineConfig({
  root: cwd(),
  resolve: {
    alias: modules
  },
  test: {
    name: 'vertex-ai',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: './tests/support/test-setup.ts',
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8'
    },
    passWithNoTests: true,
    env: {
      GCP_PROJECT: 'games-424800',
      GCP_LOCATION: 'us-central1'
    }
  }
});

export default config;
