import type { CareerDossierUpsertInput } from '@aklapper/core';
import { describe, expect, it, vi } from 'vitest';

import {
  computeDenylistHash,
  isProductionPrivacyEnv,
  parseDenylistFileContent,
  parseDossierPrivacyDenylist,
  PORTAL_HOME_ALLOWED_PUBLIC_EMAILS,
  PrivacySanitizationError,
  redactTextForStorage,
  sanitizeCareerDossierPayload,
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
  scanTextForPrivacyFindings,
} from '../src/privacy.ts';

const CLEAN_DOSSIER: CareerDossierUpsertInput = {
  slug: 'platform-architecture',
  kind: 'architecture',
  title: 'Cloud Platform Modernization',
  domainLabel: 'Financial Services',
  roleTitle: 'Principal Platform Architect',
  timeframe: '2023-2026',
  skills: ['Go', 'TypeScript', 'PostgreSQL 19', 'UTF-8', 'SHA-256', 'RFC-4122', 'K8s'],
  summaryBody:
    'Designed multi-service streaming SSR and Go workloads on GCP using TLS-13 and ISO-8601 audit events.',
  sections: [
    {
      heading: 'Database Reliability',
      body: 'Built reversible expand/contract PostgreSQL migrations with atomic FOR UPDATE locks.',
    },
  ],
  sortOrder: 10,
};

function encodeBase64Denylist(terms: readonly string[]): string {
  return Buffer.from(JSON.stringify(terms), 'utf8').toString('base64');
}

describe('@aklapper/node-runtime/privacy fail-closed sanitization', () => {
  it('parses base64-JSON and plain JSON denylists deterministically and fails closed on malformed values', () => {
    const terms = ['SyntheticConfidentialClientX', 'SecretPartner Corp'];
    const fromBase64 = parseDossierPrivacyDenylist(encodeBase64Denylist(terms));
    const fromPlain = parseDossierPrivacyDenylist(JSON.stringify([...terms].toReversed()));

    expect(fromBase64.configured).toBe(true);
    expect(fromBase64.terms).toEqual(['secretpartner corp', 'syntheticconfidentialclientx']);
    expect(fromBase64.denylistHash).toBe(fromPlain.denylistHash);
    expect(fromBase64.denylistHash).toBe(computeDenylistHash(terms));

    const empty = parseDossierPrivacyDenylist('   ');
    expect(empty.configured).toBe(false);
    expect(empty.terms).toEqual([]);

    expect(() => parseDossierPrivacyDenylist('not-valid-base64-or-json!')).toThrow(
      PrivacySanitizationError,
    );
    expect(() => parseDossierPrivacyDenylist(JSON.stringify({ invalid: true }))).toThrow(
      PrivacySanitizationError,
    );

    const fromLines = parseDenylistFileContent(
      '# comment line\nSyntheticConfidentialClientX\n\nSecretPartner Corp\n',
    );
    expect(fromLines.denylistHash).toBe(fromBase64.denylistHash);
  });

  it('rejects secrets, PII, tracker tokens, private workspace paths, and denylist hits without echoing matched literals', () => {
    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });
    const secretDenylist = encodeBase64Denylist([
      'SyntheticConfidentialClientX',
      'SecretPartner Corp',
    ]);
    const fakeAwsKey = 'AKIA1234567890ABCDEF';
    const fakeEmail = 'person@confidential-client.example';
    const fakeTracker = 'PROJ-9042';
    const fakeWorkspace = '~/projects/private-client-vault/notes.md';

    try {
      const clean = sanitizeCareerDossierPayload(CLEAN_DOSSIER, {
        rawDenylist: secretDenylist,
        requireConfiguredDenylist: true,
      });
      expect(clean.denylistHash).toBe(
        computeDenylistHash(['SyntheticConfidentialClientX', 'SecretPartner Corp']),
      );
      expect(clean.verifiedAt).toBeInstanceOf(Date);

      let caught: unknown = null;
      try {
        sanitizeCareerDossierPayload(
          {
            ...CLEAN_DOSSIER,
            summaryBody: `Worked with SyntheticConfidentialClientX (${fakeAwsKey}) email ${fakeEmail} ticket ${fakeTracker}`,
            sections: [
              {
                heading: 'SecretPartner-Corp Migration',
                body: `Notes stored in ${fakeWorkspace}`,
              },
            ],
          },
          { rawDenylist: secretDenylist, correlationId: 'corr-priv-1' },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(PrivacySanitizationError);
      const privErr = caught as PrivacySanitizationError;
      expect(privErr.status).toBe(422);
      expect(privErr.code).toBe('ERR_CONSTRAINT');
      expect(privErr.findings.map(f => f.category)).toEqual(
        expect.arrayContaining(['secret', 'pii', 'tracker', 'workspace', 'denylist']),
      );

      const serialized = `${privErr.message}\n${JSON.stringify(privErr.findings)}\n${warnLogs.join('\n')}`;
      for (const forbidden of [
        'SyntheticConfidentialClientX',
        'SecretPartner',
        fakeAwsKey,
        fakeEmail,
        fakeTracker,
        fakeWorkspace,
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(warnLogs.join('\n')).toContain('admin.privacy.sanitization_rejected');
      expect(warnLogs.join('\n')).toContain('BOUNDARY_FAULT');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('fails closed on production publish when DOSSIER_PRIVACY_DENYLIST is empty and rejects portal-ask site_content violations', () => {
    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    try {
      expect(isProductionPrivacyEnv({ NODE_ENV: 'production' })).toBe(true);
      expect(isProductionPrivacyEnv({ APP_ENV: 'production' })).toBe(true);
      expect(isProductionPrivacyEnv({ NODE_ENV: 'test' })).toBe(false);

      expect(() =>
        sanitizeCareerDossierPayload(CLEAN_DOSSIER, {
          rawDenylist: '',
          requireConfiguredDenylist: true,
          correlationId: 'corr-prod-empty',
        }),
      ).toThrow(PrivacySanitizationError);
      expect(warnLogs.join('\n')).toContain('admin.privacy.denylist_empty_in_prod');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');

      const encoded = encodeBase64Denylist(['SyntheticConfidentialClientX']);
      expect(() =>
        sanitizePortalAskSiteContent(
          'Clean markdown body',
          {
            description: 'Mentions SyntheticConfidentialClientX in copy',
          },
          encoded,
        ),
      ).toThrow(PrivacySanitizationError);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('redacts sensitive tokens and denylist phrases for storage and caps output at 1000 runes', () => {
    const encoded = encodeBase64Denylist(['SyntheticConfidentialClientX']);
    const redacted = redactTextForStorage(
      'Did Andrew build systems for SyntheticConfidentialClientX with AKIA1234567890ABCDEF and user@example.com under UTF-8?',
      encoded,
    );
    expect(redacted).not.toContain('SyntheticConfidentialClientX');
    expect(redacted).not.toContain('AKIA1234567890ABCDEF');
    expect(redacted).not.toContain('user@example.com');
    expect(redacted).toContain('[REDACTED]');
    expect(redacted).toContain('UTF-8');

    const longText = '🚀'.repeat(1200);
    expect(Array.from(redactTextForStorage(longText, encoded))).toHaveLength(1000);

    const separatorFindings = scanTextForPrivacyFindings(
      'Built for Synthetic_Confidential_Client_X platform',
      'body',
      parseDossierPrivacyDenylist(encoded),
    );
    expect(separatorFindings).toHaveLength(1);
    expect(separatorFindings[0]?.category).toBe('denylist');
  });

  it('catches multiline-wrapped, zero-width, NFD, short obfuscated terms, malformed base64 files, lowercase governance keys, prod portal-ask empty denylist, and stays linear-time against ReDoS', () => {
    const denylistRaw = encodeBase64Denylist(['SecretPartner Corp', 'Acme', 'SecretClient']);
    const unpadded = denylistRaw.replace(/=+$/, '');
    const parsed = parseDossierPrivacyDenylist(unpadded);
    expect(parsed.configured).toBe(true);

    // Malformed single-line base64-JSON file MUST fail closed
    const badBase64Json = Buffer.from('["ClientA", ]', 'utf8').toString('base64');
    expect(() => parseDenylistFileContent(badBase64Json)).toThrow(PrivacySanitizationError);

    // Multi-line wrapped multi-word denylist
    const multilineHits = scanTextForPrivacyFindings(
      'Delivered platform for SecretPartner\nCorp across regions.',
      'summaryBody',
      parsed,
    );
    expect(multilineHits.some(f => f.category === 'denylist' && f.location === 'multiline')).toBe(
      true,
    );

    // Zero-width / soft-hyphen / separator-obfuscated short terms & secrets & NFD combining accents
    for (const payload of [
      'AKIA\u200B1234567890ABCDEF',
      'alice@\u200Bexample.com',
      'Ac\u00ADme platform',
      'A-c-m-e engineering',
      'Secre\u0301tClient rollout',
      `ticket ${'a' + 'kl'}-020 and ${'A' + 'KL'}-1234567`,
    ]) {
      const hits = scanTextForPrivacyFindings(payload, 'body', parsed);
      expect(hits.length, `expected hit for ${JSON.stringify(payload)}`).toBeGreaterThan(0);
    }

    // Obfuscated storage redaction
    const redactedObf = redactTextForStorage(
      'Ask about S-e-c-r-e-t-C-l-i-e-n-t and Sec\u200BretClient',
      denylistRaw,
    );
    expect(redactedObf).not.toContain('S-e-c-r-e-t');
    expect(redactedObf).not.toContain('retClient');

    // Prod portal-ask empty denylist fails closed
    expect(() =>
      sanitizePortalAskSiteContent('Clean', { description: 'Clean' }, '', 'corr-prod-ask', {
        NODE_ENV: 'production',
      }),
    ).toThrow(PrivacySanitizationError);

    // Linear-time ReDoS check on 120 KB dotted email & repeated phone prefixes (< 200ms)
    const start = performance.now();
    scanTextForPrivacyFindings(`${'a.b.c.'.repeat(20_000)}@x`, 'body', parsed);
    scanTextForPrivacyFindings('111-'.repeat(15_000), 'body', parsed);
    const elapsedMs = performance.now() - start;
    expect(elapsedMs).toBeLessThan(200);
  });

  it('sanitizes portal-home with exact andrew@andrew-k.us allow-list while blocking multi-email lines, phones, postal ZIPs, References, denylist terms, and prod empty denylist', () => {
    const encodedDenylist = encodeBase64Denylist(['SyntheticConfidentialClientX']);
    const warnLogs: string[] = [];
    const infoLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      infoLogs.push(String(msg));
    });

    try {
      expect(PORTAL_HOME_ALLOWED_PUBLIC_EMAILS.has('andrew@andrew-k.us')).toBe(true);
      expect(PORTAL_HOME_ALLOWED_PUBLIC_EMAILS.size).toBe(1);

      // Clean portal-home with allow-listed email and lowercase tech numbers ("in 40000", "or 40000", "id 12345", "ms 15000") succeeds
      expect(() =>
        sanitizePortalHomeSiteContent(
          '# Home corpus note',
          {
            portrait: {
              src: '/images/andrew-klapper-portrait.webp',
              alt: 'Greyscale terminal portrait of Andrew Klapper',
              caption: 'andrew@andrew-k.us :: tty1',
              width: 440,
              height: 520,
            },
            resumeSummary: {
              name: 'Andrew Klapper',
              roleLine: 'Senior Full-Stack & Systems Engineer · Marietta, GA',
              publicEmail: 'andrew@andrew-k.us',
              githubLabel: 'github.com/AndrewK4758',
              githubUrl: 'https://github.com/AndrewK4758',
              bio: 'Scaled throughput in 40000 requests or 40000 records with trace id 12345 in ms 15000 while keeping architecture references clean.',
              highlights: ['Build Technology Group — .NET 10 modernization'],
              services: [{ command: 'about', summary: 'Background and career overview.' }],
            },
          },
          encodedDenylist,
          'corr-home-clean',
          { NODE_ENV: 'production' },
        ),
      ).not.toThrow();

      expect(infoLogs.join('\n')).toContain('admin.cms.portal_home_privacy_branch');
      expect(infoLogs.join('\n')).toContain('"branch":"clean_allowed"');

      // Disallowed cases: multi-email line, phone, uppercase state+ZIP, explicit ZIP label, References heading, denylist
      const forbiddenSamples: ReadonlyArray<{
        label: string;
        markdownBody: string;
        metadata: Record<string, unknown>;
        expectedRule: string;
        secretLiteral: string;
      }> = [
        {
          label: 'multi-email line mixing allow-listed and external email',
          markdownBody: '',
          metadata: {
            resumeSummary: { bio: 'Reach andrew@andrew-k.us, reference.contact@example.com' },
          },
          expectedRule: 'pii.email_address',
          secretLiteral: 'reference.contact@example.com',
        },
        {
          label: 'US phone number',
          markdownBody: '',
          metadata: { resumeSummary: { bio: 'Call (555) 010-1234 anytime.' } },
          expectedRule: 'pii.us_phone',
          secretLiteral: '(555) 010-1234',
        },
        {
          label: 'US state and 5-digit ZIP',
          markdownBody: '',
          metadata: { resumeSummary: { roleLine: 'Marietta, GA 99999' } },
          expectedRule: 'pii.us_postal_address_zip',
          secretLiteral: '99999',
        },
        {
          label: 'explicit postal ZIP label',
          markdownBody: '',
          metadata: { resumeSummary: { bio: 'Postal code: 99999-1234' } },
          expectedRule: 'pii.us_postal_address_zip',
          secretLiteral: '99999-1234',
        },
        {
          label: 'References section heading',
          markdownBody: '## References\nAvailable upon request',
          metadata: { resumeSummary: { bio: 'Clean bio' } },
          expectedRule: 'pii.references_section',
          secretLiteral: 'Available upon request',
        },
        {
          label: 'References inline label',
          markdownBody: '',
          metadata: { resumeSummary: { highlights: ['References: Jane Synthetic'] } },
          expectedRule: 'pii.references_section',
          secretLiteral: 'Jane Synthetic',
        },
        {
          label: 'configured denylist term',
          markdownBody: '',
          metadata: { resumeSummary: { bio: 'Built tooling for SyntheticConfidentialClientX.' } },
          expectedRule: 'denylist.term_1',
          secretLiteral: 'SyntheticConfidentialClientX',
        },
      ];

      for (const sample of forbiddenSamples) {
        warnLogs.length = 0;
        infoLogs.length = 0;
        let caught: unknown = null;
        try {
          sanitizePortalHomeSiteContent(
            sample.markdownBody,
            sample.metadata,
            encodedDenylist,
            'corr-home-reject',
            { NODE_ENV: 'production' },
          );
        } catch (error) {
          caught = error;
        }
        expect(caught, `expected rejection for ${sample.label}`).toBeInstanceOf(
          PrivacySanitizationError,
        );
        const privErr = caught as PrivacySanitizationError;
        expect(privErr.status).toBe(422);
        expect(privErr.code).toBe('ERR_CONSTRAINT');
        expect(privErr.findings.some(f => f.ruleId === sample.expectedRule)).toBe(true);

        const logBlob = `${JSON.stringify(privErr.findings)}\n${warnLogs.join('\n')}`;
        expect(logBlob).toContain('admin.privacy.sanitization_rejected');
        expect(logBlob).toContain('site_content.portal-home');
        expect(logBlob).not.toContain(sample.secretLiteral);
        expect(infoLogs.join('\n')).toContain('"branch":"rejected_pii_or_denylist"');
      }

      // Empty denylist fails closed in production with UNSOUND_CONDITION seam
      warnLogs.length = 0;
      infoLogs.length = 0;
      expect(() =>
        sanitizePortalHomeSiteContent('Clean', { heading: 'Clean' }, '', 'corr-home-prod-empty', {
          NODE_ENV: 'production',
        }),
      ).toThrow(PrivacySanitizationError);
      expect(warnLogs.join('\n')).toContain('admin.privacy.denylist_empty_in_prod');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');
      expect(warnLogs.join('\n')).toContain('site_content.portal-home');
      expect(infoLogs.join('\n')).toContain('"branch":"rejected_unconfigured_prod_denylist"');
    } finally {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });
});
