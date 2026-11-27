import { isProductionEnv } from '@aklapper/node-runtime/http';
import type { Pool, PoolClient } from 'pg';

import { createDbPool } from './client.ts';

const SAFE_PG_IDENTIFIER_RE = /^[a-z][a-z0-9_]*$/;
const SAFE_GUC_SETTING_RE = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const SAFE_SCRIPT_NAME_RE = /^[a-z0-9:-]+$/;

export interface AppRoleProvisionConfig<TRole extends string = string> {
  readonly roleName: TRole;
  readonly urlEnvVar: string;
  readonly passwordEnvVar: string;
  readonly defaultLocalPassword: string;
  readonly gucSettingName: string;
  readonly cliScriptName: string;
  readonly logEventName: string;
  readonly noInherit?: boolean;
}

export interface ProvisionAppRoleResult<TRole extends string = string> {
  role: TRole;
  action: 'created' | 'updated';
}

export interface ProvisionAppRoleOptions {
  password?: string;
  env?: Readonly<Record<string, string | undefined>>;
}

export interface RunProvisionAppRoleCliOptions extends ProvisionAppRoleOptions {
  pool?: Pool;
}

function assertValidRoleConfig<TRole extends string>(config: AppRoleProvisionConfig<TRole>): void {
  if (!SAFE_PG_IDENTIFIER_RE.test(config.roleName)) {
    throw new Error(`Invalid PostgreSQL role identifier "${config.roleName}"`);
  }
  if (!SAFE_GUC_SETTING_RE.test(config.gucSettingName)) {
    throw new Error(`Invalid PostgreSQL GUC setting name "${config.gucSettingName}"`);
  }
  if (!SAFE_SCRIPT_NAME_RE.test(config.cliScriptName)) {
    throw new Error(`Invalid CLI script name "${config.cliScriptName}"`);
  }
}

function buildProvisionRoleSql<TRole extends string>(
  config: AppRoleProvisionConfig<TRole>,
): string {
  assertValidRoleConfig(config);
  const roleAttributes = config.noInherit
    ? 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS'
    : 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS';

  return `
DO $$
DECLARE
  v_password text := current_setting('${config.gucSettingName}', true);
  v_can_create_role boolean;
BEGIN
  IF v_password IS NULL OR length(v_password) = 0 THEN
    RAISE EXCEPTION 'Password for role "${config.roleName}" must be non-empty';
  END IF;

  SELECT (rolsuper OR rolcreaterole)
  INTO v_can_create_role
  FROM pg_roles
  WHERE rolname = current_user;

  IF NOT COALESCE(v_can_create_role, false) THEN
    RAISE EXCEPTION
      'Current PostgreSQL role "%" lacks CREATEROLE/SUPERUSER required to provision role "${config.roleName}". Run ${config.cliScriptName} using a superuser or CREATEROLE connection.',
      current_user;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${config.roleName}') THEN
    EXECUTE format(
      'ALTER ROLE %I WITH ${roleAttributes} PASSWORD %L',
      '${config.roleName}',
      v_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE %I WITH ${roleAttributes} PASSWORD %L',
      '${config.roleName}',
      v_password
    );
  END IF;
END
$$;
`;
}

/**
 * Resolves the password used to provision an out-of-band least-privilege PostgreSQL LOGIN role.
 * Fails closed in production unless the role's connection URL or explicit password env var is set.
 */
export function resolveAppRolePassword<TRole extends string>(
  config: AppRoleProvisionConfig<TRole>,
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const roleUrl = env[config.urlEnvVar]?.trim();
  if (roleUrl) {
    let parsed: URL;
    try {
      parsed = new URL(roleUrl);
    } catch {
      throw new Error(`${config.urlEnvVar} must be a valid PostgreSQL connection URL`);
    }
    const username = decodeURIComponent(parsed.username);
    if (username !== config.roleName) {
      throw new Error(
        `${config.urlEnvVar} must authenticate as role "${config.roleName}" (got "${username || '<empty>'}")`,
      );
    }
    const password = decodeURIComponent(parsed.password);
    if (!password) {
      throw new Error(
        `${config.urlEnvVar} must include a non-empty password for role "${config.roleName}"`,
      );
    }
    return password;
  }

  const explicitPassword = env[config.passwordEnvVar];
  if (explicitPassword && explicitPassword.trim().length > 0) {
    return explicitPassword;
  }

  if (isProductionEnv(env)) {
    throw new Error(
      `${config.urlEnvVar} (with password) or ${config.passwordEnvVar} is required when provisioning role "${config.roleName}" in production`,
    );
  }

  return config.defaultLocalPassword;
}

/**
 * Idempotently creates or updates a least-privilege PostgreSQL LOGIN role using a transaction-local
 * GUC parameter so credentials never appear in SQL statements or logs.
 */
export async function provisionAppRole<TRole extends string>(
  config: AppRoleProvisionConfig<TRole>,
  pool: Pick<Pool, 'connect'>,
  options: ProvisionAppRoleOptions = {},
): Promise<ProvisionAppRoleResult<TRole>> {
  const password = options.password ?? resolveAppRolePassword(config, options.env);
  if (!password) {
    throw new Error(`Password for role "${config.roleName}" must be non-empty`);
  }

  const provisionSql = buildProvisionRoleSql(config);
  const client: PoolClient = await pool.connect();
  let releaseWithError: Error | boolean | undefined;
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    const existing = await client.query<{ existed: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS existed',
      [config.roleName],
    );
    const existed = existing.rows[0]?.existed === true;

    await client.query(`SELECT set_config('${config.gucSettingName}', $1, true)`, [password]);
    await client.query(provisionSql);
    await client.query(`SELECT set_config('${config.gucSettingName}', '', true)`);
    await client.query('COMMIT');
    inTransaction = false;

    return {
      role: config.roleName,
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

export async function runProvisionAppRoleCli<TRole extends string>(
  config: AppRoleProvisionConfig<TRole>,
  options: RunProvisionAppRoleCliOptions = {},
): Promise<ProvisionAppRoleResult<TRole>> {
  const env = options.env ?? process.env;
  const ownsPool = !options.pool;
  const pool = options.pool ?? createDbPool(env['DATABASE_URL']);

  try {
    const result = await provisionAppRole(config, pool, {
      ...(options.password !== undefined ? { password: options.password } : {}),
      env,
    });
    console.info(
      JSON.stringify({
        event: config.logEventName,
        role: result.role,
        action: result.action,
        status: 'applied',
      }),
    );
    return result;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: config.logEventName,
        role: config.roleName,
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
