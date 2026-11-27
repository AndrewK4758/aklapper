import { expect } from 'vitest';

export interface PgErrorShape {
  code?: string;
  message?: string;
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
