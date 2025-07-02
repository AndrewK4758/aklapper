import { VertexAI } from '@google-cloud/vertexai';
import { configDotenv } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import getEnvVariable from '../../utils/get_env_var.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

configDotenv({ path: resolve(__dirname, `env/.env`) });

// MY STUFF
export const ID = getEnvVariable('PROJECT_ID');
export const LOCATION = getEnvVariable('PROJECT_LOCATION');
export const MODEL = getEnvVariable('GEMINI_MODEL');

const vertexAI = new VertexAI({
  project: ID,
  location: LOCATION,
});

export default vertexAI;
