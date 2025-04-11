import baseConfig from '../../../eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: ['generated/**/*'],
  },
  {
    files: ['**/*.json'],

    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
