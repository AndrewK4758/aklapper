import {
  type AppErrorCode,
  createPublicAppError,
  isPublicAppError,
  type PublicAppError,
} from '@aklapper/core';
import { type ReactElement, type ReactNode, useContext } from 'react';
import { isRouteErrorResponse, UNSAFE_DataRouterContext, useRevalidator } from 'react-router';

import { cx } from '../elements/_internal/elementFactory';
import { ErrorElement } from './ErrorElement';

import styles from './RouteErrorBoundaryView.module.css';

type CatalogTuple = readonly [status: number, message: string, action: string];

const CLIENT_ERROR_CATALOG: Readonly<Record<AppErrorCode, CatalogTuple>> = {
  ERR_VALIDATION: [400, 'Submitted fields need attention.', 'Review highlighted fields and retry.'],
  ERR_CONSTRAINT: [422, 'Data failed storage validation.', 'Check highlighted fields and retry.'],
  ERR_NOT_FOUND: [404, 'Resource could not be found.', 'Verify the URL or return home.'],
  ERR_UNAUTHORIZED: [401, 'Authentication is required.', 'Sign in with admin credentials.'],
  ERR_FORBIDDEN: [403, 'Permission denied for action.', 'Return home or sign in again.'],
  ERR_RATE_LIMITED: [429, 'Too many requests received.', 'Wait a moment and submit again.'],
  ERR_DB_UNAVAILABLE: [503, 'Database temporarily unavailable.', 'Retry shortly or share ID.'],
  ERR_STREAM_TIMEOUT: [504, 'Section took too long to load.', 'Retry loading or refresh.'],
  ERR_STREAM_ABORTED: [499, 'Request cancelled early.', 'Retry if you still need this view.'],
  ERR_UPSTREAM_UNAVAILABLE: [503, 'Upstream service unreachable.', 'Retry shortly or go home.'],
  ERR_INTERNAL: [500, 'Unexpected server error.', 'Retry or share the reference ID.'],
};

const STATUS_TO_CODE: Readonly<Record<number, AppErrorCode>> = {
  400: 'ERR_VALIDATION',
  401: 'ERR_UNAUTHORIZED',
  403: 'ERR_FORBIDDEN',
  404: 'ERR_NOT_FOUND',
  422: 'ERR_CONSTRAINT',
  429: 'ERR_RATE_LIMITED',
  499: 'ERR_STREAM_ABORTED',
  502: 'ERR_UPSTREAM_UNAVAILABLE',
  503: 'ERR_UPSTREAM_UNAVAILABLE',
  504: 'ERR_STREAM_TIMEOUT',
};

const reportedErrorObjects = new WeakSet<object>();

function normalizeCorrelationId(correlationId?: string): string {
  const trimmed = correlationId?.trim().slice(0, 128);
  return trimmed && trimmed.length > 0 ? trimmed : 'unavailable';
}

function buildSafeClientError(
  code: AppErrorCode,
  correlationId?: string,
  statusOverride?: number,
): PublicAppError {
  const [defaultStatus, message, action] = CLIENT_ERROR_CATALOG[code];
  const status =
    typeof statusOverride === 'number' && statusOverride >= 400 && statusOverride <= 599
      ? statusOverride
      : defaultStatus;
  return createPublicAppError({
    code,
    status,
    message,
    action,
    correlationId: normalizeCorrelationId(correlationId),
  });
}

export function normalizeBoundaryError(error: unknown, correlationId?: string): PublicAppError {
  if (isPublicAppError(error)) {
    return error;
  }

  if (isRouteErrorResponse(error)) {
    if (isPublicAppError(error.data)) {
      return error.data;
    }
    const mappedCode = STATUS_TO_CODE[error.status] ?? 'ERR_INTERNAL';
    return buildSafeClientError(mappedCode, correlationId, error.status);
  }

  if (typeof error === 'object' && error !== null) {
    const rec = error as Record<string, unknown>;
    const name = typeof rec['name'] === 'string' ? rec['name'] : '';
    const code = typeof rec['code'] === 'string' ? rec['code'] : '';
    const message = typeof rec['message'] === 'string' ? rec['message'] : '';

    if (name === 'AbortError' || code === 'ABORT_ERR') {
      return buildSafeClientError('ERR_STREAM_ABORTED', correlationId);
    }
    if (
      name === 'StreamDeadlineError' ||
      name === 'TimeoutError' ||
      /server timeout|timed?\s*out/i.test(message)
    ) {
      return buildSafeClientError('ERR_STREAM_TIMEOUT', correlationId);
    }
  }

  return buildSafeClientError('ERR_INTERNAL', correlationId);
}

export function reportClientErrorOnce(
  rawError: unknown,
  publicError: PublicAppError,
  callback?: (error: PublicAppError) => void,
): void {
  if (typeof window === 'undefined' || !callback) {
    return;
  }
  const dedupKey = typeof rawError === 'object' && rawError !== null ? rawError : publicError;
  if (reportedErrorObjects.has(dedupKey)) {
    return;
  }
  reportedErrorObjects.add(dedupKey);
  callback(publicError);
}

interface RevalidatingErrorRendererProps {
  readonly error: PublicAppError;
  readonly homeHref?: string;
  readonly customRender?: (error: PublicAppError, retry: () => void) => ReactNode;
  readonly className?: string;
}

function DataRouterErrorPanel({
  error,
  homeHref,
  customRender,
  className,
}: RevalidatingErrorRendererProps): ReactElement {
  const revalidator = useRevalidator();
  const retry = () => {
    void revalidator.revalidate();
  };

  if (customRender) {
    return <>{customRender(error, retry)}</>;
  }

  return (
    <ErrorElement
      error={error}
      onRetry={retry}
      isRetrying={revalidator.state === 'loading'}
      homeHref={homeHref}
      className={className}
    />
  );
}

export function RevalidatingErrorPanel({
  error,
  homeHref,
  customRender,
  onRetry,
  className,
}: RevalidatingErrorRendererProps & { readonly onRetry?: () => void }): ReactElement {
  const dataRouterContext = useContext(UNSAFE_DataRouterContext);

  if (onRetry) {
    if (customRender) {
      return <>{customRender(error, onRetry)}</>;
    }
    return (
      <ErrorElement error={error} onRetry={onRetry} homeHref={homeHref} className={className} />
    );
  }

  if (dataRouterContext !== null) {
    return (
      <DataRouterErrorPanel
        error={error}
        homeHref={homeHref}
        customRender={customRender}
        className={className}
      />
    );
  }

  const reload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  if (customRender) {
    return <>{customRender(error, reload)}</>;
  }

  return <ErrorElement error={error} onRetry={reload} homeHref={homeHref} className={className} />;
}

export interface RouteErrorBoundaryViewProps {
  readonly error: unknown;
  readonly correlationId?: string;
  readonly homeHref?: string;
  readonly onError?: (error: PublicAppError) => void;
  readonly onRetry?: () => void;
  readonly className?: string;
}

export function RouteErrorBoundaryView({
  error,
  correlationId,
  homeHref = '/',
  onError,
  onRetry,
  className,
}: RouteErrorBoundaryViewProps): ReactElement {
  const publicError = normalizeBoundaryError(error, correlationId);
  reportClientErrorOnce(error, publicError, onError);

  return (
    <div className={cx(styles.boundary, className)}>
      <div className={styles.content}>
        <RevalidatingErrorPanel error={publicError} homeHref={homeHref} onRetry={onRetry} />
      </div>
    </div>
  );
}
