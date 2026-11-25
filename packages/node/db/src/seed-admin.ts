import { hashPasswordArgon2id } from '@aklapper/node-runtime/auth';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';

import { upsertAdminUserPassword } from './auth-queries.ts';
import { type AppDatabase, createDb, createDbPool } from './client.ts';

export interface SeedAdminUserResult {
  seeded: boolean;
  handle: string;
  action: 'inserted' | 'updated' | 'skipped';
}

export async function seedAdminUserFromEnv(
  db: AppDatabase,
  env: Record<string, string | undefined> = process.env,
): Promise<SeedAdminUserResult> {
  const rawHandle = env['ADMIN_HANDLE']?.trim().toLowerCase();
  const handle = rawHandle && rawHandle.length > 0 ? rawHandle : 'admin';
  const password = env['ADMIN_PASSWORD'];

  if (!password || password.trim().length === 0) {
    console.info(JSON.stringify({ event: 'auth.seed.password_skipped', handle }));
    return {
      seeded: false,
      handle,
      action: 'skipped',
    };
  }

  const passwordHashArgon2 = await hashPasswordArgon2id(password);
  const { action } = await upsertAdminUserPassword(db, {
    handle,
    passwordHashArgon2,
    overwriteExisting: true,
  });

  console.info(JSON.stringify({ event: 'auth.seed.password_applied', handle, action }));
  return {
    seeded: true,
    handle,
    action,
  };
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedAdminUserFromEnv(db);
  } finally {
    await pool.end();
  }
}
