import type { CorsOptions } from 'cors';
import cors from 'cors';
import { configDotenv } from 'dotenv';
import type { Express } from 'express';
import express from 'express';
import { createServer } from 'http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Routes, { router } from './routes/routes.js';

const __filename = fileURLToPath(import.meta.url);

const __dirname = dirname(__filename);

configDotenv({ path: resolve(__dirname, '../env/.env') });

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:4700',
    'http://localhost:4000',
    'http://localhost:4800',
    'http://localhost:4200',
    'http://localhost:4300',
    'http://localhost:3000',
    'https://andrew-k.us',
    'https://www.andrew-k.us',
    'http://localhost',
    'https://games-424800.uc.r.appspot.com',
  ],
  methods: '*',
  exposedHeaders: '*',
  optionsSuccessStatus: 204,
  allowedHeaders: '*',
  credentials: true,
};

export const httpServer = createServer(app);

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.enable('trust proxy');
app.use('/assets', express.static(join(__dirname, '../src', 'assets')));
app.use('/api/v1', router);

new Routes();

const port = process.env.PORT ?? 4000;

const server = app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}/api/v1`);
});
server.on('error', console.error);
