import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';
import { cwd } from 'node:process';
import { defineConfig } from 'vitest/config';

const modules = {
  '@aklapper/chain': resolve(workspaceRoot, './libs/chain/src/index.ts'),
  '@aklapper/game': resolve(workspaceRoot, './libs/game/src/index.ts'),
  '@aklapper/games': resolve(workspaceRoot, './libs/games/src/index.ts'),
  '@aklapper/games-chains': resolve(workspaceRoot, './libs/games-chains/src/index.ts'),
  '@aklapper/games-components': resolve(workspaceRoot, './libs/games-components/src/index.ts'),
  '@aklapper/mocks': resolve(workspaceRoot, './libs/mocks/src/index.ts'),
  '@aklapper/models': resolve(workspaceRoot, './libs/models/src/index.ts'),
  '@aklapper/socket-io-server': resolve(workspaceRoot, './libs/socket-io/server/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, './libs/types/src/index.ts'),
  '@aklapper/utils': resolve(workspaceRoot, './libs/utils/src/index.ts')
};

const config = defineConfig({
  root: cwd(),

  test: {
    name: 'games-api',
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
