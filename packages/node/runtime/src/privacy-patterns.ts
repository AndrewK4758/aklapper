import { createHash } from 'node:crypto';

import type { PrivacySanitizationCategory } from '@aklapper/core';

export interface ParsedDenylist {
  readonly terms: readonly string[];
  readonly denylistHash: string;
  readonly configured: boolean;
}

const INVISIBLE_FORMAT_RE = /\p{Cf}/gu;
const COMBINING_MARKS_RE = /\p{Mn}/gu;
const BASE64_CHARS_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function stripInvisibleAndNormalize(raw: string): string {
  return raw.normalize('NFKC').replace(INVISIBLE_FORMAT_RE, '');
}

export function foldDiacriticsForMatch(raw: string): string {
  return stripInvisibleAndNormalize(raw).normalize('NFKD').replace(COMBINING_MARKS_RE, '');
}

export function normalizePrivacyTerm(raw: string): string {
  return stripInvisibleAndNormalize(raw).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function collapseForSeparatorMatch(raw: string): string {
  return foldDiacriticsForMatch(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function buildTermWordRegex(normalizedTerm: string): RegExp {
  const folded = foldDiacriticsForMatch(normalizedTerm).trim().toLowerCase();
  const parts = folded.split(/\s+/).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z0-9])${parts.join('[\\s_./-]+')}(?![a-z0-9])`, 'i');
}

export function buildSeparatorObfuscatedRegex(collapsedTerm: string): RegExp | null {
  if (collapsedTerm.length < 2 || collapsedTerm.length > 64) {
    return null;
  }
  const chars = Array.from(collapsedTerm).map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z0-9])${chars.join('[\\s_./-]*')}(?![a-z0-9])`, 'i');
}

export function decodeBase64JsonCandidate(compact: string): string | null {
  if (!compact || compact.length % 4 === 1 || !BASE64_CHARS_RE.test(compact)) {
    return null;
  }
  const padded =
    compact.length % 4 === 0
      ? compact
      : compact.padEnd(compact.length + (4 - (compact.length % 4)), '=');
  return Buffer.from(padded, 'base64').toString('utf8').trim();
}

export function computeDenylistHash(terms: readonly string[]): string {
  const canonical = [...new Set(terms.map(normalizePrivacyTerm).filter(Boolean))].toSorted();
  return createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

export function parseJsonStringArray(rawJson: string): readonly string[] | null {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return null;
    const out: string[] = [];
    for (const entry of parsed) {
      if (typeof entry !== 'string') return null;
      const normalized = normalizePrivacyTerm(entry);
      if (normalized.length >= 2) out.push(normalized);
    }
    return [...new Set(out)].toSorted();
  } catch {
    return null;
  }
}

export interface PrivacyPatternRule {
  readonly ruleId: string;
  readonly category: Exclude<PrivacySanitizationCategory, 'denylist' | 'config'>;
  readonly regex: RegExp;
}

export const PRIVACY_PATTERN_RULES: readonly PrivacyPatternRule[] = [
  {
    ruleId: 'secret.pem_private_key',
    category: 'secret',
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,
  },
  {
    ruleId: 'secret.aws_access_key',
    category: 'secret',
    regex: /\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b/g,
  },
  {
    ruleId: 'secret.gcp_api_key',
    category: 'secret',
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/g,
  },
  {
    ruleId: 'secret.github_token',
    category: 'secret',
    regex: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
  {
    ruleId: 'secret.openai_key',
    category: 'secret',
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    ruleId: 'secret.stripe_key',
    category: 'secret',
    regex: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    ruleId: 'secret.slack_token',
    category: 'secret',
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    ruleId: 'secret.jwt_token',
    category: 'secret',
    regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
  },
  {
    ruleId: 'secret.connection_uri_credentials',
    category: 'secret',
    regex: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@]+:[^\s@]+@/gi,
  },
  {
    ruleId: 'pii.email_address',
    category: 'pii',
    regex: /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,24}\b/g,
  },
  {
    ruleId: 'pii.us_ssn',
    category: 'pii',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    ruleId: 'pii.us_phone',
    category: 'pii',
    regex: /(?<![A-Za-z0-9])(?:\+?1[-.\s])?(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}(?!\d)/g,
  },
  {
    ruleId: 'pii.us_postal_zip',
    category: 'pii',
    // Strictly case-sensitive 2-letter US state codes prevent false positives on lowercase words
    // such as "in 40000", "or 40000", "id 12345", or "ms 15000" while blocking state+ZIP, ZIP+4,
    // and labeled ZIP values.
    regex:
      /\b(?:A[LKSZR]|C[AOT]|D[EC]|F[LM]|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[ARW]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])(?:,[ \t]{0,4}|[ \t]{1,4})\d{5}(?:-\d{4})?\b|\b\d{5}-\d{4}\b|\b[Zz][Ii][Pp](?:[ \t]{1,4}[Cc][Oo][Dd][Ee])?[:#\s]{1,8}\d{5}(?:-\d{4})?\b/g,
  },
  {
    ruleId: 'workspace.private_governance_repo',
    category: 'workspace',
    regex: /\baklapper[-_/]cadence\b/gi,
  },
  {
    ruleId: 'workspace.private_governance_file',
    category: 'workspace',
    regex:
      /\b(?:CADENCE_ORG\.md|CADENCE_DIRECTIVES\.md|triage-context\.md|design-options\.md|evidence\.yaml|certainty[-_]gate)\b/gi,
  },
  {
    ruleId: 'workspace.local_project_path',
    category: 'workspace',
    regex: /(?:~|\/home\/[A-Za-z0-9._-]+|\/Users\/[A-Za-z0-9._-]+)\/projects\/[A-Za-z0-9._/-]+/gi,
  },
];

export const TRACKER_ISSUE_KEY_RE = /\b([A-Za-z]{2,8})-(\d{1,8})\b/g;

export const CASE_INSENSITIVE_TRACKER_PREFIXES = new Set<string>([
  'akl',
  'dec',
  'ii',
  'prod',
  'oq',
]);

export function isBlockedTrackerPrefix(rawPrefix: string): boolean {
  if (CASE_INSENSITIVE_TRACKER_PREFIXES.has(rawPrefix.toLowerCase())) {
    return true;
  }
  return rawPrefix === rawPrefix.toUpperCase() && !ALLOWED_TECHNICAL_CODE_PREFIXES.has(rawPrefix);
}

export function collectStringLeaves(
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

export const ALLOWED_TECHNICAL_CODE_PREFIXES = new Set<string>([
  'AES',
  'AMD',
  'ANSI',
  'AP',
  'ARGON',
  'ARM',
  'ASCII',
  'AV',
  'AWS',
  'B2B',
  'B2C',
  'BASE',
  'CENTRAL',
  'CI',
  'CVE',
  'CWE',
  'DDR',
  'EAST',
  'ECMA',
  'ES',
  'EU',
  'FIPS',
  'GCP',
  'GO',
  'GPT',
  'GRPC',
  'HMAC',
  'HTML',
  'HTTP',
  'HTTPS',
  'IEEE',
  'IPV',
  'ISO',
  'JS',
  'JSON',
  'JWT',
  'K8S',
  'MD',
  'MP',
  'NIST',
  'NODE',
  'NORTH',
  'NVME',
  'OAUTH',
  'OIDC',
  'OS',
  'OWASP',
  'PBKDF',
  'PCI',
  'PG',
  'PKCS',
  'POSIX',
  'PYTHON',
  'RFC',
  'RSA',
  'SAML',
  'SHA',
  'SOC',
  'SOUTH',
  'SQL',
  'SSL',
  'TCP',
  'TIER',
  'TLS',
  'TS',
  'UDP',
  'US',
  'USB',
  'UTF',
  'UUID',
  'VP',
  'WCAG',
  'WEST',
  'X86',
  'XML',
]);
