import baseConfig from '../../../eslint.config.js';

export default [
  ...baseConfig,
  {
    ignores: ['generated/**/*'],
  },

  {
    files: ['**/*.json'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
