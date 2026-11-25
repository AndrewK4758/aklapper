import type { CareerDossierUpsertInput, PrivacySanitizationFinding } from '@aklapper/core';

import {
  ALLOWED_TECHNICAL_CODE_PREFIXES,
  buildTermWordRegex,
  collapseForSeparatorMatch,
  computeDenylistHash,
  normalizePrivacyTerm,
  parseJsonStringArray,
  PRIVACY_PATTERN_RULES,
  TRACKER_ISSUE_KEY_RE,
  type ParsedDenylist,
} from './privacy-patterns.ts';

export { computeDenylistHash, type ParsedDenylist };
export type { PrivacySanitizationFinding };

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

export class PrivacySanitizationError extends Error {
  readonly code = 'ERR_CONSTRAINT' as const;
  readonly status = 422 as const;
  readonly findings: readonly PrivacySanitizationFinding[];

  constructor(findings: readonly PrivacySanitizationFinding[]) {
    super('Content failed privacy sanitization policy.');
    this.name = 'PrivacySanitizationError';
    this.findings = findings.map(finding => ({
      ruleId: finding.ruleId,
      category: finding.category,
      field: finding.field,
      location: finding.location,
    }));
  }
}

const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function parseDossierPrivacyDenylist(rawEnv?: string): ParsedDenylist {
  const trimmed = rawEnv?.trim() ?? '';
  if (!trimmed) {
    return {
      terms: [],
      denylistHash: computeDenylistHash([]),
      configured: false,
    };
  }

  let parsedTerms: readonly string[] | null = null;
  if (trimmed.startsWith('[')) {
    parsedTerms = parseJsonStringArray(trimmed);
  } else {
    const compact = trimmed.replace(/\s+/g, '');
    if (compact.length > 0 && compact.length % 4 === 0 && BASE64_RE.test(compact)) {
      const decoded = Buffer.from(compact, 'base64').toString('utf8').trim();
      if (decoded.startsWith('[')) {
        parsedTerms = parseJsonStringArray(decoded);
      }
    }
  }

  if (parsedTerms === null) {
    throw new PrivacySanitizationError([
      {
        ruleId: 'config.malformed_denylist',
        category: 'config',
        field: 'DOSSIER_PRIVACY_DENYLIST',
        location: 'env',
      },
    ]);
  }

  return {
    terms: parsedTerms,
    denylistHash: computeDenylistHash(parsedTerms),
    configured: parsedTerms.length > 0,
  };
}

export function parseDenylistFileContent(rawContent: string): ParsedDenylist {
  const trimmed = rawContent.trim();
  if (!trimmed) {
    return {
      terms: [],
      denylistHash: computeDenylistHash([]),
      configured: false,
    };
  }
  if (trimmed.startsWith('[')) {
    return parseDossierPrivacyDenylist(trimmed);
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
  if (lines.length === 1 && lines[0] && BASE64_RE.test(lines[0]) && lines[0].length % 4 === 0) {
    try {
      const decoded = Buffer.from(lines[0], 'base64').toString('utf8').trim();
      if (decoded.startsWith('[')) {
        return parseDossierPrivacyDenylist(lines[0]);
      }
    } catch {
      // Fall through to plain line-delimited terms.
    }
  }
  const normalized = [
    ...new Set(lines.map(normalizePrivacyTerm).filter(t => t.length >= 2)),
  ].toSorted();
  return {
    terms: normalized,
    denylistHash: computeDenylistHash(normalized),
    configured: normalized.length > 0,
  };
}

export function isProductionPrivacyEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  const nodeEnv = env['NODE_ENV']?.trim().toLowerCase();
  const appEnv = env['APP_ENV']?.trim().toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production';
}

function addFindingUnique(
  target: PrivacySanitizationFinding[],
  seen: Set<string>,
  finding: PrivacySanitizationFinding,
): void {
  const key = `${finding.ruleId}|${finding.field}|${finding.location}`;
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(finding);
}

export function scanTextForPrivacyFindings(
  text: string,
  field: string,
  denylist: ParsedDenylist,
): readonly PrivacySanitizationFinding[] {
  if (!text) {
    return [];
  }
  const findings: PrivacySanitizationFinding[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  const denylistEntries = denylist.terms.map((term, index) => ({
    ruleId: `denylist.term_${index + 1}`,
    regex: buildTermWordRegex(term),
    collapsed: collapseForSeparatorMatch(term),
  }));

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const rawLine = lines[lineIdx] ?? '';
    if (!rawLine.trim()) {
      continue;
    }
    const location = `line:${lineIdx + 1}`;
    const normalizedLine = rawLine.normalize('NFKC');

    for (const rule of PRIVACY_PATTERN_RULES) {
      rule.regex.lastIndex = 0;
      if (rule.regex.test(normalizedLine)) {
        addFindingUnique(findings, seen, {
          ruleId: rule.ruleId,
          category: rule.category,
          field,
          location,
        });
      }
    }

    TRACKER_ISSUE_KEY_RE.lastIndex = 0;
    let trackerMatch = TRACKER_ISSUE_KEY_RE.exec(normalizedLine);
    while (trackerMatch !== null) {
      const prefix = trackerMatch[1] ?? '';
      if (!ALLOWED_TECHNICAL_CODE_PREFIXES.has(prefix)) {
        addFindingUnique(findings, seen, {
          ruleId: 'tracker.issue_key',
          category: 'tracker',
          field,
          location,
        });
        break;
      }
      trackerMatch = TRACKER_ISSUE_KEY_RE.exec(normalizedLine);
    }

    if (denylistEntries.length > 0) {
      const collapsedLine = collapseForSeparatorMatch(normalizedLine);
      for (const entry of denylistEntries) {
        const matched =
          entry.regex.test(normalizedLine) ||
          (entry.collapsed.length >= 6 && collapsedLine.includes(entry.collapsed));
        if (matched) {
          addFindingUnique(findings, seen, {
            ruleId: entry.ruleId,
            category: 'denylist',
            field,
            location,
          });
        }
      }
    }
  }

  return findings;
}

function emitSanitizationRejectedLog(
  findings: readonly PrivacySanitizationFinding[],
  surface: string,
  correlationId?: string,
): void {
  console.warn(
    JSON.stringify({
      event: 'admin.privacy.sanitization_rejected',
      seam_type: 'BOUNDARY_FAULT',
      severity: 'CRITICAL',
      surface,
      ...(correlationId ? { correlationId } : {}),
      findingCount: findings.length,
      findings: findings.map(f => ({
        ruleId: f.ruleId,
        category: f.category,
        field: f.field,
        location: f.location,
      })),
    }),
  );
}

export function sanitizeCareerDossierPayload(
  input: CareerDossierUpsertInput,
  opts: PrivacySanitizeDossierOptions = {},
): PrivacySanitizeDossierResult {
  const env = opts.env ?? process.env;
  const rawDenylist = opts.rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST'];
  const parsed = parseDossierPrivacyDenylist(rawDenylist);

  if (opts.requireConfiguredDenylist && !parsed.configured) {
    console.warn(
      JSON.stringify({
        event: 'admin.privacy.denylist_empty_in_prod',
        seam_type: 'UNSOUND_CONDITION',
        severity: 'CRITICAL',
        ...(opts.correlationId ? { correlationId: opts.correlationId } : {}),
      }),
    );
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

function collectStringLeaves(
  value: unknown,
  prefix: string,
  out: Array<readonly [field: string, text: string]>,
): void {
  if (typeof value === 'string') {
    out.push([prefix, value]);
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      collectStringLeaves(value[i], `${prefix}[${i}]`, out);
    }
    return;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      collectStringLeaves(v, `${prefix}.${k}`, out);
    }
  }
}

export function sanitizePortalAskSiteContent(
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  rawDenylist?: string,
  correlationId?: string,
): void {
  const parsed = parseDossierPrivacyDenylist(
    rawDenylist ?? process.env['DOSSIER_PRIVACY_DENYLIST'],
  );
  const leaves: Array<readonly [field: string, text: string]> = [['markdownBody', markdownBody]];
  collectStringLeaves(metadataJson, 'metadataJson', leaves);

  const findings: PrivacySanitizationFinding[] = [];
  for (const [field, value] of leaves) {
    findings.push(...scanTextForPrivacyFindings(value, field, parsed));
  }

  if (findings.length > 0) {
    emitSanitizationRejectedLog(findings, 'site_content.portal-ask', correlationId);
    throw new PrivacySanitizationError(findings);
  }
}

export function redactTextForStorage(raw: string, rawDenylist?: string, maxRunes = 1000): string {
  const parsed = parseDossierPrivacyDenylist(
    rawDenylist ?? process.env['DOSSIER_PRIVACY_DENYLIST'],
  );
  let output = raw.normalize('NFKC');
  for (const rule of PRIVACY_PATTERN_RULES) {
    rule.regex.lastIndex = 0;
    output = output.replace(rule.regex, '[REDACTED]');
  }
  TRACKER_ISSUE_KEY_RE.lastIndex = 0;
  output = output.replace(TRACKER_ISSUE_KEY_RE, (full, prefix: string) =>
    ALLOWED_TECHNICAL_CODE_PREFIXES.has(prefix) ? full : '[REDACTED]',
  );
  for (const term of parsed.terms) {
    const globalRe = new RegExp(buildTermWordRegex(term).source, 'gi');
    output = output.replace(globalRe, '[REDACTED]');
  }
  const runes = Array.from(output.trim());
  return runes.length > maxRunes ? runes.slice(0, maxRunes).join('') : runes.join('');
}
