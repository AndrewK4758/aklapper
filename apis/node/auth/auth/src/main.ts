import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';

import { buildAuthServer } from './server.ts';

loadWorkspaceEnv({ startDir: import.meta.dirname });

const port = Number(process.env['PORT'] ?? 4101);
const host = process.env['HOST'] ?? '0.0.0.0';

const server = await buildAuthServer();
await server.listen({ port, host });
