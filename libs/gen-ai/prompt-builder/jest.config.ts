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
  displayName: 'prompt-builder',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1' // Important for correct imports
  },
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', tsJestOptions]
  },
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/gen-ai/prompt-builder'
};

export default config;
