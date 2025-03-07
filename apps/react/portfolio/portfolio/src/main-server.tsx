import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import type { Response } from 'express';
import ReactDomServer from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type StaticHandlerContext } from 'react-router';
import routes from './routes/routes.jsx';
import Theme from './styles/theme.jsx';

const handler = createStaticHandler(routes);

const render = async (fullUrl: string, resp: Response) => {
  console.log(fullUrl);
  const context = (await handler.query(new Request(fullUrl))) as StaticHandlerContext;
  const router = createStaticRouter(routes, context);

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(
    <html lang="en">
      <head>
        <meta char-set="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        <link rel="icon" type="image/x-icon" href="/server/favicon.ico" />
        <link rel="stylesheet" href="/client/browser.css" />
      </head>
      <body>
        <div id="root">
          <ThemeProvider theme={Theme}>
            <CssBaseline />
            <StaticRouterProvider router={router} context={context} hydrate={true} />
          </ThemeProvider>
        </div>
      </body>
    </html>,
    {
      bootstrapModules: ['/client/browser.js'],
      onShellReady() {
        console.log('START RENDERING COMPONENTS');
        resp.statusCode = context.statusCode || 200;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);
        pipe(resp);
      },
      onShellError(error) {
        console.error(`Shell error: ${error}`);
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
    abort();
    console.warn('Render timed out!');
  }, 10000);

  resp.on('finish', () => {
    clearTimeout(timeoutId);
  });
};

export default render;
