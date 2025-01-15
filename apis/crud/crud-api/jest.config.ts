import { DefaultEsmTransformOptions } from 'ts-jest';
import type { Config } from 'jest';

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
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/tests/support/global-setup.ts',
  globalTeardown: '<rootDir>/tests/support/global-teardown.ts',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', opts]
  },
  extensionsToTreatAsEsm: ['.jsx', '.ts', '.tsx', '.mts'],
  moduleFileExtensions: ['ts', 'js', 'html', 'mts'],
  coverageDirectory: '../../../coverage/apis/crud/crud-api',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
export default config;
