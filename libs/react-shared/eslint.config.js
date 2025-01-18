import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.js';

const { configs } = nx;

export default [
  ...baseConfig,
  ...configs['flat/react'],
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    // Override or add rules here
    rules: {}
  }
];
