import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/menu', '/cadence', '/ask', '/agensi', '/contact', '/changes-in-progress'],
});
