import { DefaultEsmTransformOptions } from 'ts-jest';
import type { Config } from 'jest';
const opts: DefaultEsmTransformOptions = {
  tsconfig: '<rootDir>/tsconfig.spec.json',
  babelConfig: {
    targets: { esmodules: true, node: 'current' }
  },
  diagnostics: {
    warnOnly: true
  }
};

const config: Config = {
  displayName: 'crud-api',
  preset: '../../../jest.preset.js',
  testEnvironment: 'node',
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
