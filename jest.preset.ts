import { type DefaultEsmTransformOptions } from 'ts-jest';
import { nxPreset } from '@nx/jest/preset.js';
import type { Config } from 'jest';
import { resolve } from 'path';
import { workspaceRoot } from '@nx/devkit';

const tsJestOptions: DefaultEsmTransformOptions = {
  tsconfig: '<rootDir>/tsconfig.spec.json',
  isolatedModules: true,
  babelConfig: {
    sourceType: 'module',
    targets: { esmodules: true, node: 'current' }
  },
  diagnostics: {
    pretty: true,
    warnOnly: true
  }
};

const modules = {
  '@aklapper/chain': [resolve(workspaceRoot, './packages/chain/src/$1')],
  '@aklapper/games': [resolve(workspaceRoot, './packages/games/src/$1')],
  '@aklapper/game': [resolve(workspaceRoot, './packages/game/src/$1')],
  '@aklapper/models': [resolve(workspaceRoot, './packages/models/src/$1')],
  '@aklapper/games-chains': [resolve(workspaceRoot, './packages/games-chains/src/$1')],
  '@aklapper/games-components': [resolve(workspaceRoot, './packages/games-components/src/$1')],
  '@aklapper/media-recorder': [resolve(workspaceRoot, './packages/media-recorder/src/$1')],
  '@aklapper/mocks': [resolve(workspaceRoot, './packages/mocks/src/$1')],
  '@aklapper/password': [resolve(workspaceRoot, './packages/password/src/$1')],
  '@aklapper/prisma': [resolve(workspaceRoot, './packages/prisma/src/$1')],
  '@aklapper/prompt-builder': [resolve(workspaceRoot, './packages/gen-ai/prompt-builder/src/$1')],
  '@aklapper/react-shared': [resolve(workspaceRoot, './packages/react-shared/src/$1')],
  '@aklapper/socket-io-client': [resolve(workspaceRoot, './packages/socket-io/client/src/$1')],
  '@aklapper/socket-io-server': [resolve(workspaceRoot, './packages/socket-io/server/src/$1')],
  '@aklapper/types': [resolve(workspaceRoot, './packages/types/src/$1')],
  '@aklapper/utils': [resolve(workspaceRoot, './packages/utils/src/$1')],
  '@aklapper/vertex-ai': [resolve(workspaceRoot, './packages/gen-ai/vertex-ai/src/$1')]
};

const config: Config = {
  ...nxPreset,
  collectCoverage: true,
  coverageReporters: ['text', 'html'],
  transform: {
    '^.+\\.(ts|js|html)$': ['ts-jest', tsJestOptions]
  },
  moduleNameMapper: modules,
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  passWithNoTests: true,
  verbose: true
};

export default config;
