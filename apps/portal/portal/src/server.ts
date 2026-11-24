import { resolve } from 'node:path';

import { createSsrServer, type SsrServerInstance } from '@aklapper/ssr-server';

export interface PortalServerOptions {
  buildDir?: string;
  port?: number;
  host?: string;
}

export function createPortalServer(options: PortalServerOptions = {}): Promise<SsrServerInstance> {
  return createSsrServer({
    serviceName: 'portal-ssr',
    buildDir: options.buildDir ?? resolve(import.meta.dirname, '..', 'dist'),
    port: options.port ?? Number(process.env['PORTAL_PORT'] ?? process.env['PORT'] ?? 4300),
    host: options.host ?? process.env['PORTAL_HOST'] ?? process.env['HOST'] ?? '0.0.0.0',
  });
}

if (import.meta.main) {
  const server = await createPortalServer();
  await server.start();
}
