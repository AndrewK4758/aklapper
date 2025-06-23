import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { Response } from 'express';
// import * as fs from 'node:fs/promises';
// import { join } from 'node:path';
import { StrictMode } from 'react';
import ReactDomServer from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type StaticHandlerContext } from 'react-router';
import ServerError from './errors/server-error';
import routes from './routes/routes';
import Theme from './styles/themes/theme';
import type { ManifestType } from './types/types';
import getFilenamesFromManifest from './utils/get-files-from-manifest';
import parseSsrManifestFile from './utils/parse_ssr_manifest';

// async function getIconsForLinks(dirPath: string) {
//   const icons = await fs.readdir(dirPath, { withFileTypes: true, encoding: 'utf8' });
//   const hrefPath = '/client/icons/intro';

//   return icons.map(icon => join(hrefPath, icon.name));
// }

// const icons = await getIconsForLinks('./public/icons/intro');
const handler = createStaticHandler(routes);

const render = async (fullUrl: string, resp: Response, clientManifest: ManifestType, ssrManifest: ManifestType) => {
  console.info(`PATH: ${fullUrl}`);

  const { js, css } = await getFilenamesFromManifest(clientManifest);

  const preloadLinks = parseSsrManifestFile(ssrManifest);
  const context = (await handler.query(new Request(fullUrl))) as StaticHandlerContext;
  const router = createStaticRouter(routes, context);

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(
    <StrictMode>
      <ThemeProvider theme={Theme}>
        <CssBaseline />
        <StaticRouterProvider router={router} context={context} hydrate={true} />
      </ThemeProvider>
    </StrictMode>,
    {
      bootstrapModules: [`${js !== undefined ? `/client/${js}` : '/src/main.tsx'}`],
      progressiveChunkSize: 500,

      onShellReady() {
        console.log('START RENDERING COMPONENTS');

        resp.statusCode = context.statusCode || 200;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Accept-Encoding', 'gzip, deflate, br');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);

        resp.write(`<html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />`);

        !clientManifest &&
          resp.write(`
          <script
            type="module">
                  import RefreshRuntime from "/@react-refresh"
                  RefreshRuntime.injectIntoGlobalHook(window)
                  window.$RefreshReg$ = () => {}
                  window.$RefreshSig$ = () => (type) => type
                  window.__vite_plugin_react_preamble_installed__ = true
          </script>`);

        resp.write(`<title>
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

        <link
          rel="stylesheet"
          type="text/css"
          href="${css !== undefined ? `/client/${css}` : '/src/styles/main-styles.css'}"
        />
        
        <link rel="icon" type="image/x-icon" href="/client/favicon.ico" />
        `);
        // <link rel="preload" as="image" href="/client/images/swirly-dots-to-chrome.webp">

        // icons.forEach(link => resp.write(`<link rel="preload" as="image" type="image/svg+xml" href="${link}" />`));

        ssrManifest && resp.write(ReactDomServer.renderToString(preloadLinks));

        resp.write('</head/>');
        resp.write('<body><div id="root">');
        pipe(resp);
      },
      onShellError(error) {
        interface ServerError extends Error {
          server: true;
        }
        console.error(`Shell error: ${error}`);
        const baseError = ReactDomServer.renderToString(<ServerError error={error as ServerError} />);

        resp.statusCode = 500;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Accept-Encoding', 'gzip, deflate, br');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);
        resp.write(html(baseError, js, css));
        resp.send();
      },
      onError(error) {
        console.error(`Suspense error: ${error}`);
      },
      onAllReady() {
        console.log('ALL COMPONENTS RENDERED');
        resp.write('</div></body></html>');
      },
    },
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

const html = (baseError: string, js: string | undefined, css: string | undefined) => `
          <html lang="en">
            <head>
              <meta charSet="utf-8" />
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
            <body>
            <div id="root">
                ${baseError}
                </div>
              <script type="module" src="/client/${js}"></script>
            </body>    
          </html>`;
