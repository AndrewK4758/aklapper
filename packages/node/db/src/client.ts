import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';

import * as schema from './schema.ts';

export type AppDatabase = NodePgDatabase<typeof schema>;

export function isReactRouterPrerender(): boolean {
  return process.env['IS_RR_BUILD_REQUEST'] === 'yes';
}

export function createDbPool(connectionString = process.env['DATABASE_URL']): Pool {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize PostgreSQL pool');
  }
  const maxParsed = Number(process.env['PG_MAX_CONNS'] ?? 10);
  const max = Number.isFinite(maxParsed) && maxParsed > 0 ? maxParsed : 10;
  return new Pool({
    connectionString,
    max,
    idleTimeoutMillis: 30_000,
    allowExitOnIdle: true,
    connectionTimeoutMillis: isReactRouterPrerender() ? 1_500 : 10_000,
  });
}

export function createDb(client: Pool | PoolClient): AppDatabase {
  return drizzle(client, { schema });
}

let sharedPool: Pool | null = null;
let sharedDb: AppDatabase | null = null;

export function getSharedDb(connectionString = process.env['DATABASE_URL']): AppDatabase {
  if (!sharedDb) {
    sharedPool = createDbPool(connectionString);
    sharedDb = createDb(sharedPool);
  }
  return sharedDb;
}

export async function closeSharedDb(): Promise<void> {
  if (sharedPool) {
    const poolToClose = sharedPool;
    sharedPool = null;
    sharedDb = null;
    await poolToClose.end();
  }
}
