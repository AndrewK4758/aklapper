import { resolve } from 'node:path';
import { cwd } from 'node:process';

import { workspaceRoot } from '@nx/devkit';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, 'packages/legacy/chain/src/index.ts'),
  '@aklapper/game': resolve(workspaceRoot, 'packages/legacy/game/src/index.ts'),
  '@aklapper/games': resolve(workspaceRoot, 'packages/legacy/games/src/index.ts'),
  '@aklapper/games-components': resolve(
    workspaceRoot,
    'packages/legacy/games-components/src/index.ts',
  ),
  '@aklapper/mocks': resolve(workspaceRoot, 'packages/legacy/mocks/src/index.ts'),
  '@aklapper/models': resolve(workspaceRoot, 'packages/legacy/models/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, 'packages/legacy/types/src/index.ts'),
};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'utils',
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
