describe('GET /', () => {
  beforeAll(() => {
    process.env['NODE_ENV'] = 'test';
  });
  it('should return a message', async () => {
    expect(1).toBe(1);
  });
});
