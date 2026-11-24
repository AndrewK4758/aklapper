import { resolve } from 'node:path';

import { createSsrServer, type SsrServerInstance } from '@aklapper/ssr-server';

export interface AdminServerOptions {
  buildDir?: string;
  port?: number;
  host?: string;
}

export function createAdminServer(options: AdminServerOptions = {}): Promise<SsrServerInstance> {
  return createSsrServer({
    serviceName: 'admin-ssr',
    buildDir: options.buildDir ?? resolve(import.meta.dirname, '..', 'dist'),
    port: options.port ?? Number(process.env['ADMIN_PORT'] ?? process.env['PORT'] ?? 4301),
    host: options.host ?? process.env['ADMIN_HOST'] ?? process.env['HOST'] ?? '0.0.0.0',
  });
}

if (import.meta.main) {
  const server = await createAdminServer();
  await server.start();
}
