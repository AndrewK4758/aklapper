import { buildAnalyticsServer } from './server.ts';

const port = Number(process.env['PORT'] ?? 4102);
const host = process.env['HOST'] ?? '0.0.0.0';

const server = await buildAnalyticsServer();
await server.listen({ port, host });
