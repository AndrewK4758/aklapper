import { workspaceRoot } from '@nx/devkit';
import { resolve } from 'node:path';

type ViteModules = {
  [key: string]: string;
};

const MODULES: ViteModules = {
  '@aklapper/games-components': resolve(workspaceRoot, 'packages/games-components/src'),

  '@aklapper/media-recorder': resolve(workspaceRoot, 'packages/media-recorder/src'),

  '@aklapper/prompt-builder': resolve(workspaceRoot, 'packages/gen-ai/prompt-builder/src'),

  '@aklapper/react-shared': resolve(workspaceRoot, 'packages/react-shared/src'),

  '@aklapper/types': resolve(workspaceRoot, 'packages/types/src'),
};

export default MODULES;
