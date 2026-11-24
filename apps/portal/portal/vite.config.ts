import { createSsrViteConfig } from '@aklapper/shared-utils/build';

export default createSsrViteConfig({
  name: '@aklapper/portal',
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/apps/portal/portal',
  defaultPort: 4200,
});
