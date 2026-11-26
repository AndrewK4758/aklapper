import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/about', '/cadence', '/chat', '/agensi', '/contact'],
});
