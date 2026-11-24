import { createReactRouterAppConfig } from '@aklapper/shared-utils/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/menu', '/cadence', '/contact', '/changes-in-progress'],
});
