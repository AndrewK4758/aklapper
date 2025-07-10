import { createNodeDirname } from '@aklapper/utils';
import { configDotenv } from 'dotenv';
import { google, type Auth } from 'googleapis';
import { resolve } from 'node:path';

const __dirname = createNodeDirname(import.meta.url);

configDotenv({ path: resolve(__dirname, '../', 'env/.env.google_oauth') });

const NODE_ENV = process.env.NODE_ENV;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = NODE_ENV === 'production' ? process.env.GOOGLE_REDIRECT_URI : process.env.GOOGLE_REDIRECT_URI_DEV;

const oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export default oauth2Client;
