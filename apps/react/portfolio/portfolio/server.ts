import type { CorsOptions } from 'cors';
import cors from 'cors';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { cwd } from 'node:process';
import { createServer, type ViteDevServer } from 'vite';
import render from './src/main.server.tsx';

const envPort = process.env.PORT;
const HOST = process.env.HOST ?? 'localhost';
const PORT = envPort ? parseInt(envPort) : 4700;
const DEPLOY = process.env.DOCKER;
const isProduction = process.env.NODE_ENV === 'production';
const workspacePath = DEPLOY ? '/portfolio/dist/client/.vite' : './dist/client/.vite';
const ssrWorkspacePath = DEPLOY ? '/portfolio/dist/server.vite' : './dist/server/.vite';
const fileName = 'manifest.json';
const ssrFilename = 'ssr-manifest.json';
const rootDir = cwd();

(async () => {
  const app: Express = express();

  const corsOptions: CorsOptions = {
    origin: ['http://localhost:5800', 'http://localhost', 'http://localhost:4800', 'http://localhost:4700'],
  };

  JSON.parse(await fs.readFile(path.resolve(workspacePath, fileName), 'utf-8'));

  app.options(/.*/, cors(corsOptions));
  app.use(cors(corsOptions));

  let vite: ViteDevServer;

  if (isProduction) {
    app.use(
      '/client',
      express.static(path.resolve(rootDir, 'dist', 'client'), {
        index: false,
      }),
    );

    app.use(
      '/server',
      express.static(path.resolve(rootDir, 'dist', 'server'), {
        index: false,
      }),
    );
  } else {
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
      root: rootDir,
    });
    app.use(vite.middlewares);
  }

  app.use(/.*/, (req: Request, resp: Response, next: NextFunction) => {
    req.baseUrl.includes('/.well-known') ? resp.status(204).end() : next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(/.*/, async (req: Request, resp: Response) => {
    try {
      const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;

      let renderFunction = render;
      let clientManifest;
      let ssrManifest;

      if (isProduction) {
        // @ts-ignore
        clientManifest = JSON.parse(await fs.readFile(path.resolve(workspacePath, fileName), 'utf-8'));
        ssrManifest = JSON.parse(await fs.readFile(path.resolve(ssrWorkspacePath, ssrFilename), 'utf-8'));
      } else {
        const { default: renderModule } = await vite.ssrLoadModule(path.resolve(rootDir, 'src', 'main.server.tsx'));
        renderFunction = renderModule;
      }

      await renderFunction(fullUrl, resp, clientManifest, ssrManifest);
    } catch (error) {
      if (vite) {
        vite.ssrFixStacktrace(error as Error);
      }
      console.error(error);
    }
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`Serving Portfolio on PORT: ${PORT}`);
    console.log(`Mode: ${process.env.NODE_ENV}`);
  });

  server.on('error', console.error);
})();
