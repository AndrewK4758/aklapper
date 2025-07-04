import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

type ViteModules = {
  [key: string]: string;
};

const MODULES: ViteModules = {
  '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),

  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types'),

  '@aklapper/vertex-ai': resolve(workspaceRoot, 'packages/gen-ai/vertex-ai'),
};

export default MODULES;
