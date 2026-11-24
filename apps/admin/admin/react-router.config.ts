import { createReactRouterAppConfig } from '@aklapper/tooling/build';

export default createReactRouterAppConfig({
  prerender: ['/', '/analytics'],
});
