export const url = (NODE_ENV: string) => {
  switch (NODE_ENV) {
    case 'production':
      return process.env['DB_URL_PROD'];
    case 'test':
      return process.env['DB_URL_TEST'];
    default:
      return process.env['DB_URL_DEV'];
  }
};
