import {
  CONTACT_FORM_DEFINITION,
  createPublicAppError,
  type PublicAppError,
  type StreamResult,
} from '@aklapper/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createRoutesStub, data } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ErrorElement,
  LoadingElement,
  RecursiveTuiForm,
  resolveTerminalFormSubmitResult,
  RouteErrorBoundaryView,
  startTerminalFormSession,
  SuspenseElement,
} from '../src';

interface SamplePayload {
  readonly heading: string;
  readonly count: number;
}

describe('Streaming Suspense and Error UI primitives', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders accessible LoadingElement while pending and typed content on success', async () => {
    const deferred = Promise.withResolvers<StreamResult<SamplePayload>>();

    const Stub = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <SuspenseElement<SamplePayload>
              resolve={deferred.promise}
              loadingLabel='Streaming route data...'
            >
              {payload => (
                <article>
                  <h2>{payload.heading}</h2>
                  <span>count:{payload.count}</span>
                </article>
              )}
            </SuspenseElement>
          );
        },
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toContain('Streaming route data...');

    await act(async () => {
      deferred.resolve({ ok: true, data: { heading: 'Menu Ready', count: 7 } });
      await deferred.promise;
    });

    expect(await screen.findByText('Menu Ready')).toBeTruthy();
    expect(screen.getByText('count:7')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders already-resolved StreamResult envelopes and standalone LoadingElement detail', () => {
    const immediate: StreamResult<SamplePayload> = {
      ok: true,
      data: { heading: 'Sync Envelope', count: 3 },
    };

    const Stub = createRoutesStub([
      {
        path: '/',
        Component() {
          return (
            <>
              <LoadingElement label='Hydrating workspace' detail='Connecting to upstream...' />
              <SuspenseElement<SamplePayload> resolve={immediate}>
                {payload => <p>{payload.heading}</p>}
              </SuspenseElement>
            </>
          );
        },
      },
    ]);

    render(<Stub initialEntries={['/']} />);

    expect(screen.getByRole('status').textContent).toContain('Connecting to upstream...');
    expect(screen.getByText('Sync Envelope')).toBeTruthy();
  });

  it('renders accessible ErrorElement on settled failure, reports once in StrictMode, and supports keyboard retry', async () => {
    const user = userEvent.setup();
    const onStreamError = vi.fn<(error: PublicAppError) => void>();
    const settledError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-503',
    });

    let loadCount = 0;
    const Stub = createRoutesStub([
      {
        path: '/',
        loader() {
          loadCount += 1;
          if (loadCount === 1) {
            return {
              payload: Promise.resolve<StreamResult<SamplePayload>>({
                ok: false,
                error: settledError,
              }),
            };
          }
          return {
            payload: Promise.resolve<StreamResult<SamplePayload>>({
              ok: true,
              data: { heading: 'Recovered After Retry', count: loadCount },
            }),
          };
        },
        Component({ loaderData }) {
          const typed = loaderData as { payload: Promise<StreamResult<SamplePayload>> };
          return (
            <SuspenseElement<SamplePayload>
              resolve={typed.payload}
              correlationId='corr-503'
              onStreamError={onStreamError}
            >
              {payload => <p>{payload.heading}</p>}
            </SuspenseElement>
          );
        },
      },
    ]);

    render(
      <StrictMode>
        <Stub initialEntries={['/']} />
      </StrictMode>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-503');
    expect(onStreamError).toHaveBeenCalledTimes(1);
    expect(onStreamError).toHaveBeenCalledWith(settledError);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    retryButton.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Recovered After Retry')).toBeTruthy();
    expect(loadCount).toBe(2);
  });

  it('catches rejected Server Timeout and AbortError promises in Await error boundary without leaking raw stacks', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onStreamError = vi.fn<(error: PublicAppError) => void>();
    const transportErr = new Error('Server Timeout at /srv/internal/db.ts:88:12');
    transportErr.stack = 'Error: Server Timeout\n    at secretFn (/srv/internal/db.ts:88:12)';
    const abortErr = new DOMException('Client disconnected', 'AbortError');

    let attempt = 0;
    const Stub = createRoutesStub([
      {
        path: '/',
        loader() {
          attempt += 1;
          if (attempt === 1) {
            const p = Promise.reject<StreamResult<SamplePayload>>(transportErr);
            p.catch(() => undefined);
            return { payload: p };
          }
          const p = Promise.reject<StreamResult<SamplePayload>>(abortErr);
          p.catch(() => undefined);
          return { payload: p };
        },
        Component({ loaderData }) {
          const typed = loaderData as { payload: Promise<StreamResult<SamplePayload>> };
          return (
            <SuspenseElement<SamplePayload>
              resolve={typed.payload}
              correlationId='corr-timeout-9'
              onStreamError={onStreamError}
            >
              {payload => <p>{payload.heading}</p>}
            </SuspenseElement>
          );
        },
      },
    ]);

    render(
      <StrictMode>
        <Stub initialEntries={['/']} />
      </StrictMode>,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_STREAM_TIMEOUT');
    expect(alert.textContent).toContain('corr-timeout-9');
    expect(alert.textContent).not.toContain('/srv/internal/db.ts');
    expect(alert.textContent).not.toContain('secretFn');
    expect(onStreamError).toHaveBeenCalledTimes(1);
    expect(onStreamError.mock.calls[0]?.[0]?.code).toBe('ERR_STREAM_TIMEOUT');

    await user.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('ERR_STREAM_ABORTED');
    });
    expect(onStreamError).toHaveBeenCalledTimes(2);
    expect(onStreamError.mock.calls[1]?.[0]?.code).toBe('ERR_STREAM_ABORTED');
    consoleErrorSpy.mockRestore();
  });

  it('normalizes 404 RouteErrorResponse, wrapped 503 PublicAppError data responses, and unknown thrown errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onBoundaryError = vi.fn<(error: PublicAppError) => void>();
    const authOutageError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-admin-503',
    });

    const Stub = createRoutesStub([
      {
        path: '/missing',
        loader() {
          throw data('Not Found', { status: 404, statusText: 'Not Found' });
        },
        Component: () => null,
        ErrorBoundary({ error }) {
          return <RouteErrorBoundaryView error={error} correlationId='corr-404' homeHref='/' />;
        },
      },
      {
        path: '/outage',
        loader() {
          throw data(authOutageError, { status: 503 });
        },
        Component: () => null,
        ErrorBoundary({ error }) {
          return <RouteErrorBoundaryView error={error} homeHref='/' onError={onBoundaryError} />;
        },
      },
      {
        path: '/crash',
        loader() {
          const err = new Error('EACCES reading /etc/secrets/db.conf:19:4');
          err.stack = 'Error: EACCES\n    at loadSecret (/srv/app/secret.ts:42:9)';
          throw err;
        },
        Component: () => null,
        ErrorBoundary({ error }) {
          return (
            <RouteErrorBoundaryView
              error={error}
              correlationId='corr-500'
              homeHref='/'
              onError={onBoundaryError}
            />
          );
        },
      },
    ]);

    const first = render(<Stub initialEntries={['/missing']} />);
    const notFoundAlert = await screen.findByRole('alert');
    expect(notFoundAlert.textContent).toContain('ERR_NOT_FOUND');
    expect(notFoundAlert.textContent).toContain('HTTP 404');
    expect(screen.getByRole('link', { name: /return home/i }).getAttribute('href')).toBe('/');
    first.unmount();

    const second = render(
      <StrictMode>
        <Stub initialEntries={['/outage']} />
      </StrictMode>,
    );
    const outageAlert = await screen.findByRole('alert');
    expect(outageAlert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(outageAlert.textContent).toContain('HTTP 503');
    expect(outageAlert.textContent).toContain('corr-admin-503');
    expect(onBoundaryError).toHaveBeenCalledTimes(1);
    second.unmount();

    const third = render(
      <StrictMode>
        <Stub initialEntries={['/crash']} />
      </StrictMode>,
    );
    await waitFor(() => {
      const crashAlert = screen.getByRole('alert');
      expect(crashAlert.textContent).toContain('ERR_INTERNAL');
      expect(crashAlert.textContent).toContain('corr-500');
      expect(crashAlert.textContent).not.toContain('/etc/secrets/db.conf');
      expect(crashAlert.textContent).not.toContain('/srv/app/secret.ts');
      expect(crashAlert.textContent).not.toContain('loadSecret');
    });
    expect(onBoundaryError).toHaveBeenCalledTimes(2);
    third.unmount();
    consoleErrorSpy.mockRestore();
  });

  it('renders standalone ErrorElement outside router context with plain anchor fallback', () => {
    const err = createPublicAppError({
      code: 'ERR_INTERNAL',
      status: 500,
      message: 'Unexpected server error.',
      action: 'Retry or share the reference ID.',
      correlationId: 'corr-standalone',
    });
    render(<ErrorElement error={err} homeHref='/' />);
    expect(screen.getByRole('alert').textContent).toContain('corr-standalone');
    expect(screen.getByRole('link', { name: /return home/i }).getAttribute('href')).toBe('/');
  });

  it('gates RecursiveTuiForm server error metadata on absence of client validation errors', () => {
    render(
      <RecursiveTuiForm
        definition={CONTACT_FORM_DEFINITION}
        serverFormError='Database temporarily unavailable.'
        errorSource='database'
        errorCode='ERR_DB_UNAVAILABLE'
        errorAction='Retry shortly or share ID.'
        correlationId='corr-tui-503'
      />,
    );

    const serverAlert = screen.getByRole('alert');
    expect(serverAlert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(serverAlert.textContent).toContain('Retry shortly or share ID.');
    expect(serverAlert.textContent).toContain('corr-tui-503');

    fireEvent.click(screen.getByRole('button', { name: /transmit message/i }));

    const clientBanner = screen.getAllByRole('alert')[0];
    expect(clientBanner?.textContent).toContain('[client]');
    expect(clientBanner?.textContent).not.toContain('ERR_DB_UNAVAILABLE');
    expect(clientBanner?.textContent).not.toContain('Retry shortly or share ID.');
    expect(clientBanner?.textContent).not.toContain('corr-tui-503');
  });

  it('formats error code, action, and correlationId in resolveTerminalFormSubmitResult while preserving review draft', () => {
    const started = startTerminalFormSession(
      CONTACT_FORM_DEFINITION,
      'contact --name "Ada" --email "ada@example.com" --message "Checking retry persistence."',
    );
    expect(started.kind).toBe('submit-immediately');
    if (started.kind !== 'submit-immediately') return;

    const resolved = resolveTerminalFormSubmitResult(started.session, {
      ok: false,
      source: 'database',
      formError: 'Database temporarily unavailable.',
      fieldErrors: {},
      code: 'ERR_DB_UNAVAILABLE',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-term-503',
    });

    expect(resolved.status).toBe('error');
    expect(resolved.session?.phase).toBe('review');
    expect(resolved.session?.textValues['email']).toBe('ada@example.com');
    expect(resolved.output).toContain('[database] Database temporarily unavailable.');
    expect(resolved.output).toContain('ERR_DB_UNAVAILABLE');
    expect(resolved.output).toContain('Retry shortly or share ID.');
    expect(resolved.output).toContain('corr-term-503');
  });
});
