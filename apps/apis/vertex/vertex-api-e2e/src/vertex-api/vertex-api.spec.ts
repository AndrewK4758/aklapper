import axios from 'axios';

describe('GET /', () => {
  beforeAll(() => {
    process.env['NODE_ENV'] = 'test';
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ?? '5000';
    axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
  });
  it('should return a message', async () => {
    const resp = await axios.get(`/context-path`);

    const contextPath = resp.data;

    expect(resp.status).toBe(201);
    expect(contextPath.length).toEqual(8);
  });
});
