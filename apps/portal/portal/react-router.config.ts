import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/menu', '/cadence', '/chat', '/agensi', '/contact', '/changes-in-progress'],
});
