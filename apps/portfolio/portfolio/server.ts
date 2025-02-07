import { workspaceRoot } from '@nx/devkit';
import type { CorsOptions } from 'cors';
import cors from 'cors';
import type { Express, Request, Response } from 'express';
import express from 'express';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import render from './src/main-server.tsx';

const PORT = process.env.PORT || 4700;

const template = readFileSync(resolve(workspaceRoot, 'apps/portfolio/portfolio/index.html'), 'utf8');

const app: Express = express();

const corsOptions: CorsOptions = {
  origin: ['http://localhost:5800', 'http://localhost', 'http://localhost:4800']
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.static(resolve(workspaceRoot, 'apps/portfolio/portfolio/dist/client')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('*', async (req: Request, resp: Response) => {
  try {
    await render({ path: req.path, port: PORT, resp, template });
  } catch (error) {
    console.error(error);
  }
});

const server = app.listen(PORT, () => {
  console.log(`Serving Portfolio on PORT: ${PORT}`);
});

server.on('error', console.error);
