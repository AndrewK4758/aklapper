import { VertexAI } from '@google-cloud/vertexai';
import { workspaceRoot } from '@nx/devkit';
import { configDotenv } from 'dotenv';
import { resolve } from 'node:path';
import getEnvVariable from '../../utils/get_env_var.js';

configDotenv({ path: resolve(workspaceRoot, 'packages/gen-ai/vertex-ai', `env/.env`) });

// MY STUFF
export const ID = getEnvVariable('PROJECT_ID');
export const LOCATION = getEnvVariable('PROJECT_LOCATION');
export const MODEL = getEnvVariable('GEMINI_MODEL');

const vertexAI = new VertexAI({
  project: ID,
  location: LOCATION,
});

export default vertexAI;
