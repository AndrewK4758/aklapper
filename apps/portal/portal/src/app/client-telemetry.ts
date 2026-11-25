import type { PublicAppError } from '@aklapper/core';
import {
  type AnalyticsClient,
  bootstrapDocumentAnalytics,
  type ClientErrorReporter,
  createClientErrorReporter,
  type ErrorDedupDecision,
  getActiveAnalyticsClient,
  type ReportErrorContext,
  type ReportPublicErrorContext,
} from '@aklapper/core/analytics';

let activeReporter: ClientErrorReporter | null = null;

function ensurePortalClientReporter(): ClientErrorReporter {
  if (!activeReporter) {
    activeReporter = createClientErrorReporter({
      app: 'portal',
      client: getActiveAnalyticsClient(),
    });
  }
  return activeReporter;
}

export function initPortalClientTelemetry(
  clientOverride?: AnalyticsClient | null,
): ClientErrorReporter {
  const client = clientOverride !== undefined ? clientOverride : bootstrapDocumentAnalytics();
  activeReporter = createClientErrorReporter({
    app: 'portal',
    client,
  });
  return activeReporter;
}

export function reportPortalClientError(
  error: unknown,
  context: ReportErrorContext,
): ErrorDedupDecision {
  return ensurePortalClientReporter().reportError(error, context);
}

export function reportPortalPublicError(
  error: PublicAppError,
  context?: ReportPublicErrorContext,
): ErrorDedupDecision {
  return ensurePortalClientReporter().reportPublicError(error, context);
}

export function resetPortalClientTelemetryForTest(): void {
  activeReporter = null;
}
