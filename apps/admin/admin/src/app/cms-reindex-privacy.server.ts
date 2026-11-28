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
