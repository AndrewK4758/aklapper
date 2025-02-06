import type { Config } from 'jest';
import { resolve } from 'node:path';
import { workspaceRoot } from '@nx/devkit';

const modules = {
  '@aklapper/chain': [resolve(workspaceRoot, './libs/chain/src/$1')],
  '@aklapper/games': [resolve(workspaceRoot, './libs/games/src/$1')],
  '@aklapper/game': [resolve(workspaceRoot, './libs/game/src/$1')],
  '@aklapper/models': [resolve(workspaceRoot, './libs/models/src/$1')],
  '@aklapper/games-chains': [resolve(workspaceRoot, './libs/games-chains/src/$1')],
  '@aklapper/games-components': [resolve(workspaceRoot, './libs/games-components/src/$1')],
  '@aklapper/media-recorder': [resolve(workspaceRoot, './libs/media-recorder/src/$1')],
  '@aklapper/mocks': [resolve(workspaceRoot, './libs/mocks/src/$1')],
  '@aklapper/password': [resolve(workspaceRoot, './libs/password/src/$1')],
  '@aklapper/prisma': [resolve(workspaceRoot, './libs/prisma/src/$1')],
  '@aklapper/prompt-builder': [resolve(workspaceRoot, './libs/gen-ai/prompt-builder/src/$1')],
  '@aklapper/react-shared': [resolve(workspaceRoot, './libs/react-shared/src/$1')],
  '@aklapper/socket-io-client': [resolve(workspaceRoot, './libs/socket-io/client/src/$1')],
  '@aklapper/socket-io-server': [resolve(workspaceRoot, './libs/socket-io/server/src/$1')],
  '@aklapper/types': [resolve(workspaceRoot, './libs/types/src/$1')],
  '@aklapper/utils': [resolve(workspaceRoot, './libs/utils/src/$1')],
  '@aklapper/vertex-ai': [resolve(workspaceRoot, './libs/gen-ai/vertex-ai/src/$1')]
};

const config: Config = {
  displayName: 'prisma',
  preset: '../../jest.preset.ts',
  testEnvironment: 'node',
  moduleNameMapper: modules,
  coverageDirectory: 'test-output/jest/coverage'
};
export default config;
