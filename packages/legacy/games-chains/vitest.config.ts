import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { workspaceRoot } from '@nx/devkit';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, 'packages/legacy/chain/src'),
  '@aklapper/games': resolve(workspaceRoot, 'packages/legacy/games/src'),
  '@aklapper/models': resolve(workspaceRoot, 'packages/legacy/models/src'),
  '@aklapper/mocks': resolve(workspaceRoot, 'packages/legacy/mocks/src'),
  '@aklapper/utils': resolve(workspaceRoot, 'packages/legacy/utils/src'),
  '@aklapper/types': resolve(workspaceRoot, 'packages/legacy/types/src'),
  '@aklapper/game': resolve(workspaceRoot, 'packages/legacy/game/src'),
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/legacy/games-components/src'),
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
