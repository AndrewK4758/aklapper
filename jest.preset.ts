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
  transform: { '^.+\\.(ts|js|html)$': ['ts-jest', opts] },
  collectCoverage: true,
  passWithNoTests: true,
  extensionsToTreatAsEsm: ['.ts', '.mts'],
  moduleFileExtensions: ['ts', 'js', 'html'],
  testEnvironmentOptions: {},
  verbose: true
};

export default config;
