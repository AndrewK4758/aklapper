import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { isProductionEnv } from '@aklapper/node-runtime/http';
import type { Pool, PoolClient } from 'pg';

import { createDbPool } from './client.ts';

export const PORTAL_APP_ROLE_NAME = 'portal_app';
export const DEFAULT_LOCAL_PORTAL_APP_PASSWORD = 'portal_app_local_dev_password';

export interface ProvisionPortalRoleResult {
  role: typeof PORTAL_APP_ROLE_NAME;
  action: 'created' | 'updated';
}

export interface ProvisionPortalRoleOptions {
  password?: string;
  env?: Readonly<Record<string, string | undefined>>;
}

/**
 * Resolves the password used to provision the out-of-band PostgreSQL `portal_app` LOGIN role. Fails
 * closed in production unless `PORTAL_DATABASE_URL` or `PORTAL_APP_PASSWORD` is supplied.
 */
export function resolvePortalAppPassword(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const portalUrl = env['PORTAL_DATABASE_URL']?.trim();
  if (portalUrl) {
    let parsed: URL;
    try {
      parsed = new URL(portalUrl);
    } catch {
      throw new Error('PORTAL_DATABASE_URL must be a valid PostgreSQL connection URL');
    }
    const username = decodeURIComponent(parsed.username);
    if (username !== PORTAL_APP_ROLE_NAME) {
      throw new Error(
        `PORTAL_DATABASE_URL must authenticate as role "${PORTAL_APP_ROLE_NAME}" (got "${username || '<empty>'}")`,
      );
    }
    const password = decodeURIComponent(parsed.password);
    if (!password) {
      throw new Error(
        `PORTAL_DATABASE_URL must include a non-empty password for role "${PORTAL_APP_ROLE_NAME}"`,
      );
    }
    return password;
  }

  const explicitPassword = env['PORTAL_APP_PASSWORD'];
  if (explicitPassword && explicitPassword.trim().length > 0) {
    return explicitPassword;
  }

  if (isProductionEnv(env)) {
    throw new Error(
      `PORTAL_DATABASE_URL (with password) or PORTAL_APP_PASSWORD is required when provisioning role "${PORTAL_APP_ROLE_NAME}" in production`,
    );
  }

  return DEFAULT_LOCAL_PORTAL_APP_PASSWORD;
}

const PROVISION_ROLE_SQL = `
DO $$
DECLARE
  v_password text := current_setting('aklapper.portal_app_password', true);
  v_can_create_role boolean;
BEGIN
  IF v_password IS NULL OR length(v_password) = 0 THEN
    RAISE EXCEPTION 'Password for role "portal_app" must be non-empty';
  END IF;

  SELECT (rolsuper OR rolcreaterole)
  INTO v_can_create_role
  FROM pg_roles
  WHERE rolname = current_user;

  IF NOT COALESCE(v_can_create_role, false) THEN
    RAISE EXCEPTION
      'Current PostgreSQL role "%" lacks CREATEROLE/SUPERUSER required to provision role "portal_app". Run db:provision-portal-role using a superuser or CREATEROLE connection.',
      current_user;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
      'portal_app',
      v_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
      'portal_app',
      v_password
    );
  END IF;
END
$$;
`;

/**
 * Idempotently creates or updates the least-privilege PostgreSQL `portal_app` LOGIN role using a
 * transaction-local GUC parameter so credentials never appear in SQL statements or logs.
 */
export async function provisionPortalRole(
  pool: Pick<Pool, 'connect'>,
  options: ProvisionPortalRoleOptions = {},
): Promise<ProvisionPortalRoleResult> {
  const password = options.password ?? resolvePortalAppPassword(options.env);
  if (!password) {
    throw new Error(`Password for role "${PORTAL_APP_ROLE_NAME}" must be non-empty`);
  }

  const client: PoolClient = await pool.connect();
  let releaseWithError: Error | boolean | undefined;
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    const existing = await client.query<{ existed: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS existed',
      [PORTAL_APP_ROLE_NAME],
    );
    const existed = existing.rows[0]?.existed === true;

    await client.query("SELECT set_config('aklapper.portal_app_password', $1, true)", [password]);
    await client.query(PROVISION_ROLE_SQL);
    await client.query("SELECT set_config('aklapper.portal_app_password', '', true)");
    await client.query('COMMIT');
    inTransaction = false;

    return {
      role: PORTAL_APP_ROLE_NAME,
      action: existed ? 'updated' : 'created',
    };
  } catch (error) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        releaseWithError = rollbackError instanceof Error ? rollbackError : true;
      }
    }
    throw error;
  } finally {
    client.release(releaseWithError);
  }
}

export async function runProvisionPortalRoleCli(
  options: {
    pool?: Pool;
    password?: string;
    env?: Readonly<Record<string, string | undefined>>;
  } = {},
): Promise<ProvisionPortalRoleResult> {
  const env = options.env ?? process.env;
  const ownsPool = !options.pool;
  const pool = options.pool ?? createDbPool(env['DATABASE_URL']);

  try {
    const result = await provisionPortalRole(pool, {
      ...(options.password !== undefined ? { password: options.password } : {}),
      env,
    });
    console.info(
      JSON.stringify({
        event: 'db.provision_portal_role.execution',
        role: result.role,
        action: result.action,
        status: 'applied',
      }),
    );
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'db.provision_portal_role.execution',
        role: PORTAL_APP_ROLE_NAME,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'role_provisioning_failed',
      }),
    );
    throw error;
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  await runProvisionPortalRoleCli();
}
