import { VertexAI } from '@google-cloud/vertexai';
import { configDotenv } from 'dotenv';

configDotenv({ path: `./env/.env` });

// MY STUFF
export const PROJECT = 'games-424800';
export const LOCATION = 'us-central1';

export const MODEL = 'gemini-2.5-pro-preview-03-25'; //'gemini-2.0-flash'; //'gemini-1.5-pro-001';

const vertexAI = new VertexAI({
  project: PROJECT,
  location: LOCATION,
});

export default vertexAI;
