import { PassThrough, Readable } from 'node:stream';

import { classifyServerError } from '@aklapper/core/server-errors';
import { isbot } from 'isbot';
import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import {
  ServerRouter,
  type EntryContext,
  type HandleErrorFunction,
  type RouterContextProvider,
} from 'react-router';

import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from './request-context.ts';
import { isAuthenticPrerenderRequest } from './stream-result.ts';

export const streamTimeout = 5_000;

export interface EntryServerOptions {
  streamTimeout?: number;
}

export type EntryRenderModeBranch =
  | 'onShellReady'
  | 'onAllReady_bot'
  | 'onAllReady_prerender'
  | 'onAllReady_spa';

export function inspectPrerenderRequest(
  request: Request,
  env: Readonly<Record<string, string | undefined>> = process.env,
): { readonly isPrerender: boolean; readonly spoofed: boolean } {
  const headerPresent = request.headers.get('x-react-router-prerender') === 'yes';
  if (!headerPresent) {
    return { isPrerender: false, spoofed: false };
  }
  const authentic = isAuthenticPrerenderRequest(request, env);
  return { isPrerender: authentic, spoofed: !authentic };
}

export function createEntryServer(options: EntryServerOptions = {}) {
  const timeoutMs = options.streamTimeout ?? streamTimeout;

  function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext?: RouterContextProvider,
  ): Response | Promise<Response> {
    const reqCtx = getRequestContext(loadContext);
    const correlationId = getOrCreateCorrelationId(request, loadContext);
    const logger = reqCtx?.logger ?? createFallbackLogger(reqCtx?.serviceName ?? 'ssr-entry');

    responseHeaders.set('X-Correlation-Id', correlationId);

    if (request.signal.aborted) {
      return new Response(null, {
        status: 499,
        headers: responseHeaders,
      });
    }

    if (request.method.toUpperCase() === 'HEAD') {
      return new Response(null, {
        status: responseStatusCode,
        headers: responseHeaders,
      });
    }

    const { isPrerender, spoofed } = inspectPrerenderRequest(request);
    if (spoofed) {
      logger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'ssr.entry.spoofed_prerender_header',
          correlationId,
        },
        'Ignored spoofed x-react-router-prerender header outside build environment',
      );
    }

    const userAgent = request.headers.get('user-agent');
    let readyOption: 'onAllReady' | 'onShellReady';
    let branch: EntryRenderModeBranch;

    if (isPrerender) {
      readyOption = 'onAllReady';
      branch = 'onAllReady_prerender';
    } else if (routerContext.isSpaMode) {
      readyOption = 'onAllReady';
      branch = 'onAllReady_spa';
    } else if (userAgent && isbot(userAgent)) {
      readyOption = 'onAllReady';
      branch = 'onAllReady_bot';
    } else {
      readyOption = 'onShellReady';
      branch = 'onShellReady';
    }

    logger.info(
      {
        seam_type: 'RULE_DIVERGENCE',
        event: 'ssr.entry.render_mode_selected',
        branch,
        correlationId,
      },
      `Selected SSR render mode ${branch}`,
    );

    return new Promise((resolve, reject) => {
      let shellRendered = false;
      let streamClosed = false;
      let statusCode = responseStatusCode;

      let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
        abort();
      }, timeoutMs + 1_000);

      const handleRequestAbort = () => {
        cleanupLifecycle();
        abort();
      };

      const cleanupLifecycle = () => {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        request.signal.removeEventListener('abort', handleRequestAbort);
      };

      request.signal.addEventListener('abort', handleRequestAbort, { once: true });

      const { pipe, abort } = renderToPipeableStream(
        createElement(ServerRouter, { context: routerContext, url: request.url }),
        {
          ...(readyOption === 'onAllReady'
            ? { progressiveChunkSize: Number.POSITIVE_INFINITY }
            : {}),
          [readyOption]() {
            shellRendered = true;
            const body = new PassThrough({
              final(callback) {
                cleanupLifecycle();
                callback();
              },
              destroy(error, callback) {
                streamClosed = true;
                cleanupLifecycle();
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
            cleanupLifecycle();
            reject(error);
          },
          onError(error: unknown) {
            statusCode = 500;
            if (shellRendered && !streamClosed && !request.signal.aborted) {
              const { diagnostic } = classifyServerError(error, {
                correlationId,
                source: 'ssr.entry.onError',
              });
              logDiagnosticError(logger, diagnostic);
            }
          },
        },
      );
    });
  }

  const handleError: HandleErrorFunction = (error, { request, context }) => {
    if (request.signal.aborted) {
      return;
    }
    const reqCtx = getRequestContext(context);
    const correlationId = getOrCreateCorrelationId(request, context);
    const logger = reqCtx?.logger ?? createFallbackLogger(reqCtx?.serviceName ?? 'ssr-entry');
    const { diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'ssr.entry.handleError',
    });
    logDiagnosticError(logger, diagnostic);
  };

  return { handleRequest, handleError, streamTimeout: timeoutMs };
}

const defaultEntryServer = createEntryServer();
export const handleRequest = defaultEntryServer.handleRequest;
export const handleError = defaultEntryServer.handleError;
