import axios from 'axios';

export default async function () {
  process.env.NODE_ENV = 'test';
  const host = process.env.HOST ?? 'localhost';
  const port = process.env.PORT ?? '4000';
  process.env.CRUD_API_URL = `http://${host}:${port}/api/v1`;
  axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
}
