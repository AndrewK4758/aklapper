import { Config } from 'jest';
import { DefaultEsmTransformOptions } from 'ts-jest';

const tsJestOptions: DefaultEsmTransformOptions = {
  tsconfig: '<rootDir>/tsconfig.spec.json',
  isolatedModules: true,
  babelConfig: {
    targets: { esmodules: true, node: 'current' }
  },
  diagnostics: {
    warnOnly: true
  }
};

const config: Config = {
  displayName: 'games-api',
  preset: '../../../jest.preset.ts',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/support/global-setup.ts',
  globalTeardown: '<rootDir>/tests/support/global-teardown.ts',
  setupFiles: ['<rootDir>/tests/support/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', tsJestOptions]
  },
  coverageDirectory: '../../../coverage/apis/games/games-api'
};

export default config;
