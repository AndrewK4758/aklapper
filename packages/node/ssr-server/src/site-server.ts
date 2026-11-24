import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { loadWorkspaceEnv } from '@aklapper/shared-utils/env';
import fastifyCookie from '@fastify/cookie';
import fastifyHelmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createRequestHandler, type ServerBuild } from 'react-router';

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
    const bodyText = await webResponse.text();
    const responseHeaders: Record<string, string | string[]> = {};
    webResponse.headers.forEach((value, key) => {
      const existing = responseHeaders[key];
      if (existing === undefined) {
        responseHeaders[key] = value;
      } else if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        responseHeaders[key] = [existing, value];
      }
    });
    return reply.code(webResponse.status).headers(responseHeaders).send(bodyText);
  });

  return {
    app,
    start: () => app.listen({ port, host }),
  };
}
