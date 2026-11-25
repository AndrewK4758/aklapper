import { createHash } from 'node:crypto';

import type { PrivacySanitizationCategory } from '@aklapper/core';

export interface ParsedDenylist {
  readonly terms: readonly string[];
  readonly denylistHash: string;
  readonly configured: boolean;
}

export function normalizePrivacyTerm(raw: string): string {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function collapseForSeparatorMatch(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function buildTermWordRegex(normalizedTerm: string): RegExp {
  const parts = normalizedTerm
    .split(/\s+/)
    .map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?<![a-z0-9])${parts.join('[\\s_./-]+')}(?![a-z0-9])`, 'i');
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
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    ruleId: 'pii.us_ssn',
    category: 'pii',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    ruleId: 'pii.us_phone',
    category: 'pii',
    regex: /(?<!\w)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?!\w)/g,
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

export const TRACKER_ISSUE_KEY_RE = /\b([A-Z]{2,8})-(\d{1,6})\b/g;

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
