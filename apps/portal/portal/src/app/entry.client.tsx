import { isPublicAppError } from '@aklapper/core';
import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { isRouteErrorResponse } from 'react-router';
import { HydratedRouter } from 'react-router/dom';

import { initPortalClientTelemetry, reportPortalClientError } from './client-telemetry';

function isExpectedNotFoundError(error: unknown): boolean {
  if (isPublicAppError(error)) {
    return error.status === 404;
  }
  if (isRouteErrorResponse(error)) {
    return error.status === 404;
  }
  return false;
}

initPortalClientTelemetry();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        onError={(error, info) => {
          if (isExpectedNotFoundError(error)) return;
          reportPortalClientError(error, {
            phase: 'router',
            pathname: info.location.pathname,
          });
        }}
      />
    </StrictMode>,
    {
      onUncaughtError: error => {
        if (isExpectedNotFoundError(error)) return;
        reportPortalClientError(error, { phase: 'uncaught' });
      },
      onCaughtError: error => {
        if (isExpectedNotFoundError(error)) return;
        reportPortalClientError(error, { phase: 'caught' });
      },
      onRecoverableError: error => {
        if (isExpectedNotFoundError(error)) return;
        reportPortalClientError(error, { phase: 'recoverable' });
      },
    },
  );
});
