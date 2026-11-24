import { startTransition, StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { initAdminClientTelemetry, reportAdminClientError } from './client-telemetry';

initAdminClientTelemetry();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter
        onError={(error, info) => {
          reportAdminClientError(error, {
            phase: 'router',
            pathname: info.location.pathname,
          });
        }}
      />
    </StrictMode>,
    {
      onUncaughtError: error => {
        reportAdminClientError(error, { phase: 'uncaught' });
      },
      onCaughtError: error => {
        reportAdminClientError(error, { phase: 'caught' });
      },
      onRecoverableError: error => {
        reportAdminClientError(error, { phase: 'recoverable' });
      },
    },
  );
});
