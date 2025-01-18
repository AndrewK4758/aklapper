import type { Config } from 'jest';
import { DefaultEsmTransformOptions } from 'ts-jest';

const opts: DefaultEsmTransformOptions = {
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
  displayName: 'crud-api',
  preset: '../../../jest.preset.ts',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/support/global-setup.ts',
  globalTeardown: '<rootDir>/tests/support/global-teardown.ts',
  setupFiles: ['<rootDir>/tests/support/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', opts]
  },
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx', '.mts'],
  moduleFileExtensions: ['ts', 'js', 'html', 'mts'],
  coverageDirectory: '../../../coverage/apis/crud/crud-api'
};
export default config;
