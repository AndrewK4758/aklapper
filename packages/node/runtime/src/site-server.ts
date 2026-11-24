import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';

import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequestHandler, type ServerBuild } from 'react-router';

import { loadWorkspaceEnv } from './env.ts';

export interface SsrServerOptions {
  serviceName: string;
  buildDir: string;
  port: number;
  host: string;
}

export interface SsrServerInstance {
  app: FastifyInstance;
  start: () => Promise<string>;
}

const BODILESS_STATUS_CODES = new Set([204, 205, 304]);

function collectResponseHeaders(webHeaders: Headers): Record<string, string | string[]> {
  const responseHeaders: Record<string, string | string[]> = {};
  webHeaders.forEach((value, key) => {
    const existing = responseHeaders[key];
    if (existing === undefined) {
      responseHeaders[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      responseHeaders[key] = [existing, value];
    }
  });
  return responseHeaders;
}

export async function createSsrServer(options: SsrServerOptions): Promise<SsrServerInstance> {
  loadWorkspaceEnv({ startDir: options.buildDir });
  const { serviceName, buildDir, port, host } = options;
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 });

  const rawBufferParser = (
    _request: unknown,
    body: Buffer,
    done: (err: Error | null, body?: Buffer) => void,
  ) => {
    done(null, body);
  };

  app.addContentTypeParser(/^multipart\/form-data/i, { parseAs: 'buffer' }, rawBufferParser);
  app.addContentTypeParser(
    ['application/x-www-form-urlencoded', 'application/json'],
    { parseAs: 'buffer' },
    rawBufferParser,
  );

  await app.register(fastifyHelmet, { contentSecurityPolicy: false });
  await app.register(fastifyCookie);
  const servePrerenderedStatic = process.env['SERVE_PRERENDERED_STATIC'] === 'true';

  await app.register(fastifyStatic, {
    root: resolve(buildDir, 'client'),
    prefix: '/',
    wildcard: false,
    index: servePrerenderedStatic ? 'index.html' : false,
    globIgnore: servePrerenderedStatic ? [] : ['**/*.html', '**/*.data'],
  });

  app.get('/healthz', async () => ({ status: 'ok', service: serviceName }));

  const serverBuildUrl = pathToFileURL(resolve(buildDir, 'server', 'index.js')).href;
  const serverBuild = (await import(/* @vite-ignore */ serverBuildUrl)) as ServerBuild;
  const handleRequest = createRequestHandler(serverBuild, process.env['NODE_ENV'] ?? 'production');

  app.all('*', async (request, reply) => {
    const origin = `${request.protocol}://${request.headers.host ?? `localhost:${port}`}`;
    const url = new URL(request.url, origin);
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item);
      } else if (typeof value === 'string') {
        headers.set(key, value);
      }
    }
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    let requestBody: BodyInit | undefined;
    if (hasBody && request.body !== undefined && request.body !== null) {
      if (Buffer.isBuffer(request.body)) {
        requestBody = new Uint8Array(request.body);
      } else if (typeof request.body === 'string') {
        requestBody = request.body;
      } else {
        requestBody = JSON.stringify(request.body);
      }
    }
    const webRequest = new Request(url, {
      method: request.method,
      headers,
      body: requestBody,
    });

    const webResponse = await handleRequest(webRequest);
    const responseHeaders = collectResponseHeaders(webResponse.headers);

    if (
      request.method === 'HEAD' ||
      BODILESS_STATUS_CODES.has(webResponse.status) ||
      webResponse.body === null
    ) {
      return reply.code(webResponse.status).headers(responseHeaders).send();
    }

    const contentType = (webResponse.headers.get('content-type') ?? '').toLowerCase();
    if (contentType.includes('text/event-stream')) {
      if (responseHeaders['cache-control'] === undefined) {
        responseHeaders['cache-control'] = 'no-cache';
      }
      if (responseHeaders['connection'] === undefined) {
        responseHeaders['connection'] = 'keep-alive';
      }
      if (responseHeaders['x-accel-buffering'] === undefined) {
        responseHeaders['x-accel-buffering'] = 'no';
      }
      const nodeStream = Readable.fromWeb(webResponse.body as unknown as NodeWebReadableStream);
      request.raw.once('close', () => {
        if (!nodeStream.destroyed) {
          nodeStream.destroy();
        }
      });
      return reply.code(webResponse.status).headers(responseHeaders).send(nodeStream);
    }

    const bodyBuffer = Buffer.from(await webResponse.arrayBuffer());
    return reply.code(webResponse.status).headers(responseHeaders).send(bodyBuffer);
  });

  return {
    app,
    start: () => app.listen({ port, host }),
  };
}
