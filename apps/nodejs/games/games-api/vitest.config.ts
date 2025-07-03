import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, './packages/chain/src'),
  '@aklapper/game': resolve(workspaceRoot, './packages/game/src'),
  '@aklapper/games': resolve(workspaceRoot, './packages/games/src'),
  '@aklapper/games-chains': resolve(workspaceRoot, './packages/games-chains/src'),
  '@aklapper/games-client': resolve(workspaceRoot, './packages/prisma/games/src'),
  '@aklapper/games-components': resolve(workspaceRoot, './packages/games-components/src'),
  '@aklapper/mocks': resolve(workspaceRoot, './packages/mocks/src'),
  '@aklapper/models': resolve(workspaceRoot, './packages/models/src'),
  '@aklapper/socket-io-server': resolve(workspaceRoot, './packages/socket-io/server/src'),
  '@aklapper/types': resolve(workspaceRoot, './packages/types/src'),
  '@aklapper/utils': resolve(workspaceRoot, './packages/utils/src'),
};

const config = defineConfig({
  test: {
    root: cwd(),
    name: 'games-api',
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
