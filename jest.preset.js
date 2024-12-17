const nxPreset = require('@nx/jest/preset').default;

/**@type {import('jest').Config} */
module.exports = { ...nxPreset, verbose: true, collectCoverage: true, passWithNoTests: true, maxWorkers: 1 };
