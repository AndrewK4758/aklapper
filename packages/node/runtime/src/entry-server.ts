import { PassThrough, Readable } from 'node:stream';

import { isbot } from 'isbot';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import type { EntryContext } from 'react-router';
import { ServerRouter } from 'react-router';

export const streamTimeout = 5_000;

export interface EntryServerOptions {
  streamTimeout?: number;
}

export function createEntryServer(options: EntryServerOptions = {}) {
  const timeoutMs = options.streamTimeout ?? streamTimeout;

  function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
  ): Response | Promise<Response> {
    if (request.method.toUpperCase() === 'HEAD') {
      return new Response(null, {
        status: responseStatusCode,
        headers: responseHeaders,
      });
    }

    return new Promise((resolve, reject) => {
      let shellRendered = false;
      let streamClosed = false;
      let statusCode = responseStatusCode;
      const userAgent = request.headers.get('user-agent');
      const readyOption =
        (userAgent && isbot(userAgent)) || routerContext.isSpaMode ? 'onAllReady' : 'onShellReady';

      let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        abort();
      }, timeoutMs + 1000);

      const clearRenderTimeout = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
      };

      const { pipe, abort } = renderToPipeableStream(
        createElement(ServerRouter, { context: routerContext, url: request.url }),
        {
          [readyOption]() {
            shellRendered = true;
            const body = new PassThrough({
              final(callback) {
                clearRenderTimeout();
                callback();
              },
              destroy(error, callback) {
                streamClosed = true;
                clearRenderTimeout();
                callback(error);
              },
            });
            const stream = Readable.toWeb(body) as ReadableStream;

            responseHeaders.set('Content-Type', 'text/html');
            pipe(body);

            resolve(
              new Response(stream, {
                headers: responseHeaders,
                status: statusCode,
              }),
            );
          },
          onShellError(error: unknown) {
            clearRenderTimeout();
            reject(error);
          },
          onError(error: unknown) {
            statusCode = 500;
            if (shellRendered && !streamClosed) {
              console.error(error);
            }
          },
        },
      );
    });
  }

  return { handleRequest, streamTimeout: timeoutMs };
}

const defaultEntryServer = createEntryServer();
export const handleRequest = defaultEntryServer.handleRequest;
