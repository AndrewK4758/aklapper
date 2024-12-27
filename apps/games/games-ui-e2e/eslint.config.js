import * as eslintPlaywright from 'eslint-plugin-playwright';
import baseConfig from '../../../eslint.config.js';

const { configs } = eslintPlaywright.default;

export default [
  configs['flat/recommended'],

  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {}
  }
];
