import type { CareerDossierUpsertInput, PrivacySanitizationFinding } from '@aklapper/core';

import {
  emitDenylistEmptyInProdLog,
  emitSanitizationRejectedLog,
  isProductionPrivacyEnv,
  parseDenylistFileContent,
  parseDossierPrivacyDenylist,
  PrivacySanitizationError,
  scanTextForPrivacyFindings,
  type ScanPrivacyTextOptions,
} from './privacy-core.ts';
import {
  buildSeparatorObfuscatedRegex,
  buildTermWordRegex,
  collapseForSeparatorMatch,
  computeDenylistHash,
  isBlockedTrackerPrefix,
  PRIVACY_PATTERN_RULES,
  stripInvisibleAndNormalize,
  TRACKER_ISSUE_KEY_RE,
  type ParsedDenylist,
} from './privacy-patterns.ts';
import {
  PORTAL_HOME_ALLOWED_PUBLIC_EMAILS,
  sanitizePortalHomeSiteContent,
} from './privacy-portal-home.ts';
import {
  sanitizePortalAboutSiteContent,
  sanitizePortalAskSiteContent,
  sanitizeSiteContentPayload,
} from './privacy-site-content.ts';

export {
  computeDenylistHash,
  isProductionPrivacyEnv,
  parseDenylistFileContent,
  parseDossierPrivacyDenylist,
  PORTAL_HOME_ALLOWED_PUBLIC_EMAILS,
  PrivacySanitizationError,
  sanitizePortalAboutSiteContent,
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
  sanitizeSiteContentPayload,
  scanTextForPrivacyFindings,
  type ParsedDenylist,
  type PrivacySanitizationFinding,
  type ScanPrivacyTextOptions,
};

export interface PrivacySanitizeDossierOptions {
  readonly requireConfiguredDenylist?: boolean;
  readonly rawDenylist?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly correlationId?: string;
}

export interface PrivacySanitizeDossierResult {
  readonly denylistHash: string;
  readonly verifiedAt: Date;
}

export function sanitizeCareerDossierPayload(
  input: CareerDossierUpsertInput,
  opts: PrivacySanitizeDossierOptions = {},
): PrivacySanitizeDossierResult {
  const env = opts.env ?? process.env;
  const rawDenylist = opts.rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST'];
  const parsed = parseDossierPrivacyDenylist(rawDenylist);

  if (opts.requireConfiguredDenylist && !parsed.configured) {
    emitDenylistEmptyInProdLog(undefined, opts.correlationId);
    throw new PrivacySanitizationError([
      {
        ruleId: 'config.denylist_empty_in_prod',
        category: 'config',
        field: 'DOSSIER_PRIVACY_DENYLIST',
        location: 'publish',
      },
    ]);
  }

  const findings: PrivacySanitizationFinding[] = [];
  const fields: Array<readonly [field: string, text: string]> = [
    ['slug', input.slug],
    ['title', input.title],
    ['domainLabel', input.domainLabel],
    ['roleTitle', input.roleTitle],
    ['timeframe', input.timeframe],
    ['summaryBody', input.summaryBody],
  ];
  for (let i = 0; i < input.skills.length; i += 1) {
    fields.push([`skills[${i}]`, input.skills[i] ?? '']);
  }
  for (let i = 0; i < input.sections.length; i += 1) {
    const section = input.sections[i];
    if (!section) continue;
    fields.push([`sections[${i}].heading`, section.heading]);
    fields.push([`sections[${i}].body`, section.body]);
  }

  for (const [field, value] of fields) {
    findings.push(...scanTextForPrivacyFindings(value, field, parsed));
  }

  if (findings.length > 0) {
    emitSanitizationRejectedLog(findings, 'career_dossiers', opts.correlationId);
    throw new PrivacySanitizationError(findings);
  }

  return {
    denylistHash: parsed.denylistHash,
    verifiedAt: new Date(),
  };
}

export function redactTextForStorage(raw: string, rawDenylist?: string, maxRunes = 1000): string {
  const parsed = parseDossierPrivacyDenylist(
    rawDenylist ?? process.env['DOSSIER_PRIVACY_DENYLIST'],
  );
  let output = stripInvisibleAndNormalize(raw);
  for (const rule of PRIVACY_PATTERN_RULES) {
    rule.regex.lastIndex = 0;
    output = output.replace(rule.regex, '[REDACTED]');
  }
  TRACKER_ISSUE_KEY_RE.lastIndex = 0;
  output = output.replace(TRACKER_ISSUE_KEY_RE, (full, prefix: string) =>
    isBlockedTrackerPrefix(prefix) ? '[REDACTED]' : full,
  );
  for (const term of parsed.terms) {
    const wordRe = new RegExp(buildTermWordRegex(term).source, 'gi');
    output = output.replace(wordRe, '[REDACTED]');
    const obf = buildSeparatorObfuscatedRegex(collapseForSeparatorMatch(term));
    if (obf) {
      output = output.replace(new RegExp(obf.source, 'gi'), '[REDACTED]');
    }
  }
  const runes = Array.from(output.trim());
  return runes.length > maxRunes ? runes.slice(0, maxRunes).join('') : runes.join('');
}
