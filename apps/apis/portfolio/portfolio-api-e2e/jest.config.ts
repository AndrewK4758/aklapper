import { Config } from 'jest';

const config: Config = {
  displayName: 'portfolio-api-e2e',
  preset: '../../../../jest.preset.ts',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  setupFiles: ['<rootDir>/src/support/test-setup.ts'],
  testEnvironment: 'node',

  coverageDirectory: '../../../../coverage/apis/portfolio/portfolio-api-e2e'
};

export default config;
