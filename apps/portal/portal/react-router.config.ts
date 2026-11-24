import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/menu', '/cadence', '/contact', '/changes-in-progress'],
});
