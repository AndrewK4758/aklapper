import type { PrivacySanitizationFinding } from '@aklapper/core';

import {
  buildSeparatorObfuscatedRegex,
  buildTermWordRegex,
  collapseForSeparatorMatch,
  computeDenylistHash,
  decodeBase64JsonCandidate,
  foldDiacriticsForMatch,
  isBlockedTrackerPrefix,
  normalizePrivacyTerm,
  parseJsonStringArray,
  PRIVACY_PATTERN_RULES,
  type PrivacyPatternRule,
  stripInvisibleAndNormalize,
  TRACKER_ISSUE_KEY_RE,
  type ParsedDenylist,
} from './privacy-patterns.ts';

export interface ScanPrivacyTextOptions {
  readonly allowedEmails?: ReadonlySet<string>;
  readonly extraRules?: readonly PrivacyPatternRule[];
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
  options?: ScanPrivacyTextOptions,
): readonly PrivacySanitizationFinding[] {
  if (!text) {
    return [];
  }
  const findings: PrivacySanitizationFinding[] = [];
  const seen = new Set<string>();
  const matchedDenylistRules = new Set<string>();
  const lines = text.split(/\r?\n/);
  const rules = options?.extraRules
    ? [...PRIVACY_PATTERN_RULES, ...options.extraRules]
    : PRIVACY_PATTERN_RULES;
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

    for (const rule of rules) {
      rule.regex.lastIndex = 0;
      if (rule.ruleId === 'pii.email_address' && options?.allowedEmails) {
        for (const emailMatch of normalizedLine.matchAll(rule.regex)) {
          const matchedEmail = emailMatch[0].trim().toLowerCase();
          if (!options.allowedEmails.has(matchedEmail)) {
            addFindingUnique(findings, seen, {
              ruleId: rule.ruleId,
              category: rule.category,
              field,
              location,
            });
            break;
          }
        }
        continue;
      }

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

export function emitSanitizationRejectedLog(
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
