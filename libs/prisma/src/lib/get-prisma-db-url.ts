const url = (NODE_ENV: string) => {
  switch (NODE_ENV) {
    case 'production':
      return process.env['DB_URL_PROD'];
    case 'test':
      return process.env['PRISMA_DB_NAME'] === 'chinook'
        ? process.env['DB_URL_TEST']
        : process.env['DB_URL_TEST_GAMES'];
    default:
      return process.env['DB_URL_DEV'];
  }
};

export default url;
