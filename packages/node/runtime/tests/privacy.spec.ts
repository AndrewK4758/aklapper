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
  sanitizePortalAboutSiteContent,
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

      // Markdown bold/heading/list-formatted References variants are also blocked
      for (const formattedRef of [
        '**References**',
        '### **References**',
        '- References: available on request',
      ]) {
        expect(() =>
          sanitizePortalHomeSiteContent(
            formattedRef,
            { heading: 'Clean' },
            encodedDenylist,
            'corr-home-ref-md',
            { NODE_ENV: 'production' },
          ),
        ).toThrow(PrivacySanitizationError);
      }

      // Linear-time ReDoS check on 60 KB whitespace after zip/postal keywords (< 250ms)
      const redosStart = performance.now();
      sanitizePortalHomeSiteContent(
        `zip${' '.repeat(60_000)}x\npostal${' '.repeat(60_000)}x`,
        { heading: 'Clean' },
        encodedDenylist,
        'corr-home-redos',
        { NODE_ENV: 'production' },
      );
      expect(performance.now() - redosStart).toBeLessThan(250);
    } finally {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    }
  });

  it('blocks US postal ZIP patterns via pii.us_postal_zip without false positives on technical 5-digit numbers or lowercase prepositions', () => {
    const emptyDenylist = parseDossierPrivacyDenylist('');

    for (const blockedZip of [
      'Marietta, GA 30062',
      'GA 30062',
      'NY, 10001-1234',
      '90210-1234',
      'ZIP 30062',
      'zip code: 30062',
      'Zip#30062-4321',
    ]) {
      const findings = scanTextForPrivacyFindings(blockedZip, 'location', emptyDenylist);
      expect(
        findings.some(f => f.ruleId === 'pii.us_postal_zip' && f.category === 'pii'),
        `expected pii.us_postal_zip for ${JSON.stringify(blockedZip)}`,
      ).toBe(true);
    }

    for (const safeTechnical of [
      'Listens on localhost:11434 and processes 40000 requests',
      'Trained in 40000 steps or 40000 tokens',
      'Row id 12345 completed in ms 15000',
      'Marietta, GA — Senior Full-Stack & Systems Engineer',
      'C# (.NET 10), Go (1.26+), PostgreSQL 19, ISO-8601',
    ]) {
      const findings = scanTextForPrivacyFindings(safeTechnical, 'description', emptyDenylist);
      expect(findings, `expected zero findings for ${JSON.stringify(safeTechnical)}`).toEqual([]);
    }
  });

  it('enforces strict fail-closed privacy on portal-about writes without email allowlist bypasses and logs structured seams', () => {
    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });
    const encodedDenylist = encodeBase64Denylist(['SyntheticConfidentialClientX']);

    try {
      // Clean technical portal-about content passes
      expect(() =>
        sanitizePortalAboutSiteContent(
          'Public resume framing for Marietta, GA covering localhost:11434 and 40000 items.',
          {
            identity: {
              fullName: 'Andrew Klapper',
              location: 'Marietta, GA',
            },
            servicesIntro: 'Built in 40000 iterations for Build Technology Group and Gitasy.',
          },
          encodedDenylist,
          'corr-about-clean',
          { NODE_ENV: 'production' },
        ),
      ).not.toThrow();

      // Rejects email, phone, US ZIP, ZIP+4, tracker key, and denylist terms without echoing raw PII
      const syntheticEmail = 'reference.contact@example.com';
      const syntheticPhone = '(555) 010-1234';
      const syntheticZip = 'Marietta, GA 30062';
      const syntheticZipPlus4 = '90210-1234';
      const syntheticTracker = `${'A' + 'KL'}-999`;

      let caught: unknown = null;
      try {
        sanitizePortalAboutSiteContent(
          `Contact ${syntheticEmail} at ${syntheticPhone} (${syntheticZip}, ${syntheticZipPlus4}) ref ${syntheticTracker}`,
          {
            description: 'Mentions SyntheticConfidentialClientX',
          },
          encodedDenylist,
          'corr-about-reject',
          { NODE_ENV: 'production' },
        );
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(PrivacySanitizationError);
      const err = caught as PrivacySanitizationError;
      expect(err.status).toBe(422);
      expect(err.code).toBe('ERR_CONSTRAINT');
      expect(err.findings.map(f => f.ruleId)).toEqual(
        expect.arrayContaining([
          'pii.email_address',
          'pii.us_phone',
          'pii.us_postal_zip',
          'tracker.issue_key',
          'denylist.term_1',
        ]),
      );

      const serialized = `${JSON.stringify(err.findings)}\n${warnLogs.join('\n')}`;
      for (const forbidden of [
        syntheticEmail,
        syntheticPhone,
        '30062',
        syntheticZipPlus4,
        syntheticTracker,
        'SyntheticConfidentialClientX',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(warnLogs.join('\n')).toContain('admin.privacy.sanitization_rejected');
      expect(warnLogs.join('\n')).toContain('site_content.portal-about');
      expect(warnLogs.join('\n')).toContain('BOUNDARY_FAULT');

      // Empty denylist in production fails closed with UNSOUND_CONDITION
      warnLogs.length = 0;
      let prodEmptyErr: unknown = null;
      try {
        sanitizePortalAboutSiteContent(
          'Clean markdown',
          { description: 'Clean metadata' },
          '',
          'corr-about-empty-prod',
          { NODE_ENV: 'production' },
        );
      } catch (error) {
        prodEmptyErr = error;
      }
      expect(prodEmptyErr).toBeInstanceOf(PrivacySanitizationError);
      expect((prodEmptyErr as PrivacySanitizationError).findings).toEqual([
        expect.objectContaining({
          ruleId: 'config.denylist_empty_in_prod',
          category: 'config',
        }),
      ]);
      expect(warnLogs.join('\n')).toContain('admin.privacy.denylist_empty_in_prod');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');
      expect(warnLogs.join('\n')).toContain('site_content.portal-about');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('catches multiline-split US postal ZIP and phone patterns without false positives, duplicate findings, or nonlinear latency', () => {
    const emptyDenylist = parseDossierPrivacyDenylist('');

    for (const [payload, expectedRuleId] of [
      ['Marietta, GA\n30062', 'pii.us_postal_zip'],
      ['Marietta, GA\n\n\n\n\n30062', 'pii.us_postal_zip'],
      ['Marietta, GA\n\u200b\n\u200b\n\u200b\n\u200b\n30062', 'pii.us_postal_zip'],
      ['ZIP\n30062', 'pii.us_postal_zip'],
      ['(555)\n010-1234', 'pii.us_phone'],
      ['(555) \n010-1234', 'pii.us_phone'],
      ['(555)\n 010-1234', 'pii.us_phone'],
      ['(555)\n\n010-1234', 'pii.us_phone'],
      ['(555)\n\u200b\n010-1234', 'pii.us_phone'],
      ['(555) \u200b\n010-1234', 'pii.us_phone'],
    ] as const) {
      const findings = scanTextForPrivacyFindings(payload, 'description', emptyDenylist);
      expect(
        findings,
        `expected multiline finding ${expectedRuleId} for ${JSON.stringify(payload)}`,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ruleId: expectedRuleId,
            category: 'pii',
            location: 'multiline',
          }),
        ]),
      );

      for (const runSanitizer of [
        () => sanitizePortalAboutSiteContent(payload, { description: 'Clean' }, ''),
        () => sanitizePortalHomeSiteContent(payload, { heading: 'Clean' }, ''),
      ]) {
        let caught: unknown = null;
        try {
          runSanitizer();
        } catch (error) {
          caught = error;
        }
        expect(caught, `expected rejection for ${JSON.stringify(payload)}`).toBeInstanceOf(
          PrivacySanitizationError,
        );
        expect((caught as PrivacySanitizationError).findings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              ruleId: expectedRuleId,
              location: 'multiline',
            }),
          ]),
        );
      }
    }

    // Hygiene: andrew@andrew-k.us is rejected on portal-about and career dossiers, and mixed multiline emails fail on portal-home
    for (const runEmailRejection of [
      () =>
        sanitizePortalAboutSiteContent(
          'Contact andrew@andrew-k.us directly.',
          { description: 'OK' },
          '',
        ),
      () =>
        sanitizeCareerDossierPayload(
          {
            ...CLEAN_DOSSIER,
            summaryBody: 'Reach andrew@andrew-k.us for architecture details.',
          },
          { rawDenylist: '' },
        ),
      () =>
        sanitizePortalHomeSiteContent(
          'andrew@andrew-k.us\nreference.contact@example.com',
          { heading: 'Clean' },
          '',
        ),
    ]) {
      let emailErr: unknown = null;
      try {
        runEmailRejection();
      } catch (error) {
        emailErr = error;
      }
      expect(emailErr).toBeInstanceOf(PrivacySanitizationError);
      expect((emailErr as PrivacySanitizationError).findings).toEqual(
        expect.arrayContaining([expect.objectContaining({ ruleId: 'pii.email_address' })]),
      );
    }

    // Rule already matched on a single line MUST NOT emit a duplicate multiline finding
    const singleLinePlusMultiline = scanTextForPrivacyFindings(
      'Marietta, GA 30062\nAdditional context line',
      'description',
      emptyDenylist,
    );
    expect(singleLinePlusMultiline.filter(f => f.ruleId === 'pii.us_postal_zip')).toEqual([
      expect.objectContaining({
        ruleId: 'pii.us_postal_zip',
        location: 'line:1',
      }),
    ]);

    // Benign multiline prose produces zero false positives (including allow-listed email across lines)
    expect(
      scanTextForPrivacyFindings(
        'deployed in\n40000 pods\nserving id\n12345 in ms\n15000',
        'description',
        emptyDenylist,
      ),
    ).toEqual([]);
    expect(
      scanTextForPrivacyFindings(
        'Public contact: andrew@andrew-k.us\nSenior Full-Stack & Systems Engineer',
        'bio',
        emptyDenylist,
        { allowedEmails: PORTAL_HOME_ALLOWED_PUBLIC_EMAILS },
      ),
    ).toEqual([]);

    // Linear timing on 60 KB multiline input (< 50 ms)
    const largeMultiline = Array.from(
      { length: 1_000 },
      (_, idx) => `service cluster ${idx} deployed in 40000 pods across regions`,
    ).join('\n');
    expect(largeMultiline.length).toBeGreaterThanOrEqual(55_000);
    const start = performance.now();
    const largeFindings = scanTextForPrivacyFindings(largeMultiline, 'body', emptyDenylist);
    const elapsedMs = performance.now() - start;
    expect(largeFindings).toEqual([]);
    expect(elapsedMs).toBeLessThan(50);
  });
});
