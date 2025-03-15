import { Config } from 'jest';

const config: Config = {
  displayName: 'games-api-e2e',
  preset: '../../../../jest.preset.ts',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  testEnvironment: 'node',
  coverageDirectory: '../../../../coverage/apps/apis/games-api-e2e'
};

export default config;
