import ReactDomServer from 'react-dom/server';
import { createStaticHandler, createStaticRouter, StaticRouterProvider, type StaticHandlerContext } from 'react-router';
import routes from './routes/routes';
import type { Response } from 'express';

interface IRenderProps {
  path: string;
  port: number | string;
  resp: Response;
  template: string;
}

const render = async ({ path, port, resp, template }: IRenderProps) => {
  const handler = createStaticHandler(routes);
  const context = (await handler.query(new Request(`http://localhost:${port}${path}`))) as StaticHandlerContext;
  const router = createStaticRouter(routes, context);
  const [startHTML, endHTML] = template.split('<!--REPLACE-->');

  const { pipe, abort } = ReactDomServer.renderToPipeableStream(
    <StaticRouterProvider router={router} context={context} />,
    {
      bootstrapModules: ['/client.js'],
      onShellReady() {
        resp.statusCode = context.statusCode || 200;
        resp.setHeader('Content-Type', 'text/html');
        resp.write(startHTML);
        pipe(resp);
      },
      onShellError(error) {
        console.error(`Shell error: ${error}`);
      },
      onError(error) {
        console.error(`Suspense error: ${error}`);
      },
      onAllReady() {
        console.log('ALL COMPONENTS RENDERED');
        resp.write(endHTML);
        resp.end();
        resp.send();
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

  return resp;
};
export default render;
