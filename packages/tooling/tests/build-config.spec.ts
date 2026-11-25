import { createReactRouterAppConfig, createSsrViteConfig } from '../src/build.ts';

describe('@aklapper/tooling/build', () => {
  it('targets dist for React Router SSR builds', () => {
    const config = createReactRouterAppConfig();
    expect(config.buildDirectory).toBe('dist');
  });

  it('leaves emptyOutDir unset so React Router cleans dist natively', () => {
    const config = createSsrViteConfig({
      name: '@aklapper/portal',
      root: '/tmp/portal',
      cacheDir: '/tmp/cache',
      defaultPort: 4200,
    });

    expect(config.build?.emptyOutDir).toBeUndefined();
  });
});
