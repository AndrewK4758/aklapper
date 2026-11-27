import type { PrivacySanitizationFinding } from '@aklapper/core';

import {
  emitDenylistEmptyInProdLog,
  emitSanitizationRejectedLog,
  isProductionPrivacyEnv,
  parseDossierPrivacyDenylist,
  PrivacySanitizationError,
  scanTextForPrivacyFindings,
} from './privacy-core.ts';
import { collectStringLeaves } from './privacy-patterns.ts';

export function sanitizeSiteContentPayload(
  surface: string,
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  rawDenylist?: string,
  correlationId?: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const parsed = parseDossierPrivacyDenylist(rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST']);
  if (isProductionPrivacyEnv(env) && !parsed.configured) {
    emitDenylistEmptyInProdLog(surface, correlationId);
    throw new PrivacySanitizationError([
      {
        ruleId: 'config.denylist_empty_in_prod',
        category: 'config',
        field: 'DOSSIER_PRIVACY_DENYLIST',
        location: surface,
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
    emitSanitizationRejectedLog(findings, surface, correlationId);
    throw new PrivacySanitizationError(findings);
  }
}

export function sanitizePortalAskSiteContent(
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  rawDenylist?: string,
  correlationId?: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  sanitizeSiteContentPayload(
    'site_content.portal-ask',
    markdownBody,
    metadataJson,
    rawDenylist,
    correlationId,
    env,
  );
}

export function sanitizePortalAboutSiteContent(
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  rawDenylist?: string,
  correlationId?: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  sanitizeSiteContentPayload(
    'site_content.portal-about',
    markdownBody,
    metadataJson,
    rawDenylist,
    correlationId,
    env,
  );
}
