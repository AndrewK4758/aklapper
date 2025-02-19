import axios from 'axios';

export default async function () {
  process.env.NODE_ENV = 'test';
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '3000';
  axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
}
