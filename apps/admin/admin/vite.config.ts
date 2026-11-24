import { createSsrViteConfig } from '@aklapper/tooling/build';

export default createSsrViteConfig({
  name: '@aklapper/admin',
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/apps/admin/admin',
  defaultPort: 4201,
});
