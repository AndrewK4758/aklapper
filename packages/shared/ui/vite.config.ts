import { join } from 'node:path';

import { createUiLibViteConfig } from '@aklapper/shared-utils/build';

export default createUiLibViteConfig({
  name: '@aklapper/ui',
  testName: 'shared-ui',
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/shared/ui',
  tsconfigPath: join(import.meta.dirname, 'tsconfig.lib.json'),
});
