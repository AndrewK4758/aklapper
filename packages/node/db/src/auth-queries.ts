import type { Role } from '@aklapper/core';
import { count, eq, sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthUserRecord {
  id: string;
  handle: string;
  role: Role;
  createdAt: Date;
}

export interface AdminPasswordUserRecord extends AuthUserRecord {
  passwordHashArgon2: string | null;
}

export interface UpsertAdminPasswordInput {
  handle: string;
  passwordHashArgon2: string;
  overwriteExisting?: boolean;
}

export interface UpsertAdminPasswordResult {
  action: 'inserted' | 'updated' | 'skipped';
  user: AuthUserRecord;
}

export async function findAdminUserForPasswordLogin(
  db: AppDatabase,
  handle: string,
): Promise<AdminPasswordUserRecord | null> {
  const normalizedHandle = handle.trim().toLowerCase();
  if (!normalizedHandle) return null;

  const [row] = await db
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      role: schema.users.role,
      passwordHashArgon2: schema.users.passwordHashArgon2,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.handle, normalizedHandle))
    .limit(1);

  return row ?? null;
}

export async function upsertAdminUserPassword(
  db: AppDatabase,
  input: UpsertAdminPasswordInput,
): Promise<UpsertAdminPasswordResult> {
  const normalizedHandle = input.handle.trim().toLowerCase() || 'admin';
  const overwriteExisting = input.overwriteExisting ?? true;

  if (!overwriteExisting) {
    const [existing] = await db
      .select({
        id: schema.users.id,
        handle: schema.users.handle,
        role: schema.users.role,
        passwordHashArgon2: schema.users.passwordHashArgon2,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.handle, normalizedHandle))
      .limit(1);

    if (existing && existing.passwordHashArgon2 !== null) {
      return {
        action: 'skipped',
        user: {
          id: existing.id,
          handle: existing.handle,
          role: existing.role,
          createdAt: existing.createdAt,
        },
      };
    }
  }

  const [row] = await db
    .insert(schema.users)
    .values({
      handle: normalizedHandle,
      role: 'admin',
      passwordHashArgon2: input.passwordHashArgon2,
    })
    .onConflictDoUpdate({
      target: schema.users.handle,
      set: {
        role: 'admin',
        passwordHashArgon2: input.passwordHashArgon2,
      },
    })
    .returning({
      id: schema.users.id,
      handle: schema.users.handle,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
      inserted: sql<boolean>`(xmax = 0)`,
    });

  if (!row) {
    throw new Error(`Failed to upsert admin password for "${normalizedHandle}"`);
  }

  return {
    action: row.inserted ? 'inserted' : 'updated',
    user: {
      id: row.id,
      handle: row.handle,
      role: row.role,
      createdAt: row.createdAt,
    },
  };
}

export async function countUserWebauthnCredentials(
  db: AppDatabase,
  userId: string,
): Promise<number> {
  if (!UUID_PATTERN.test(userId)) return 0;
  const [row] = await db
    .select({ total: count() })
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.userId, userId));
  return Number(row?.total ?? 0);
}
