import { nxPreset } from '@nx/jest/preset.js';
import type { DefaultEsmTransformOptions } from 'ts-jest';
import type { Config } from 'jest';

const opts: DefaultEsmTransformOptions = {
  tsconfig: '<rootDir>/tsconfig.base.json',
  isolatedModules: true,
  babelConfig: {
    targets: { esmodules: true, node: 'current' }
  },
  diagnostics: {
    warnOnly: true
  }
};

const config: Config = {
  ...nxPreset,
  collectCoverage: true,
  transform: { '^.+\\.(ts|js|html)$': ['ts-jest', opts] },
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  passWithNoTests: true,
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironmentOptions: {},
  verbose: true
};

export default config;
