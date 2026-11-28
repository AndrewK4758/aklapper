import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  checkDossierFiles,
  formatDossierCheckOutput,
  loadDossierCheckDenylist,
  parseDossierCheckArgs,
} from '../src/dossier-check.ts';

describe('@aklapper/tooling dossier-check CLI', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('parses CLI flags and validates clean vs blocked markdown drafts without echoing blocked literals', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dossier-check-'));
    tempDirs.push(dir);

    const denylistFile = join(dir, 'denylist.txt');
    const cleanFile = join(dir, 'clean.md');
    const dirtyFile = join(dir, 'dirty.md');

    writeFileSync(denylistFile, '# synthetic denylist\nSyntheticConfidentialClientX\n', 'utf8');
    writeFileSync(
      cleanFile,
      '# Architecture Overview\n\nBuilt resilient streaming SSR and PostgreSQL 19 services.\n',
      'utf8',
    );
    writeFileSync(
      dirtyFile,
      '# Draft Notes\n\nEngaged SyntheticConfidentialClientX and read ~/projects/private-notes/spec.md\n',
      'utf8',
    );

    const parsed = parseDossierCheckArgs(['--', '--denylist', denylistFile, cleanFile, '--json']);
    expect(parsed).toEqual({
      denylistPath: denylistFile,
      files: [cleanFile],
      jsonOutput: true,
    });

    const denylist = loadDossierCheckDenylist(denylistFile, undefined, dir);
    expect(denylist.configured).toBe(true);

    const cleanResult = checkDossierFiles([cleanFile], denylist, dir);
    expect(cleanResult.passed).toBe(true);
    expect(formatDossierCheckOutput(cleanResult, false)).toContain('PASS');

    const dirtyResult = checkDossierFiles([dirtyFile], denylist, dir);
    expect(dirtyResult.passed).toBe(false);
    expect(dirtyResult.reports[0]?.findings.map(f => f.category)).toEqual(
      expect.arrayContaining(['denylist', 'workspace']),
    );

    const rendered = formatDossierCheckOutput(dirtyResult, false);
    expect(rendered).toContain('FAIL');
    expect(rendered).toContain('location=line:3');
    expect(rendered).not.toContain('SyntheticConfidentialClientX');
    expect(rendered).not.toContain('private-notes');

    expect(() => parseDossierCheckArgs([])).toThrow(/at least one markdown file/i);
    expect(() => parseDossierCheckArgs(['--unknown', cleanFile])).toThrow(/Unknown option/);

    // Compact E.164 phone and 70-char local-part email fail closed via Go privacy-check CLI without leaking literals.
    const edgeFile = join(dir, 'edge.md');
    const longEmail = `${'a'.repeat(70)}@example.com`;
    writeFileSync(
      edgeFile,
      `# Edge Notes\n\nReach +15550101234 or ${longEmail} with ARGON-2 and USB-4.\n`,
      'utf8',
    );
    const edgeResult = checkDossierFiles([edgeFile], denylist, dir);
    expect(edgeResult.passed).toBe(false);
    expect(edgeResult.reports[0]?.findings.map(f => f.ruleId)).toEqual(
      expect.arrayContaining(['pii.us_phone', 'pii.email_address']),
    );
    const edgeRendered = formatDossierCheckOutput(edgeResult, false);
    expect(edgeRendered).not.toContain('5550101234');
    expect(edgeRendered).not.toContain('@example.com');
  });
});
