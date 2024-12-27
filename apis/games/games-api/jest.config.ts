import { Config } from 'jest';

const config: Config = {
  displayName: 'games-api',
  preset: '../../../jest.preset.js',
  // globalSetup: '<rootDir>/tests/support/global-setup.ts',
  // globalTeardown: '<rootDir>/tests/support/global-teardown.ts',
  // setupFiles: ['<rootDir>/tests/support/test-setup.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/apis/games/games-api'
};

export default config;
