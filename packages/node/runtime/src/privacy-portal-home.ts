import type { PrivacySanitizationFinding } from '@aklapper/core';

import {
  emitSanitizationRejectedLog,
  isProductionPrivacyEnv,
  parseDossierPrivacyDenylist,
  PrivacySanitizationError,
  scanTextForPrivacyFindings,
} from './privacy-core.ts';
import { collectStringLeaves, type PrivacyPatternRule } from './privacy-patterns.ts';

export const PORTAL_HOME_ALLOWED_PUBLIC_EMAILS: ReadonlySet<string> = new Set([
  'andrew@andrew-k.us',
]);

type PortalHomePrivacyBranch =
  | 'clean_allowed'
  | 'rejected_pii_or_denylist'
  | 'rejected_unconfigured_prod_denylist';

const PORTAL_HOME_EXTRA_PRIVACY_RULES: readonly PrivacyPatternRule[] = [
  {
    ruleId: 'pii.us_postal_address_zip',
    category: 'pii',
    regex:
      /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC),?\s+\d{5}(?:-\d{4})?\b/g,
  },
  {
    ruleId: 'pii.us_postal_address_zip',
    category: 'pii',
    regex: /\b(?:zip|postal)(?:\s+code)?\s*[:#-]?\s*\d{5}(?:-\d{4})?\b/gi,
  },
  {
    ruleId: 'pii.references_section',
    category: 'pii',
    regex:
      /^\s*(?:#{1,6}\s+)?(?:(?:professional|personal|work|character)\s+)?references(?:\s*[:—–-].*|\s*)$/gi,
  },
];

function emitPortalHomePrivacyBranch(
  branch: PortalHomePrivacyBranch,
  correlationId?: string,
): void {
  console.info(
    JSON.stringify({
      event: 'admin.cms.portal_home_privacy_branch',
      seam_type: 'RULE_DIVERGENCE',
      surface: 'site_content.portal-home',
      branch,
      ...(correlationId ? { correlationId } : {}),
    }),
  );
}

export function sanitizePortalHomeSiteContent(
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
        surface: 'site_content.portal-home',
        ...(correlationId ? { correlationId } : {}),
      }),
    );
    emitPortalHomePrivacyBranch('rejected_unconfigured_prod_denylist', correlationId);
    throw new PrivacySanitizationError([
      {
        ruleId: 'config.denylist_empty_in_prod',
        category: 'config',
        field: 'DOSSIER_PRIVACY_DENYLIST',
        location: 'site_content.portal-home',
      },
    ]);
  }

  const leaves: Array<readonly [field: string, text: string]> = [['markdownBody', markdownBody]];
  collectStringLeaves(metadataJson, 'metadataJson', leaves);

  const findings: PrivacySanitizationFinding[] = [];
  for (const [field, value] of leaves) {
    findings.push(
      ...scanTextForPrivacyFindings(value, field, parsed, {
        allowedEmails: PORTAL_HOME_ALLOWED_PUBLIC_EMAILS,
        extraRules: PORTAL_HOME_EXTRA_PRIVACY_RULES,
      }),
    );
  }

  if (findings.length > 0) {
    emitPortalHomePrivacyBranch('rejected_pii_or_denylist', correlationId);
    emitSanitizationRejectedLog(findings, 'site_content.portal-home', correlationId);
    throw new PrivacySanitizationError(findings);
  }

  emitPortalHomePrivacyBranch('clean_allowed', correlationId);
}
