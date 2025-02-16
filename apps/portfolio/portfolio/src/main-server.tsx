import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import type { Response } from 'express';
import ReactDomServer from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type StaticHandlerContext } from 'react-router';
import routes from './routes/routes.jsx';
import Theme from './styles/theme.jsx';

const handler = createStaticHandler(routes);

const render = async (fullUrl: string, resp: Response, template: string) => {
  console.log(fullUrl);
  const context = (await handler.query(new Request(fullUrl))) as StaticHandlerContext;
  const router = createStaticRouter(routes, context);
  const [START_HTML, END_HTML] = template.split('<!--REPLACE-->');

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <StaticRouterProvider router={router} context={context} />
    </ThemeProvider>,
    {
      onShellReady() {
        console.log('START RENDERING COMPONENTS');
        resp.statusCode = context.statusCode || 200;
        resp.setHeader('Content-Type', 'text/html');
        resp.setHeader('Access-Control-Allow-Origin', fullUrl);
        resp.write(START_HTML);
        pipe(resp);
      },
      onShellError(error) {
        console.error(`Shell error: ${error}`);
      },
      onError(error) {
        console.error(`Suspense error: ${error}`);
      },
      onAllReady() {
        resp.write(END_HTML);
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
