import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off'
    }
    // languageOptions: {
    //   parser: await import('jsonc-eslint-parser')
    // }
  }
];
