import { VertexAI } from '@google-cloud/vertexai';
import { configDotenv } from 'dotenv';
import { cwd } from 'process';

configDotenv({ path: `${cwd()}/env/.env` });

// MY STUFF
export const PROJECT = process.env['GCP_PROJECT'];
export const LOCATION = process.env['GCP_LOCATION'];

export const MODEL = 'gemini-1.5-pro-001';

const vertexAI = new VertexAI({
  project: PROJECT,
  location: LOCATION
});

export default vertexAI;
