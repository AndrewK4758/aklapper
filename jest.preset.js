import { nxPreset } from '@nx/jest/preset.js';

/**@type {import('jest').Config} */
export default {
  ...nxPreset,
  collectCoverage: true,
  maxWorkers: 1,
  passWithNoTests: true,
  preset: 'ts-jest/presets/js-with-ts',
  runInBand: true,
  testEnvironmentOptions: {},
  verbose: true
};
