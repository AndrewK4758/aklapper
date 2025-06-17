import { workspaceRoot } from '@nx/devkit';
import { nxPreset } from '@nx/jest/preset.js';
import type { Config } from 'jest';
import { resolve } from 'path';
import type { TsJestTransformerOptions } from 'ts-jest';

const tsJestOptions: TsJestTransformerOptions = {
  useESM: true,
  tsconfig: '<rootDir>/tsconfig.json',
  babelConfig: {
    sourceType: 'module',
    sourceMaps: true,
    targets: { esmodules: true, node: 'current' },
  },
  diagnostics: {
    pretty: true,
    warnOnly: true,
  },
};

const MODULES = {
  '@aklapper/chain': [resolve(workspaceRoot, 'packages/chain/src/$1')],
  '@aklapper/games': [resolve(workspaceRoot, 'packages/games/src/$1')],
  '@aklapper/game': [resolve(workspaceRoot, 'packages/game/src/$1')],
  '@aklapper/models': [resolve(workspaceRoot, 'packages/models/src/$1')],
  '@aklapper/games-chains': [resolve(workspaceRoot, 'packages/games-chains/src/$1')],
  '@aklapper/games-components': [resolve(workspaceRoot, 'packages/games-components/src/$1')],
  '@aklapper/media-recorder': [resolve(workspaceRoot, 'packages/media-recorder/src/$1')],
  '@aklapper/mocks': [resolve(workspaceRoot, 'packages/mocks/src/$1')],
  '@aklapper/password': [resolve(workspaceRoot, 'packages/password/src/$1')],
  '@aklapper/chinook-client': [resolve(workspaceRoot, 'packages/prisma/chinook/src/$1')],
  '@aklapper/games-client': [resolve(workspaceRoot, 'packages/prisma/games/src/$1')],
  '@aklapper/prompt-builder': [resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src/$1')],
  '@aklapper/react-shared': [resolve(workspaceRoot, 'packages/react-shared/src/$1')],
  '@aklapper/socket-io-client': [resolve(workspaceRoot, 'packages/socket-io/client/src/$1')],
  '@aklapper/socket-io-server': [resolve(workspaceRoot, 'packages/socket-io/server/src/$1')],
  '@aklapper/types': [resolve(workspaceRoot, 'packages/types/dist/$1')],
  '@aklapper/utils': [resolve(workspaceRoot, 'packages/utils/src/$1')],
  '@aklapper/vertex-ai': [resolve(workspaceRoot, 'packages/gen-ai/vertex-ai/src/$1')],
};

const config: Config = {
  ...nxPreset,
  forceExit: true,
  coverageProvider: 'v8',
  collectCoverage: true,
  coverageReporters: ['text', 'html'],
  moduleNameMapper: MODULES,
  moduleFileExtensions: ['js', 'json', 'ts', 'mts', 'html'],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  passWithNoTests: true,
  verbose: true,
  silent: false,
  transform: {
    '^.+\\.(ts|js|mts|cts|mjs|cjs)$': ['ts-jest', tsJestOptions],
  },
  testEnvironment: 'node',
  testEnvironmentOptions: {},
};

console.log(config);
export default config;
