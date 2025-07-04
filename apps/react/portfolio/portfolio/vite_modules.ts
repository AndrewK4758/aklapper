import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

type ViteModules = {
  [key: string]: string;
};

const MODULES: ViteModules = {
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types'),
};

export default MODULES;
