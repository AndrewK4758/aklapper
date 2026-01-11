import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

type ViteModules = {
  [key: string]: string;
};

const MODULES: ViteModules = {
  //Monorepo paths
  '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),
  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder/src/index.ts'),
  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src/index.ts'),
  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src/index.ts'),
  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),
  '@aklapper/vertex-ai': resolve(workspaceRoot, 'packages/gen-ai/vertex-ai/src/index.ts'),

  //Local project paths
  '@app': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/app'),
  '@assets': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/assets'),
  '@components': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/components'),
  '@contexts': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/contexts'),
  '@errors': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/errors'),
  '@hooks': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/hooks'),
  '@pages': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/pages'),
  '@routes': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/routes'),
  '@services': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/services'),
  '@styles': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/styles'),
  '@projectTypes': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/types'),
  '@utils': resolve(workspaceRoot, 'apps/react/portfolio/portfolio/src/utils'),
};

export default MODULES;
