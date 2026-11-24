import { describe, expect, it } from 'vitest';

import { shouldReuseExternalDatabase } from '../src/index.ts';
import { parseEphemeralPgCliArgs } from '../src/run-with-ephemeral-pg.ts';

describe('@aklapper/tooling ephemeral PG19 harness helpers', () => {
  it('determines when to reuse an active or CI-managed database', () => {
    expect(shouldReuseExternalDatabase({})).toBe(false);
    expect(
      shouldReuseExternalDatabase({
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(false);
    expect(
      shouldReuseExternalDatabase({
        AKLAPPER_EPHEMERAL_PG_ACTIVE: '1',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:55123/aklapper_test',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        AKLAPPER_EXTERNAL_TEST_DB: '1',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        CI: 'true',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        CI: 'true',
      }),
    ).toBe(false);
  });

  it('parses CLI wrapper arguments and rejects malformed invocations', () => {
    expect(
      parseEphemeralPgCliArgs(['--label', 'e2e', '--', 'pnpm', 'exec', 'playwright', 'test']),
    ).toEqual({
      label: 'e2e',
      command: 'pnpm',
      args: ['exec', 'playwright', 'test'],
    });

    expect(parseEphemeralPgCliArgs(['--label=test', '--', 'vitest', 'run'])).toEqual({
      label: 'test',
      command: 'vitest',
      args: ['run'],
    });

    expect(parseEphemeralPgCliArgs(['--', 'echo', 'ok'])).toEqual({
      label: 'test',
      command: 'echo',
      args: ['ok'],
    });

    expect(() => parseEphemeralPgCliArgs(['--label', 'test'])).toThrow(/Usage:/);
    expect(() => parseEphemeralPgCliArgs(['--unknown', '--', 'echo'])).toThrow(/Unknown option/);
  });
});
