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

function ensureAdminClientReporter(): ClientErrorReporter {
  if (!activeReporter) {
    activeReporter = createClientErrorReporter({
      app: 'admin',
      client: getActiveAnalyticsClient(),
    });
  }
  return activeReporter;
}

export function initAdminClientTelemetry(
  clientOverride?: AnalyticsClient | null,
): ClientErrorReporter {
  const client = clientOverride !== undefined ? clientOverride : bootstrapDocumentAnalytics();
  activeReporter = createClientErrorReporter({
    app: 'admin',
    client,
  });
  return activeReporter;
}

export function reportAdminClientError(
  error: unknown,
  context: ReportErrorContext,
): ErrorDedupDecision {
  return ensureAdminClientReporter().reportError(error, context);
}

export function reportAdminPublicError(
  error: PublicAppError,
  context?: ReportPublicErrorContext,
): ErrorDedupDecision {
  return ensureAdminClientReporter().reportPublicError(error, context);
}

export function resetAdminClientTelemetryForTest(): void {
  activeReporter = null;
}
