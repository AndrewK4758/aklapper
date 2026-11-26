import { type AppErrorCode, SITE_CONTENT_KEYS, validateSiteContentMetadata } from '@aklapper/core';
import { getSharedDb, upsertSiteContent } from '@aklapper/db';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import type { AdminCmsActionData } from '#pages/cms';

import {
  validatePortalAskPrivacyOutcome,
  validatePortalHomePrivacyOutcome,
} from './cms-reindex-privacy.server';

export interface SiteContentActionOutcome {
  readonly status: number;
  readonly payload: AdminCmsActionData;
}

export interface UpsertSiteContentContext {
  readonly correlationId: string;
  readonly logger: SsrStructuredLogger;
  readonly adminActor: string;
}

function failSiteContent(
  status: number,
  message: string,
  code: AppErrorCode,
  action: string,
  correlationId: string,
): SiteContentActionOutcome {
  return { status, payload: { ok: false, message, code, action, correlationId } };
}

export async function handleUpsertSiteContentIntent(
  formData: FormData,
  ctx: UpsertSiteContentContext,
): Promise<SiteContentActionOutcome> {
  const { correlationId, logger, adminActor } = ctx;
  const key = String(formData.get('key') ?? '').trim();
  const markdownBody = String(formData.get('markdownBody') ?? '');
  const rawJson = String(formData.get('metadataJson') ?? '{}');

  let parsedMetadata: Record<string, unknown>;
  try {
    const candidate: unknown = JSON.parse(rawJson);
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      logger.warn(
        {
          event: 'admin.cms.site_content_invalid_payload',
          key,
          correlationId,
          reason: 'non_object_json',
        },
        'Rejected non-object site_content metadata payload.',
      );
      return failSiteContent(
        400,
        'Metadata JSON must be a JSON object.',
        'ERR_VALIDATION',
        'Provide a valid JSON object and submit again.',
        correlationId,
      );
    }
    parsedMetadata = candidate as Record<string, unknown>;
  } catch {
    logger.warn(
      {
        event: 'admin.cms.site_content_invalid_payload',
        key,
        correlationId,
        reason: 'malformed_json',
      },
      'Rejected malformed site_content metadata JSON.',
    );
    return failSiteContent(
      400,
      'Invalid JSON in metadataJson.',
      'ERR_VALIDATION',
      'Fix JSON syntax errors and submit again.',
      correlationId,
    );
  }

  const validation = validateSiteContentMetadata(key, parsedMetadata);
  if (!validation.ok) {
    if (
      key === SITE_CONTENT_KEYS.portalHome &&
      validation.issues.some(issue => issue.pathKey === 'portrait.src')
    ) {
      logger.warn(
        {
          event: 'portal.home.portrait_src_invalid',
          seam_type: 'UNSOUND_CONDITION',
          key,
          correlationId,
        },
        'Rejected non-root-relative portal-home portrait.src value.',
      );
    }
    const firstIssue = validation.issues[0];
    logger.warn(
      {
        event: 'admin.cms.site_content_invalid_payload',
        key,
        correlationId,
        reason: 'schema_validation_failed',
        issueCount: validation.issues.length,
      },
      'Rejected schema-invalid site_content metadata payload.',
    );
    return failSiteContent(
      400,
      firstIssue
        ? `Invalid metadata for "${key}" (${firstIssue.pathKey || 'root'}): ${firstIssue.message}`
        : `Invalid metadata payload for "${key}".`,
      'ERR_VALIDATION',
      'Correct the highlighted schema fields and submit again.',
      correlationId,
    );
  }

  let sanitizationVerified = false;
  if (key === SITE_CONTENT_KEYS.portalAsk) {
    const privacyFailure = validatePortalAskPrivacyOutcome(
      markdownBody,
      validation.data,
      correlationId,
    );
    if (privacyFailure) return privacyFailure;
    sanitizationVerified = true;
  } else if (key === SITE_CONTENT_KEYS.portalHome) {
    const privacyFailure = validatePortalHomePrivacyOutcome(
      markdownBody,
      validation.data,
      correlationId,
    );
    if (privacyFailure) return privacyFailure;
    sanitizationVerified = true;
  }

  const saved = await upsertSiteContent(getSharedDb(), key, markdownBody, validation.data);
  logger.info(
    {
      event: 'admin.cms.site_content_upsert_committed',
      ...(sanitizationVerified ? { seam_type: 'DELTA_AUDIT_GAP', sanitizationVerified: true } : {}),
      key: saved.key,
      adminActor,
      updatedAt: saved.updatedAt,
      correlationId,
    },
    'Committed site_content update.',
  );
  return { status: 200, payload: { ok: true, message: `Saved site_content key "${saved.key}".` } };
}
