import type { ContactActionResult, PortalContactLoaderData } from '@aklapper/core';
import { loadPortalContactDataWithPrerender } from '@aklapper/db';
import {
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { data, href, useNavigate, useNavigation } from 'react-router';

import { PortalContactPage } from '#pages/contact';

import { reportPortalPublicError } from '../client-telemetry';
import { processContactSubmission } from '../contact-submission.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/contact';

export function loader({ request, context }: Route.LoaderArgs) {
  const correlationId = getOrCreateCorrelationId(request, context);
  return {
    correlationId,
    payload: deferStreamResult(loadPortalContactDataWithPrerender(), {
      request,
      context,
      source: 'portal.contact.loader',
    }),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact // andrew-k.us',
    description:
      'Direct TUI contact form backed by recursive Zod/JSON schema validation and PostgreSQL 19 CHECK constraints.',
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const { payload, status } = await processContactSubmission(request, {
    correlationId,
    logger: reqCtx?.logger,
  });
  return data<ContactActionResult>(payload, {
    status,
    headers: { 'X-Correlation-Id': correlationId },
  });
}

export default function PortalContactRoute({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalContactLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading contact channel...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content }) => (
        <PortalContactPage
          content={content}
          actionData={actionData}
          isSubmitting={navigation.state === 'submitting'}
          formAction={href('/contact')}
          onClose={() => {
            if (paneNav?.docked) {
              paneNav.exitTui();
            } else {
              void navigate(href('/'));
            }
          }}
        />
      )}
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
