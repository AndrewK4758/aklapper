import {
  type AppDatabase,
  bindGuestSessionToAnalyticsSession,
  type ContactAnalyticsLinkResult,
  getSharedDb,
  isReactRouterPrerender,
  resolveOrCreateContactAnalyticsSession,
} from '@aklapper/db';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import { requireGuestSession } from './guest-session.server';

export function readPassiveGuestSession(request: Request): string | null {
  try {
    return requireGuestSession(request);
  } catch {
    return null;
  }
}

export interface ResolvePortalContactAnalyticsLinkOptions {
  readonly correlationId: string;
  readonly logger: SsrStructuredLogger;
}

export async function resolvePortalContactAnalyticsLink(
  db: AppDatabase,
  request: Request,
  formData: FormData,
  options: ResolvePortalContactAnalyticsLinkOptions,
): Promise<ContactAnalyticsLinkResult> {
  const guestSessionId = readPassiveGuestSession(request);
  const rawCandidate = formData.get('analyticsSessionId');
  const candidateSessionId = typeof rawCandidate === 'string' ? rawCandidate.trim() || null : null;

  try {
    return await resolveOrCreateContactAnalyticsSession(db, request, {
      candidateSessionId,
      guestSessionId,
      correlationId: options.correlationId,
      logger: options.logger,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'contact_analytics_link_failed';
    options.logger.warn(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'portal.contact.analytics_link_failed',
        correlationId: options.correlationId,
        detail,
      },
      'Contact analytics session link failed open',
    );
    return {
      analyticsSessionId: null,
      guestSessionId,
      linkMethod: 'fail_open_null',
      spoofRejected: false,
    };
  }
}

export interface ContactAnalyticsCommitAuditInput {
  readonly submissionId: string;
  readonly linkMethod: ContactAnalyticsLinkResult['linkMethod'];
  readonly linkedSessionPresent: boolean;
  readonly guestSessionLinked: boolean;
  readonly correlationId: string;
}

export function emitContactAnalyticsCommitAudit(
  logger: SsrStructuredLogger,
  input: ContactAnalyticsCommitAuditInput,
): void {
  try {
    logger.info(
      {
        seam_type: 'DELTA_AUDIT_GAP',
        event: 'portal.contact.analytics_link_committed',
        submissionId: input.submissionId,
        linkMethod: input.linkMethod,
        linkedSessionPresent: input.linkedSessionPresent,
        guestSessionLinked: input.guestSessionLinked,
        correlationId: input.correlationId,
      },
      'Contact submission analytics link committed',
    );
  } catch {
    // Non-blocking audit log
  }
}

export function triggerPortalGuestSessionBinding(
  request: Request,
  guestSessionId: string | null | undefined,
  logger?: SsrStructuredLogger,
  landingPath?: string,
): void {
  const trimmed = guestSessionId?.trim();
  if (!trimmed || isReactRouterPrerender() || !process.env['DATABASE_URL']?.trim()) {
    return;
  }
  try {
    void bindGuestSessionToAnalyticsSession(getSharedDb(), request, trimmed, {
      ...(logger ? { logger } : {}),
      ...(landingPath ? { landingPath } : {}),
    }).catch(() => undefined);
  } catch {
    // Fail-open: never impact guest-session routes
  }
}
