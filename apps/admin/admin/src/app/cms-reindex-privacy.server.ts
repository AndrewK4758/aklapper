import { extractPrivacySanitizationFindings } from '@aklapper/core';
import {
  sanitizePortalAboutSiteContent,
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
} from '@aklapper/node-runtime/privacy';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import type { AdminCmsActionData } from '#pages/cms';

import { triggerQdrantReindex } from './admin-ops.server';

export interface ReindexPrivacyOutcome {
  readonly status: number;
  readonly payload: AdminCmsActionData;
}

export async function handleReindexQdrantIntent(
  correlationId: string,
  logger: SsrStructuredLogger,
  source = 'admin.cms.action.reindex_qdrant',
): Promise<ReindexPrivacyOutcome> {
  const result = await triggerQdrantReindex(correlationId, logger, source);
  if (result.ok) {
    return { status: 200, payload: { ok: true, message: result.message } };
  }
  return {
    status: result.status ?? 503,
    payload: {
      ok: false,
      message: result.message,
      code: result.code ?? 'ERR_UPSTREAM_UNAVAILABLE',
      action: result.action ?? 'Retry shortly or go home.',
      correlationId: result.correlationId ?? correlationId,
    },
  };
}

function runSiteContentPrivacyCheck(
  runSanitizer: () => void,
  message: string,
  correlationId: string,
): ReindexPrivacyOutcome | null {
  try {
    runSanitizer();
    return null;
  } catch (error) {
    const findings = extractPrivacySanitizationFindings(error);
    if (!findings) {
      throw error;
    }
    return {
      status: 422,
      payload: {
        ok: false,
        message,
        code: 'ERR_CONSTRAINT',
        action: 'Remove sensitive or denylisted terms and retry.',
        correlationId,
        sanitizationFindings: findings,
      },
    };
  }
}

export function validatePortalAskPrivacyOutcome(
  markdownBody: string,
  metadata: Record<string, unknown>,
  correlationId: string,
): ReindexPrivacyOutcome | null {
  return runSiteContentPrivacyCheck(
    () => {
      sanitizePortalAskSiteContent(markdownBody, metadata, undefined, correlationId);
    },
    'Portal Ask content failed privacy sanitization policy.',
    correlationId,
  );
}

export function validatePortalHomePrivacyOutcome(
  markdownBody: string,
  metadata: Record<string, unknown>,
  correlationId: string,
): ReindexPrivacyOutcome | null {
  return runSiteContentPrivacyCheck(
    () => {
      sanitizePortalHomeSiteContent(markdownBody, metadata, undefined, correlationId);
    },
    'Portal Home content failed privacy sanitization policy.',
    correlationId,
  );
}

export function validatePortalAboutPrivacyOutcome(
  markdownBody: string,
  metadata: Record<string, unknown>,
  correlationId: string,
): ReindexPrivacyOutcome | null {
  return runSiteContentPrivacyCheck(
    () => {
      sanitizePortalAboutSiteContent(markdownBody, metadata, undefined, correlationId);
    },
    'Portal About content failed privacy sanitization policy.',
    correlationId,
  );
}
