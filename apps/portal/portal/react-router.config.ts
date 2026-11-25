import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/cadence', '/chat', '/agensi', '/contact', '/changes-in-progress'],
});
