export const url = (NODE_ENV: string) => {
  console.log(NODE_ENV);
  switch (NODE_ENV) {
    case 'production':
      return process.env['DB_URL_PROD'];
    case 'test':
      return process.env['DB_URL_TEST'];
    default:
      return process.env['DB_URL_DEV'];
  }
};

export default url;
