import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, 'packages/chain/src'),
  '@aklapper/games': resolve(workspaceRoot, 'packages/games/src'),
  '@aklapper/models': resolve(workspaceRoot, 'packages/models/src'),
  '@aklapper/mocks': resolve(workspaceRoot, 'packages/mocks/src'),
  '@aklapper/utils': resolve(workspaceRoot, 'packages/utils/src'),
  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src'),
  '@aklapper/game': resolve(workspaceRoot, 'packages/game/src'),
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src'),
};

const config = defineConfig({
  test: {
    root: cwd(),
    name: 'games-chains',
    alias: modules,
    watch: false,
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8',
    },
  },
});

export default config;
