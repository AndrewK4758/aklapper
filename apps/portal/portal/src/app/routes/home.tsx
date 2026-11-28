import type { PortalHomeLoaderData } from '@aklapper/core';
import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { useMemo } from 'react';
import { href, useNavigate } from 'react-router';

import { PortalHomePage } from '#pages/home';

import { reportPortalPublicError } from '../client-telemetry';
import { loadPortalHomeDataWithPrerender } from '../portal-api.server';
import { buildPortalPageMeta } from '../seo';
import { createPortalTerminalForms } from '../terminalForms';
import type { Route } from './+types/home';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  return {
    correlationId,
    payload: deferStreamResult(
      loadPortalHomeDataWithPrerender({
        correlationId,
        ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
        signal: reqCtx?.signal ?? request.signal,
      }),
      {
        request,
        context,
        source: 'portal.home.loader',
      },
    ),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Andrew Klapper Portfolio',
    description: 'Interactive Solar Forge portfolio terminal and TUI workspace by Andrew Klapper.',
  });
}

interface PortalHomeContentProps {
  readonly data: PortalHomeLoaderData;
  readonly navigate: (to: string) => void | Promise<void>;
}

function PortalHomeContent({ data, navigate }: PortalHomeContentProps) {
  const terminalForms = useMemo(
    () => createPortalTerminalForms(data.contactForm, navigate),
    [data.contactForm, navigate],
  );

  return (
    <PortalHomePage
      content={data.content}
      terminal={data.terminal}
      terminalForms={terminalForms}
      onNavigate={to => {
        void navigate(to);
      }}
    />
  );
}

export default function PortalGreeterRoute({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();

  return (
    <SuspenseElement<PortalHomeLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading Solar Forge terminal...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {data => <PortalHomeContent data={data} navigate={navigate} />}
    </SuspenseElement>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={loaderData?.correlationId}
      homeHref={href('/')}
      onError={publicError => {
        reportPortalPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
