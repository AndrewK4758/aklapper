import { reserveLoopbackPort } from '../src/index.ts';

describe('node-e2e-kit', () => {
  it('reserves distinct ephemeral loopback ports', async () => {
    const port = await reserveLoopbackPort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65_536);
  });
});
