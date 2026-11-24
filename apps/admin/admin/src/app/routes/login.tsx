import { sanitizeRedirectTarget } from '@aklapper/node-runtime/auth';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { href } from 'react-router';

import { AdminLoginPage } from '#pages/login';

import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/login';

export interface AdminLoginLoaderData {
  readonly nextTarget: string;
  readonly correlationId: string;
}

export function loader({ request, context }: Route.LoaderArgs): AdminLoginLoaderData {
  const correlationId = getOrCreateCorrelationId(request, context);
  const url = new URL(request.url);
  const nextTarget = sanitizeRedirectTarget(url.searchParams.get('next'), href('/'));
  return {
    nextTarget: nextTarget === href('/login') ? href('/') : nextTarget,
    correlationId,
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Passkey Sign In // Andrew Klapper Admin',
    description: 'Hardware-backed WebAuthn passkey and TOTP 2FA gate for admin.andrew-k.us.',
  });
}

export default function AdminLoginRoute({ loaderData }: Route.ComponentProps) {
  return <AdminLoginPage nextTarget={loaderData.nextTarget} />;
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={loaderData?.correlationId}
      homeHref={href('/login')}
      onError={publicError => {
        reportAdminPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
