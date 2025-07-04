import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

type ViteModules = {
  [key: string]: string;
};

const MODULES: ViteModules = {
  '@aklapper/chinook-client': resolve(workspaceRoot, 'packages/prisma/chinook/src/index.ts'),

  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src/index.ts'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder/src'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src/index.ts'),

  '@aklapper/vertex-ai': resolve(workspaceRoot, 'packages/gen-ai/vertex-ai/src/index.ts'),
};

export default MODULES;
