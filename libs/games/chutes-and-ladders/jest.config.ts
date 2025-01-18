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
  displayName: 'chutes-and-ladders',
  preset: '../../../jest.preset.ts',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', tsJestOptions]
  },
  coverageDirectory: '../../../coverage/libs/games/chutes-and-ladders'
};

export default config;
