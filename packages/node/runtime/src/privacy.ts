import type { CareerDossierUpsertInput, PrivacySanitizationFinding } from '@aklapper/core';

import {
  buildSeparatorObfuscatedRegex,
  buildTermWordRegex,
  collapseForSeparatorMatch,
  collectStringLeaves,
  computeDenylistHash,
  decodeBase64JsonCandidate,
  foldDiacriticsForMatch,
  isBlockedTrackerPrefix,
  normalizePrivacyTerm,
  parseJsonStringArray,
  PRIVACY_PATTERN_RULES,
  stripInvisibleAndNormalize,
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
    const decoded = decodeBase64JsonCandidate(compact);
    if (decoded?.startsWith('[')) {
      parsedTerms = parseJsonStringArray(decoded);
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
  if (lines.length === 1 && lines[0]) {
    const decoded = decodeBase64JsonCandidate(lines[0]);
    if (decoded?.startsWith('[')) {
      return parseDossierPrivacyDenylist(lines[0]);
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
  const matchedDenylistRules = new Set<string>();
  const lines = text.split(/\r?\n/);
  const denylistEntries = denylist.terms.map((term, index) => {
    const collapsed = collapseForSeparatorMatch(term);
    return {
      ruleId: `denylist.term_${index + 1}`,
      regex: buildTermWordRegex(term),
      obfuscatedRegex: collapsed.length < 6 ? buildSeparatorObfuscatedRegex(collapsed) : null,
      collapsed,
    };
  });

  const scanDenylistTarget = (
    foldedTarget: string,
    location: string,
    skipAlreadyMatched: boolean,
  ) => {
    if (denylistEntries.length === 0) return;
    const collapsedTarget = collapseForSeparatorMatch(foldedTarget);
    for (const entry of denylistEntries) {
      if (skipAlreadyMatched && matchedDenylistRules.has(entry.ruleId)) continue;
      const matched =
        entry.regex.test(foldedTarget) ||
        (entry.obfuscatedRegex !== null && entry.obfuscatedRegex.test(foldedTarget)) ||
        (entry.collapsed.length >= 6 && collapsedTarget.includes(entry.collapsed));
      if (matched) {
        matchedDenylistRules.add(entry.ruleId);
        addFindingUnique(findings, seen, {
          ruleId: entry.ruleId,
          category: 'denylist',
          field,
          location,
        });
      }
    }
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx += 1) {
    const rawLine = lines[lineIdx] ?? '';
    if (!rawLine.trim()) {
      continue;
    }
    const location = `line:${lineIdx + 1}`;
    const normalizedLine = stripInvisibleAndNormalize(rawLine);

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
      if (isBlockedTrackerPrefix(prefix)) {
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

    scanDenylistTarget(foldDiacriticsForMatch(normalizedLine), location, false);
  }

  if (lines.length > 1 && denylistEntries.length > 0) {
    const foldedJoined = foldDiacriticsForMatch(lines.join(' '));
    scanDenylistTarget(foldedJoined, 'multiline', true);
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

export function sanitizePortalAskSiteContent(
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  rawDenylist?: string,
  correlationId?: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const parsed = parseDossierPrivacyDenylist(rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST']);
  if (isProductionPrivacyEnv(env) && !parsed.configured) {
    console.warn(
      JSON.stringify({
        event: 'admin.privacy.denylist_empty_in_prod',
        seam_type: 'UNSOUND_CONDITION',
        severity: 'CRITICAL',
        surface: 'site_content.portal-ask',
        ...(correlationId ? { correlationId } : {}),
      }),
    );
    throw new PrivacySanitizationError([
      {
        ruleId: 'config.denylist_empty_in_prod',
        category: 'config',
        field: 'DOSSIER_PRIVACY_DENYLIST',
        location: 'site_content.portal-ask',
      },
    ]);
  }
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
