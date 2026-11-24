import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findWorkspaceRoot, loadWorkspaceEnv, resolveEnvFilePaths } from '../src/env.ts';

describe('@aklapper/shared-utils/env', () => {
  it('resolves layered env file paths in highest-to-lowest precedence order', () => {
    expect(resolveEnvFilePaths('/repo', 'e2e')).toEqual([
      '/repo/.env.e2e.local',
      '/repo/.env.e2e',
      '/repo/.env.local',
      '/repo/.env',
    ]);
    expect(resolveEnvFilePaths('/repo')).toEqual(['/repo/.env.local', '/repo/.env']);
  });

  it('discovers workspace root upward and applies layered overrides without clobbering shell env', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'aklapper-env-test-'));
    const nestedDir = join(tempRoot, 'packages', 'node', 'db');
    const prevShell = process.env['TEST_ENV_SHELL'];
    const prevMode = process.env['TEST_ENV_MODE'];
    const prevBase = process.env['TEST_ENV_BASE'];

    try {
      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(join(tempRoot, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
      writeFileSync(
        join(tempRoot, '.env'),
        'TEST_ENV_SHELL=base\nTEST_ENV_MODE=base\nTEST_ENV_BASE=base\n',
      );
      writeFileSync(join(tempRoot, '.env.e2e'), 'TEST_ENV_SHELL=e2e\nTEST_ENV_MODE=e2e\n');

      process.env['TEST_ENV_SHELL'] = 'shell';
      delete process.env['TEST_ENV_MODE'];
      delete process.env['TEST_ENV_BASE'];

      expect(findWorkspaceRoot(nestedDir)).toBe(tempRoot);
      const loaded = loadWorkspaceEnv({ startDir: nestedDir, mode: 'e2e' });

      expect(loaded).toEqual([join(tempRoot, '.env.e2e'), join(tempRoot, '.env')]);
      expect(process.env['TEST_ENV_SHELL']).toBe('shell');
      expect(process.env['TEST_ENV_MODE']).toBe('e2e');
      expect(process.env['TEST_ENV_BASE']).toBe('base');
    } finally {
      if (prevShell === undefined) delete process.env['TEST_ENV_SHELL'];
      else process.env['TEST_ENV_SHELL'] = prevShell;
      if (prevMode === undefined) delete process.env['TEST_ENV_MODE'];
      else process.env['TEST_ENV_MODE'] = prevMode;
      if (prevBase === undefined) delete process.env['TEST_ENV_BASE'];
      else process.env['TEST_ENV_BASE'] = prevBase;
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
