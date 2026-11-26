import { extractPrivacySanitizationFindings } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
} from '@aklapper/node-runtime/privacy';
import { logDiagnosticError, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import type { AdminCmsActionData } from '#pages/cms';

import { triggerQdrantReindex } from './admin-ops.server';

export interface ReindexPrivacyOutcome {
  readonly status: number;
  readonly payload: AdminCmsActionData;
}

export async function handleReindexQdrantIntent(
  correlationId: string,
  logger: SsrStructuredLogger,
): Promise<ReindexPrivacyOutcome> {
  const result = await triggerQdrantReindex();
  if (result.ok) {
    return { status: 200, payload: { ok: true, message: result.message } };
  }
  if (result.status === 409 && result.code === 'ERR_CONSTRAINT') {
    return {
      status: 409,
      payload: {
        ok: false,
        message: result.message,
        code: 'ERR_CONSTRAINT',
        action: 'Wait for the active Qdrant re-index to finish and retry.',
        correlationId,
      },
    };
  }
  const { publicError, diagnostic } = classifyServerError(
    Object.assign(new Error(result.message), {
      status: result.status ?? 503,
      statusText: 'Service Unavailable',
      data: null,
    }),
    { correlationId, source: 'admin.cms.action.reindex_qdrant' },
  );
  logDiagnosticError(logger, diagnostic);
  return {
    status: publicError.status,
    payload: {
      ok: false,
      message: publicError.message,
      code: publicError.code,
      action: publicError.action,
      correlationId: publicError.correlationId,
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
