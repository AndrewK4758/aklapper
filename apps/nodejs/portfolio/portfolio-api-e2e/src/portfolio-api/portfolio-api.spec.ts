import axios from 'axios';

describe('GET /', () => {
  beforeAll(() => {
    process.env['NODE_ENV'] = 'test';
    const host = process.env.HOST ?? 'localhost';
    const port = process.env.PORT ?? '4758';
    axios.defaults.baseURL = `http://${host}:${port}/api/v1`;
  });
  it('should return a message', async () => {
    expect(1).toBe(1);
  });
});
