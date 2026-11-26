import {
  CONTACT_FORM_DEFINITION,
  type ContactActionResult,
  type ContactSubmissionSummary,
  type PortalContactLoaderData,
  type StreamResult,
} from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalContactRoute, { ErrorBoundary, meta } from './contact';

const CONTACT_LOADER_FIXTURE: PortalContactLoaderData = {
  content: {
    windowTitle: 'tui :: andrew-k.us // contact',
    statusBadge: {
      source: 'contact-form',
      state: 'ready',
      label: 'zod + pg19',
    },
    description: 'Send a validated message directly into Postgres 19.',
    form: CONTACT_FORM_DEFINITION,
  },
};

describe('PortalContactRoute', () => {
  it('builds synchronous route meta without awaiting deferred payload', () => {
    const pending = Promise.withResolvers<StreamResult<PortalContactLoaderData>>();
    const loaderData = { correlationId: 'corr-contact-meta', payload: pending.promise };
    const tags = meta({
      loaderData,
      matches: [
        {
          id: 'root',
          params: {},
          pathname: '/',
          meta: [],
          loaderData: {
            runtimeSeo: { siteUrl: 'https://andrew-k.us' },
            correlationId: 'corr-root',
            initialViewport: 'desktop',
            isNotFound: false,
            rootPayload: Promise.withResolvers<never>().promise,
          },
        },
        { id: 'routes/contact', params: {}, pathname: '/contact', meta: [], loaderData },
      ],
      location: { pathname: '/contact', search: '', hash: '', state: null, key: 'c1' },
      params: {},
    });

    expect(tags).toContainEqual({ title: 'Contact // andrew-k.us' });
    expect(tags).toContainEqual(
      expect.objectContaining({
        name: 'description',
        content: expect.stringContaining('PostgreSQL 19'),
      }),
    );
  });

  it('streams contact form, displays Postgres receipt on submit, and resets via New Transmission', async () => {
    const receipt: ContactSubmissionSummary = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '+1 555-0100',
      attachmentName: 'notes.txt',
      attachmentSizeBytes: 24,
      attachmentSha256: 'b'.repeat(64),
      createdAt: '2026-11-24T13:00:00.000Z',
    };

    const deferred = Promise.withResolvers<StreamResult<PortalContactLoaderData>>();
    const Stub = createRoutesStub([
      {
        path: '/contact',
        loader: () => ({
          correlationId: 'corr-contact-1',
          payload: deferred.promise,
        }),
        action: (): ContactActionResult => ({ ok: true, submission: receipt }),
        Component: PortalContactRoute,
        ErrorBoundary,
      },
      {
        path: '/',
        Component: () => <div>Home Destination</div>,
      },
    ]);

    render(<Stub initialEntries={['/contact']} />);

    expect(await screen.findByRole('status')).toBeTruthy();

    deferred.resolve({ ok: true, data: CONTACT_LOADER_FIXTURE });
    expect(await screen.findByText(/01 \/\/ Sender Identity/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Message\b/i), {
      target: { value: 'Submitting through React Router routes stub.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Transmit Message/i }));

    expect(await screen.findByTestId('contact-receipt')).toBeTruthy();
    expect(screen.getByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/i)).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace <ada@example\.com>/i)).toBeTruthy();
    expect(screen.getByText(/\+1 555-0100/)).toBeTruthy();
    expect(screen.getByText(/notes\.txt \(24 B · sha256:bbbbbbbbbbbb…\)/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /New Transmission/i }));
    expect(screen.queryByTestId('contact-receipt')).toBeNull();
    expect(screen.getByRole('button', { name: /Transmit Message/i })).toBeTruthy();
  });

  it('displays 503 error code, action, and correlationId while preserving user draft inputs', async () => {
    const Stub = createRoutesStub([
      {
        path: '/contact',
        loader: () => ({
          correlationId: 'corr-contact-503-load',
          payload: Promise.resolve<StreamResult<PortalContactLoaderData>>({
            ok: true,
            data: CONTACT_LOADER_FIXTURE,
          }),
        }),
        action: (): ContactActionResult => ({
          ok: false,
          source: 'database',
          formError: 'Database temporarily unavailable.',
          fieldErrors: {},
          code: 'ERR_DB_UNAVAILABLE',
          action: 'Retry shortly or share ID.',
          correlationId: 'corr-contact-503',
        }),
        Component: PortalContactRoute,
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/contact']} />);
    expect(await screen.findByText(/01 \/\/ Sender Identity/i)).toBeTruthy();

    const nameInput = screen.getByLabelText(/Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    const messageInput = screen.getByLabelText(/^Message\b/i) as HTMLTextAreaElement;

    fireEvent.change(nameInput, { target: { value: 'Grace Hopper' } });
    fireEvent.change(emailInput, { target: { value: 'grace@example.com' } });
    fireEvent.change(messageInput, {
      target: { value: 'Draft text must remain intact across 503 database outages.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Transmit Message/i }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-contact-503');
    expect(nameInput.value).toBe('Grace Hopper');
    expect(emailInput.value).toBe('grace@example.com');
    expect(messageInput.value).toContain('Draft text must remain intact');
  });
});
