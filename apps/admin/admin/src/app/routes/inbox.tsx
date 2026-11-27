import type { AdminInboxLoaderData, StreamResult } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  deleteContactSubmission,
  deleteContactSubmissions,
  getSharedDb,
  listContactSubmissions,
} from '@aklapper/db';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { data, href } from 'react-router';

import { type AdminInboxActionData, AdminInboxPage } from '#pages/inbox';

import { requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/inbox';

export interface AdminInboxStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminInboxLoaderData>>;
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<AdminInboxStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  await requireAdminSession(request, { context, source: 'admin.inbox.loader' });

  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const selectedId = url.searchParams.get('selected')?.trim() || undefined;

  return {
    correlationId,
    payload: deferStreamResult(
      (async () =>
        listContactSubmissions(getSharedDb(), {
          query,
          page,
          pageSize: 20,
          ...(selectedId ? { selectedId } : {}),
        }))(),
      { request, context, source: 'admin.inbox.loader' },
    ),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  await requireAdminSession(request, { context, source: 'admin.inbox.action' });
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-inbox');
  const headers = { 'X-Correlation-Id': correlationId };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<AdminInboxActionData>(
      {
        ok: false,
        message: 'Malformed inbox request payload.',
        code: 'ERR_VALIDATION',
        action: 'Refresh the inbox view and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const intent = String(formData.get('intent') ?? '');

  try {
    if (intent === 'delete') {
      const id = String(formData.get('id') ?? '').trim();
      if (!id) {
        return data<AdminInboxActionData>(
          {
            ok: false,
            message: 'Submission ID is required.',
            code: 'ERR_VALIDATION',
            action: 'Select a contact submission and retry.',
            correlationId,
          },
          { status: 400, headers },
        );
      }

      const deleted = await deleteContactSubmission(getSharedDb(), id);
      return deleted
        ? data<AdminInboxActionData>(
            { ok: true, message: 'Contact submission deleted from PostgreSQL 19.' },
            { status: 200, headers },
          )
        : data<AdminInboxActionData>(
            {
              ok: false,
              message: 'Submission not found or already deleted.',
              code: 'ERR_NOT_FOUND',
              action: 'Refresh the inbox list.',
              correlationId,
            },
            { status: 404, headers },
          );
    }

    if (intent === 'delete-many') {
      const uniqueIds = [
        ...new Set(
          formData
            .getAll('id')
            .map(entry => String(entry).trim())
            .filter(id => id.length > 0),
        ),
      ];

      if (uniqueIds.length === 0) {
        return data<AdminInboxActionData>(
          {
            ok: false,
            message: 'Select at least one submission to delete.',
            code: 'ERR_VALIDATION',
            action: 'Select one or more contact submissions and retry.',
            correlationId,
          },
          { status: 400, headers },
        );
      }

      const deletedCount = await deleteContactSubmissions(getSharedDb(), uniqueIds);
      return deletedCount > 0
        ? data<AdminInboxActionData>(
            {
              ok: true,
              message: `Deleted ${deletedCount} contact submission${deletedCount === 1 ? '' : 's'} from PostgreSQL 19.`,
            },
            { status: 200, headers },
          )
        : data<AdminInboxActionData>(
            {
              ok: false,
              message: 'Selected submissions were not found or were already deleted.',
              code: 'ERR_NOT_FOUND',
              action: 'Refresh the inbox list.',
              correlationId,
            },
            { status: 404, headers },
          );
    }

    return data<AdminInboxActionData>(
      {
        ok: false,
        message: 'Unsupported inbox action.',
        code: 'ERR_VALIDATION',
        action: 'Select a valid inbox action and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'admin.inbox.action',
    });
    logDiagnosticError(logger, diagnostic);
    return data<AdminInboxActionData>(
      {
        ok: false,
        message: publicError.message,
        code: publicError.code,
        action: publicError.action,
        correlationId: publicError.correlationId,
      },
      { status: publicError.status, headers },
    );
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact Inbox // admin.andrew-k.us',
    description: 'Search, inspect, download verified attachments, and manage contact submissions.',
  });
}

export default function AdminInboxRoute({ loaderData, actionData }: Route.ComponentProps) {
  return (
    <SuspenseElement<AdminInboxLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading contact inbox...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {resolved => <AdminInboxPage data={resolved} actionData={actionData ?? null} />}
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
        reportAdminPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
