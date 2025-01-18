import baseConfig from '../../eslint.config.js';

export default [
  ...baseConfig,
  {
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },
  {
    ignores: ['**/prisma/generated/**']
  }
];
