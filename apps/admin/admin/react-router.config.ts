import { createReactRouterAppConfig } from '@aklapper/shared-utils/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/analytics'],
});
