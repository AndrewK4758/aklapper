import { describe, expect, it, vi } from 'vitest';

import {
  PrivacySanitizationError,
  runGoPrivacyCheck,
  sanitizeCareerDossierViaGoCli,
  sanitizeSiteContentViaGoCli,
} from '../src/cli/go-privacy-check.ts';

describe('@aklapper/node-runtime/go-privacy-check CLI bridge', () => {
  it('validates clean site content and dossiers and rejects prod empty denylist fail-closed', () => {
    const denylist = JSON.stringify(['SyntheticConfidentialClientX']);
    expect(() =>
      sanitizeSiteContentViaGoCli(
        'portal-home',
        '# Clean home note',
        { resumeSummary: { publicEmail: 'andrew@andrew-k.us' } },
        { rawDenylist: denylist, requireConfiguredDenylist: true },
      ),
    ).not.toThrow();

    expect(() =>
      sanitizeSiteContentViaGoCli(
        'portal-home',
        '# Clean home note',
        { heading: 'Clean' },
        { rawDenylist: '', requireConfiguredDenylist: true },
      ),
    ).toThrow(PrivacySanitizationError);

    const dossierRes = sanitizeCareerDossierViaGoCli(
      {
        slug: 'clean-architecture',
        kind: 'architecture',
        title: 'Platform Architecture',
        domainLabel: 'Infrastructure',
        roleTitle: 'Principal Engineer',
        timeframe: '2024-2026',
        skills: ['Go', 'ARGON-2', 'PYTHON-3', 'USB-4'],
        summaryBody: 'Built streaming SSR and Go microservices.',
        sections: [{ heading: 'Overview', body: 'Linear privacy scanning in Go.' }],
        sortOrder: 0,
      },
      { rawDenylist: denylist, requireConfiguredDenylist: true },
    );
    expect(dossierRes.denylistHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('emits BOUNDARY_FAULT db_migrate.privacy_cli.failed when PRIVACY_CHECK_BIN is missing or exits non-zero', () => {
    const errLogs: string[] = [];
    const errSpy = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      errLogs.push(String(msg));
    });
    try {
      expect(() =>
        runGoPrivacyCheck(
          { mode: 'text', fields: [{ field: 'body', text: 'hello' }] },
          { env: { PRIVACY_CHECK_BIN: '/nonexistent/privacy-check-bin' } },
        ),
      ).toThrow(/privacy-check CLI failed/);
      const blob = errLogs.join('\n');
      expect(blob).toContain('BOUNDARY_FAULT');
      expect(blob).toContain('db_migrate.privacy_cli.failed');
    } finally {
      errSpy.mockRestore();
    }
  });
});
