import type { Response } from 'express';
import { StrictMode } from 'react';
import ReactDomServer from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type StaticHandlerContext } from 'react-router';
import App from './app/app.jsx';
import routes from './routes/routes.jsx';
import type { HashFiles } from './types/types.jsx';
import getFilenamesFromManifest from './utils/get-files-from-manifest.js';

import ServerError from './errors/server-error.js';

const { js, css, fonts } = (await getFilenamesFromManifest()) as HashFiles;

const handler = createStaticHandler(routes);

const render = async (fullUrl: string, resp: Response) => {
  console.info(`PATH: ${fullUrl}`);

  const context = (await handler.query(new Request(fullUrl))) as StaticHandlerContext;
  const router = createStaticRouter(routes, context);

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>
          Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming
          styles. Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP for
          simple ci/cd. Please feel free to click the github icon in the contact section for a full review of the
          monorepo
        </title>
        <meta
          name="title"
          content="Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming styles. Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP for simple ci/cd. Please feel free to click the github icon in the contact section for a full review of the monorepo"
        />
        <meta name="description" content="Personal developer portfolio for Andrew Klapper" />
        <meta name="keywords" content="Typescript, react, portfolio, developer" />
        <meta name="robots" content="index, follow" />
        <meta name="language" content="English" />
        <meta name="author" content="Andrew Klapper" />
        {fonts.map(font => (
          <link rel="preload" key={font} as="font" type="font/ttf" crossOrigin="" href={`/client/${font}`} />
        ))}
        <link rel="stylesheet" type="text/css" href={`/client/${css}`} />
        <link rel="icon" type="image/x-icon" href="/client/favicon.ico" />
      </head>
      <body id="root">
        <StrictMode>
          <App Router={<StaticRouterProvider router={router} context={context} hydrate={true} />} />
        </StrictMode>
      </body>
    </html>,
    {
      bootstrapModules: [`/client/${js}`],
      onShellReady() {
        console.log('START RENDERING COMPONENTS');
        resp.statusCode = context.statusCode || 200;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);
        pipe(resp);
      },
      onShellError(error) {
        interface ServerError extends Error {
          server: true;
        }
        console.error(`Shell error: ${error}`);
        const baseError = ReactDomServer.renderToString(<ServerError error={error as ServerError} />);
        const html = `
          <html lang="en">
            <head>
              <meta charset="utf-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>
                Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming
                styles. Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP
                for simple ci/cd. Please feel free to click the github icon in the contact section for a full review of
                the monorepo
              </title>
              <meta
                name="title"
                content="Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming styles. Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP for simple ci/cd. Please feel free to click the github icon in the contact section for a full review of the monorepo"
              />
              <meta name="description" content="Personal developer portfolio for Andrew Klapper" />
              <meta name="keywords" content="Typescript, react, portfolio, developer" />
              <meta name="robots" content="index, follow" />
              <meta name="language" content="English" />
              <meta name="author" content="Andrew Klapper" />
              <link rel="stylesheet" type="text/css" href="/client/${css}" />
              <link rel="icon" type="image/x-icon" href="/client/favicon.ico" />
            </head>
            <body id="root">
                ${baseError}
              <script type="module" src="/client/${js}"></script>
            </body>    
          </html>`;

        resp.statusCode = 500;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);
        resp.write(html);
        resp.send();
        resp.end();
      },
      onError(error) {
        console.error(`Suspense error: ${error}`);
      },
      onAllReady() {
        resp.end();
        console.log('ALL COMPONENTS RENDERED');
      }
    }
  );

  const timeoutId = setTimeout(() => {
    abort('Server Render Exceeded 10 Seconds!!!');
    console.warn('Render timed out!');
  }, 10000);

  resp.on('finish', () => {
    clearTimeout(timeoutId);
  });
};

export default render;
