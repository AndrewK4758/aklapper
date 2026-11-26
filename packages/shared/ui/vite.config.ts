import { join } from 'node:path';

import { createUiLibViteConfig } from '@aklapper/tooling/build';

export default createUiLibViteConfig({
  name: '@aklapper/ui',
  testName: 'shared-ui',
  root: import.meta.dirname,
  cacheDir: '../../../node_modules/.vite/packages/shared/ui',
  tsconfigPath: join(import.meta.dirname, 'tsconfig.lib.json'),
  entry: {
    index: 'src/index.ts',
    'terminal-workspace': 'src/terminal-workspace.ts',
    'mobile-tui-workspace': 'src/mobile-tui-workspace.ts',
    'workspace-storage': 'src/workspace-storage.ts',
    'qr-code': 'src/qr-code.ts',
    'sandboxed-artifact-frame': 'src/sandboxed-artifact-frame.ts',
    'site-content-preview': 'src/site-content-preview.ts',
    'terminal-portrait': 'src/terminal-portrait.ts',
  },
});
