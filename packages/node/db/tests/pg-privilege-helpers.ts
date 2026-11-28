import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { Pool } from 'pg';
import { expect } from 'vitest';

export interface PgErrorShape {
  code?: string;
  message?: string;
}

export interface RoleCatalogFlags {
  rolcanlogin: boolean;
  rolsuper: boolean;
  rolcreatedb: boolean;
  rolcreaterole: boolean;
  rolinherit: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
}

interface DrizzleJournalFile {
  version: string;
  dialect: string;
  entries: Array<{
    idx: number;
    version: string;
    when: number;
    tag: string;
    breakpoints: boolean;
  }>;
}

export async function expectSqlState(
  promise: Promise<unknown>,
  expectedCode: string,
): Promise<void> {
  let caught: PgErrorShape | undefined;
  try {
    await promise;
  } catch (error) {
    caught = error as PgErrorShape;
  }
  expect(caught, `Expected PostgreSQL SQLSTATE ${expectedCode} but query succeeded`).toBeDefined();
  expect(caught?.code).toBe(expectedCode);
}

export function withDatabaseName(connectionUrl: string, databaseName: string): string {
  const parsed = new URL(connectionUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}

export function withCredentials(connectionUrl: string, username: string, password: string): string {
  const parsed = new URL(connectionUrl);
  parsed.username = username;
  parsed.password = password;
  return parsed.toString();
}

export function ignoreAdminShutdownPoolError(pool: Pool): void {
  pool.on('error', (err: unknown) => {
    const code = typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
    if (code !== '57P01') {
      throw err;
    }
  });
}

export function createDrizzleSubsetDir(
  drizzleDir: string,
  maxIdx: number,
  tmpPrefix: string,
): string {
  const fullJournal = JSON.parse(
    readFileSync(resolve(drizzleDir, 'meta/_journal.json'), 'utf8'),
  ) as DrizzleJournalFile;
  const subsetDir = mkdtempSync(resolve(tmpdir(), tmpPrefix));
  const subsetMetaDir = resolve(subsetDir, 'meta');
  mkdirSync(subsetMetaDir, { recursive: true });
  const entries = fullJournal.entries.filter(entry => entry.idx <= maxIdx);
  for (const entry of entries) {
    copyFileSync(resolve(drizzleDir, `${entry.tag}.sql`), resolve(subsetDir, `${entry.tag}.sql`));
  }
  writeFileSync(
    resolve(subsetMetaDir, '_journal.json'),
    JSON.stringify({ ...fullJournal, entries }, null, 2),
    'utf8',
  );
  return subsetDir;
}

export async function readRateLimitBucketsRlsState(pool: Pool): Promise<{
  rlsEnabled: boolean;
  rlsForced: boolean;
  policies: string[];
}> {
  const tableRes = await pool.query<{
    relrowsecurity: boolean;
    relforcerowsecurity: boolean;
  }>(
    `SELECT relrowsecurity, relforcerowsecurity
     FROM pg_class
     WHERE oid = '"public"."rate_limit_buckets"'::regclass`,
  );
  const policyRes = await pool.query<{ policyname: string }>(
    `SELECT policyname
     FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'rate_limit_buckets'
     ORDER BY policyname`,
  );
  return {
    rlsEnabled: tableRes.rows[0]?.relrowsecurity ?? false,
    rlsForced: tableRes.rows[0]?.relforcerowsecurity ?? false,
    policies: policyRes.rows.map(row => row.policyname),
  };
}

export async function readRoleCatalogFlags(
  pool: Pick<Pool, 'query'>,
  roleName: string,
): Promise<RoleCatalogFlags[]> {
  const res = await pool.query<RoleCatalogFlags>(
    `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls
     FROM pg_roles
     WHERE rolname = $1`,
    [roleName],
  );
  return res.rows;
}

export async function verifyDrizzleSchemaAbsenceGuard(
  pool: Pool,
  upSql: string,
  downSql: string,
): Promise<void> {
  const guardClient = await pool.connect();
  try {
    await guardClient.query('BEGIN');
    await guardClient.query('DROP SCHEMA drizzle CASCADE');
    await guardClient.query(upSql);
    await guardClient.query(downSql);
    await guardClient.query(upSql);
    await guardClient.query('ROLLBACK');
  } finally {
    guardClient.release();
  }
}

export async function verifyMigrationRolePreconditionBlock(
  pool: Pool,
  upSql: string,
  roleName: string,
  expectedFlags: RoleCatalogFlags,
): Promise<void> {
  const chunks = upSql.split('--> statement-breakpoint');
  const preconditionBlock = chunks.find(chunk => chunk.includes(`CREATE ROLE "${roleName}"`)) ?? '';
  expect(preconditionBlock, `Missing CREATE ROLE "${roleName}" block in migration SQL`).not.toBe(
    '',
  );

  const stamp = Date.now();
  const absentRole = `${roleName}_absent_${stamp}`;
  const noCreateRoleUser = `${roleName}_nocr_${stamp}`;
  const absentRoleSql = preconditionBlock.replaceAll(roleName, absentRole);

  const superClient = await pool.connect();
  try {
    await superClient.query('BEGIN');
    await superClient.query(absentRoleSql);
    const createdFlags = await readRoleCatalogFlags(superClient, absentRole);
    expect(createdFlags).toEqual([expectedFlags]);
    await superClient.query('ROLLBACK');
  } finally {
    superClient.release();
  }

  await pool.query(
    `CREATE ROLE "${noCreateRoleUser}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
  );
  const restrictedClient = await pool.connect();
  try {
    await restrictedClient.query('BEGIN');
    await restrictedClient.query(`SET LOCAL ROLE "${noCreateRoleUser}"`);
    await expect(restrictedClient.query(absentRoleSql)).rejects.toThrow(
      /lacks CREATEROLE\/SUPERUSER.*out-of-band/i,
    );
    await restrictedClient.query('ROLLBACK');
  } finally {
    restrictedClient.release();
    await pool.query(`DROP ROLE IF EXISTS "${noCreateRoleUser}"`);
  }
}

export async function assertTablesReadOnly(
  pool: Pool,
  tables: ReadonlyArray<{ table: string; column: string }>,
): Promise<void> {
  for (const { table, column } of tables) {
    await expect(
      pool.query(`SELECT "${column}" FROM "public"."${table}" LIMIT 1`),
    ).resolves.toBeDefined();
    await expectSqlState(pool.query(`INSERT INTO "public"."${table}" DEFAULT VALUES`), '42501');
    await expectSqlState(
      pool.query(`UPDATE "public"."${table}" SET "${column}" = "${column}" WHERE false`),
      '42501',
    );
    await expectSqlState(pool.query(`DELETE FROM "public"."${table}" WHERE false`), '42501');
  }
}

export async function assertTablesFullyDenied(
  pool: Pool,
  tables: ReadonlyArray<{ schema: string; table: string; column: string }>,
): Promise<void> {
  for (const { schema, table, column } of tables) {
    const qualified = `"${schema}"."${table}"`;
    await expectSqlState(pool.query(`SELECT "${column}" FROM ${qualified} LIMIT 1`), '42501');
    await expectSqlState(pool.query(`INSERT INTO ${qualified} DEFAULT VALUES`), '42501');
    await expectSqlState(
      pool.query(`UPDATE ${qualified} SET "${column}" = "${column}" WHERE false`),
      '42501',
    );
    await expectSqlState(pool.query(`DELETE FROM ${qualified} WHERE false`), '42501');
  }
}

export async function assertPublicDdlDenied(
  pool: Pool,
  probeTableName: string,
  alterTargetTable: string,
  dropTargetTable: string,
): Promise<void> {
  await expectSqlState(pool.query(`CREATE TABLE "public"."${probeTableName}" (id int)`), '42501');
  await expectSqlState(
    pool.query(`ALTER TABLE "public"."${alterTargetTable}" ADD COLUMN ddl_probe text`),
    '42501',
  );
  await expectSqlState(pool.query(`DROP TABLE "public"."${dropTargetTable}"`), '42501');
}
