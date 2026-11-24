import { resolve } from 'node:path';

import { loadWorkspaceEnv } from '@aklapper/shared-utils/env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { type AppDatabase, createDb, createDbPool } from './client.ts';

export function getDefaultMigrationsFolder(): string {
  return resolve(import.meta.dirname, '..', 'drizzle');
}

export async function runMigrations(
  db: AppDatabase,
  migrationsFolder = getDefaultMigrationsFolder(),
): Promise<void> {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await runMigrations(db);
    console.log('Postgres migrations applied successfully.');
  } finally {
    await pool.end();
  }
}
