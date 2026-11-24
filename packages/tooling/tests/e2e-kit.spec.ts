import { reserveLoopbackPort } from '../src/e2e.ts';

describe('@aklapper/tooling/e2e', () => {
  it('reserves distinct ephemeral loopback ports', async () => {
    const port = await reserveLoopbackPort();
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThan(65_536);
  });
});
