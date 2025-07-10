import { createNodeDirname } from '@aklapper/utils';
import cors, { type CorsOptions } from 'cors';
import express, { type Express } from 'express';
import { join } from 'path';
import { PortfolioRoutes, router } from './routes/routes.js';

console.log(process.env.NODE_ENV);

const __dirname = createNodeDirname(import.meta.url);

const app: Express = express();

export const corsOptions: CorsOptions = {
  origin: [
    'https://www.andrew-k.us',
    'https://andrew-k.us',
    'http://localhost:4700',
    'http://localhost:4800',
    'https://games-424800.uc.r.appspot.com',
  ],
  credentials: true,
};

app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));
app.enable('trust proxy');
app.use('/assets', express.static(join(__dirname, 'assets')));
app.use('/api/v1', router);

new PortfolioRoutes();

const port = parseInt(process.env.PORT as string) || 4758;
const host = process.env.HOST || 'localhost';
const server = app.listen(port, () => {
  console.log(`Listening at http://${host}:${port}/api/v1`);
});
server.on('error', err => console.error(err));

export default app;
