import { isStreamResult, type PublicAppError, type StreamResult } from '@aklapper/core';
import { type ReactElement, type ReactNode, Suspense } from 'react';
import { Await, useAsyncError } from 'react-router';

import { LoadingElement } from './LoadingElement';
import {
  normalizeBoundaryError,
  reportClientErrorOnce,
  RevalidatingErrorPanel,
} from './RouteErrorBoundaryView';

export interface SuspenseElementProps<TData> {
  readonly resolve: Promise<StreamResult<TData>> | StreamResult<TData>;
  readonly children: (data: TData) => ReactNode;
  readonly loading?: ReactNode;
  readonly loadingLabel?: string;
  readonly errorElement?: (error: PublicAppError, retry: () => void) => ReactNode;
  readonly correlationId?: string;
  readonly homeHref?: string;
  readonly onStreamError?: (error: PublicAppError) => void;
}

interface TransportAbortFallbackProps {
  readonly correlationId?: string;
  readonly homeHref?: string;
  readonly errorElement?: (error: PublicAppError, retry: () => void) => ReactNode;
  readonly onStreamError?: (error: PublicAppError) => void;
}

function TransportAbortFallback({
  correlationId,
  homeHref,
  errorElement,
  onStreamError,
}: TransportAbortFallbackProps): ReactElement {
  const asyncError = useAsyncError();
  const publicError = normalizeBoundaryError(asyncError, correlationId);
  reportClientErrorOnce(asyncError, publicError, onStreamError);

  return (
    <RevalidatingErrorPanel error={publicError} homeHref={homeHref} customRender={errorElement} />
  );
}

export function SuspenseElement<TData>({
  resolve,
  children,
  loading,
  loadingLabel,
  errorElement,
  correlationId,
  homeHref = '/',
  onStreamError,
}: SuspenseElementProps<TData>): ReactElement {
  const fallback = loading ?? <LoadingElement label={loadingLabel} />;

  return (
    <Suspense fallback={fallback}>
      <Await
        resolve={resolve}
        errorElement={
          <TransportAbortFallback
            correlationId={correlationId}
            homeHref={homeHref}
            errorElement={errorElement}
            onStreamError={onStreamError}
          />
        }
      >
        {(resolved: unknown) => {
          if (!isStreamResult<TData>(resolved)) {
            const invalidError = normalizeBoundaryError(resolved, correlationId);
            reportClientErrorOnce(resolved, invalidError, onStreamError);
            return (
              <RevalidatingErrorPanel
                error={invalidError}
                homeHref={homeHref}
                customRender={errorElement}
              />
            );
          }

          if (!resolved.ok) {
            reportClientErrorOnce(resolved.error, resolved.error, onStreamError);
            return (
              <RevalidatingErrorPanel
                error={resolved.error}
                homeHref={homeHref}
                customRender={errorElement}
              />
            );
          }

          return <>{children(resolved.data)}</>;
        }}
      </Await>
    </Suspense>
  );
}
