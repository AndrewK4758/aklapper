import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, './packages/chain/src/index.ts'),
  '@aklapper/game': resolve(workspaceRoot, './packages/game/src/index.ts'),
  '@aklapper/games': resolve(workspaceRoot, './packages/games/src/index.ts'),
  '@aklapper/games-chains': resolve(workspaceRoot, './packages/games-chains/src/index.ts'),
  '@aklapper/games-client': resolve(workspaceRoot, './packages/prisma/games/src/index.ts'),
  '@aklapper/games-components': resolve(workspaceRoot, './packages/games-components/src/index.ts'),
  '@aklapper/mocks': resolve(workspaceRoot, './packages/mocks/src/index.ts'),
  '@aklapper/models': resolve(workspaceRoot, './packages/models/src/index.ts'),
  '@aklapper/socket-io-server': resolve(workspaceRoot, './packages/socket-io/server/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, './packages/types/src/index.ts'),
  '@aklapper/utils': resolve(workspaceRoot, './packages/utils/src/index.ts'),
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
