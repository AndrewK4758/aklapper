import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { initPortalClientTelemetry, reportPortalClientError } from './client-telemetry';

initPortalClientTelemetry();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        onError={(error, info) => {
          reportPortalClientError(error, {
            phase: 'router',
            pathname: info.location.pathname,
          });
        }}
      />
    </StrictMode>,
    {
      onUncaughtError: error => {
        reportPortalClientError(error, { phase: 'uncaught' });
      },
      onCaughtError: error => {
        reportPortalClientError(error, { phase: 'caught' });
      },
      onRecoverableError: error => {
        reportPortalClientError(error, { phase: 'recoverable' });
      },
    },
  );
});
