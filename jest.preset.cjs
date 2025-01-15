const nxPreset = require('@nx/jest/preset').nxPreset;

/**@type {import('jest').Config} */
module.exports = {
  ...nxPreset,
  verbose: true,
  collectCoverage: true,
  passWithNoTests: true,
  maxWorkers: 1,
  maxConcurrency: 1,
  preset: 'ts-jest/presets/js-with-ts'
};
