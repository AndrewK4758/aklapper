import type { ContactActionResult } from '@aklapper/core';
import type { ClientActionFunctionArgs } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { PortalAskActionResult } from '#pages/ask';
import type { PortalCadenceActionResult } from '#pages/cadence';

import { createPrimaryRouteClientAction } from './paneClientAction';

function buildClientActionArgs(
  url: string,
  fields: Record<string, string>,
  serverAction: () => Promise<unknown>,
): ClientActionFunctionArgs {
  const body = new URLSearchParams(fields);
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return {
    request,
    params: {},
    context: {} as ClientActionFunctionArgs['context'],
    unstable_pattern: url,
    serverAction: serverAction as ClientActionFunctionArgs['serverAction'],
  };
}

describe('createPrimaryRouteClientAction', () => {
  it('passes through successful serverAction responses', async () => {
    const clientAction = createPrimaryRouteClientAction<ContactActionResult>('/contact');
    const okPayload: ContactActionResult = {
      ok: true,
      source: 'server',
      message: 'Message received.',
    };
    const result = await clientAction(
      buildClientActionArgs(
        'http://localhost/contact',
        { name: 'Ada' },
        vi.fn(async () => okPayload),
      ),
    );
    expect(result).toEqual(okPayload);
  });

  it('re-throws 3xx redirect Responses without masking them as 503', async () => {
    const clientAction = createPrimaryRouteClientAction<ContactActionResult>('/contact');
    const redirectResponse = new Response(null, {
      status: 302,
      headers: { Location: '/changes-in-progress' },
    });
    await expect(
      clientAction(
        buildClientActionArgs('http://localhost/contact', {}, async () => {
          throw redirectResponse;
        }),
      ),
    ).rejects.toBe(redirectResponse);
  });

  it('returns fail-closed 503 data preserving /chat mode on offline TypeError', async () => {
    const clientAction = createPrimaryRouteClientAction<PortalAskActionResult>('/chat');
    const result = await clientAction(
      buildClientActionArgs('http://localhost/chat', { mode: 'jd_match' }, async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    expect(result).toMatchObject({
      type: 'DataWithResponseInit',
      init: { status: 503 },
      data: {
        ok: false,
        mode: 'jd_match',
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        error: 'Unable to reach the server.',
        action: expect.any(String),
        correlationId: expect.any(String),
      },
    });
  });

  it('returns fail-closed 503 data preserving /cadence intent on HTTP 502 error response', async () => {
    const clientAction = createPrimaryRouteClientAction<PortalCadenceActionResult>('/cadence');
    const result = await clientAction(
      buildClientActionArgs('http://localhost/cadence', { intent: 'spec-approve' }, async () => {
        throw { status: 502, statusText: 'Bad Gateway', data: 'upstream nginx html' };
      }),
    );

    expect(result).toMatchObject({
      type: 'DataWithResponseInit',
      init: { status: 503 },
      data: {
        ok: false,
        intent: 'spec-approve',
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        action: expect.any(String),
        correlationId: expect.any(String),
      },
    });
  });

  it('returns fail-closed 504 data on TimeoutError for /contact', async () => {
    const clientAction = createPrimaryRouteClientAction<ContactActionResult>('/contact');
    const result = await clientAction(
      buildClientActionArgs('http://localhost/contact', { name: 'Ada' }, async () => {
        throw new Error('Upstream request timeout');
      }),
    );

    expect(result).toMatchObject({
      type: 'DataWithResponseInit',
      init: { status: 504 },
      data: {
        ok: false,
        source: 'server',
        code: 'ERR_STREAM_TIMEOUT',
        formError: 'Section took too long to load.',
        fieldErrors: {},
        action: expect.any(String),
        correlationId: expect.any(String),
      },
    });
  });
});
