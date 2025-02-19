import axios from 'axios';

export default async function () {
  // Configure axios for tests to use.
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '4758';
  axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
}
