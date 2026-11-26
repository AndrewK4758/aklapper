import type { ContactActionResult } from '@aklapper/core';
import type { ClientActionFunctionArgs } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import type { PortalAskActionResult } from '#pages/ask';
import type { PortalCadenceActionResult } from '#pages/cadence';

import { BEFOREUNLOAD_RESET_MS } from '../workspace/unloadGuard';
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
    serverAction: serverAction as ClientActionFunctionArgs['serverAction'],
  } as ClientActionFunctionArgs;
}

describe('createPrimaryRouteClientAction', () => {
  it('passes through successful serverAction responses', async () => {
    const clientAction = createPrimaryRouteClientAction<ContactActionResult>('/contact');
    const okPayload: ContactActionResult = {
      ok: true,
      submission: {
        id: 'contact-1',
        name: 'Ada',
        email: 'ada@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-25T00:00:00Z',
      },
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
      headers: { Location: '/contact' },
    });
    await expect(
      clientAction(
        buildClientActionArgs('http://localhost/contact', {}, async () => {
          throw redirectResponse;
        }),
      ),
    ).rejects.toBe(redirectResponse);
  });

  it('re-throws AbortError without synthesizing a 503 error result during navigation or reload unload', async () => {
    const clientAction = createPrimaryRouteClientAction<PortalAskActionResult>('/chat');
    const abortErr = new DOMException('Aborted', 'AbortError');
    await expect(
      clientAction(
        buildClientActionArgs('http://localhost/chat', { mode: 'jd_match' }, async () => {
          throw abortErr;
        }),
      ),
    ).rejects.toBe(abortErr);
  });

  it('clears transient beforeunload state when unload is cancelled so offline/502 actions still classify fail-closed as 503', async () => {
    vi.useFakeTimers();
    try {
      const clientAction = createPrimaryRouteClientAction<PortalAskActionResult>('/chat');
      const deferred = Promise.withResolvers<unknown>();

      const inFlightPromise = clientAction(
        buildClientActionArgs(
          'http://localhost/chat',
          { mode: 'jd_match' },
          () => deferred.promise,
        ),
      );

      // Simulate user triggering beforeunload and then cancelling ("Stay on page", no pagehide/pageshow)
      await Promise.resolve();
      window.dispatchEvent(new Event('beforeunload'));
      await vi.advanceTimersByTimeAsync(BEFOREUNLOAD_RESET_MS + 10);

      // Rejecting after cancelled beforeunload MUST still classify fail-closed as 503
      deferred.reject(new TypeError('Failed to fetch'));
      const resumedResult = await inFlightPromise;
      expect(resumedResult).toMatchObject({
        type: 'DataWithResponseInit',
        init: { status: 503 },
        data: {
          ok: false,
          mode: 'jd_match',
          code: 'ERR_UPSTREAM_UNAVAILABLE',
        },
      });

      // And a subsequent action invocation also classifies fail-closed cleanly
      const nextResult = await clientAction(
        buildClientActionArgs('http://localhost/chat', { mode: 'qa' }, async () => {
          throw { status: 502, statusText: 'Bad Gateway', data: 'proxy error' };
        }),
      );
      expect(nextResult).toMatchObject({
        type: 'DataWithResponseInit',
        init: { status: 503 },
        data: {
          ok: false,
          mode: 'qa',
          code: 'ERR_UPSTREAM_UNAVAILABLE',
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-throws network errors during genuine pagehide unload without leaking listeners to later invocations', async () => {
    const clientAction = createPrimaryRouteClientAction<PortalAskActionResult>('/chat');
    const deferred = Promise.withResolvers<unknown>();
    const networkErr = new TypeError('NetworkError when attempting to fetch resource.');

    const inFlight = clientAction(
      buildClientActionArgs('http://localhost/chat', { mode: 'jd_match' }, () => deferred.promise),
    );
    await Promise.resolve();
    window.dispatchEvent(new Event('pagehide'));
    deferred.reject(networkErr);

    await expect(inFlight).rejects.toBe(networkErr);

    // Next invocation starts with a fresh per-invocation tracker (never stuck unloading)
    const afterResult = await clientAction(
      buildClientActionArgs('http://localhost/chat', { mode: 'jd_match' }, async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    expect(afterResult).toMatchObject({
      type: 'DataWithResponseInit',
      init: { status: 503 },
      data: { ok: false, mode: 'jd_match', code: 'ERR_UPSTREAM_UNAVAILABLE' },
    });
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
