import { configDotenv } from 'dotenv';
import { google, type Auth } from 'googleapis';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

configDotenv({ path: resolve(__dirname, '../env/.env') });

const clientID = process.env.GOOGLE_CLIENT_ID;

const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectURI = process.env.GOOGLE_REDIRECT_URI;

const oauth2Client: Auth.OAuth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);

export default oauth2Client;
