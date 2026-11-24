import { createHash } from 'node:crypto';

import {
  CONTACT_FORM_DEFINITION,
  type ContactActionResult,
  type ContactFormSubmission,
  type ContactSubmissionSummary,
  type PortalContactLoaderData,
} from '@aklapper/core';
import { ContactDbConstraintError } from '@aklapper/db';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getSharedDbMock, loadPortalContactDataMock, insertContactSubmissionMock } = vi.hoisted(
  () => ({
    getSharedDbMock: vi.fn<() => Record<string, never>>(() => ({})),
    loadPortalContactDataMock: vi.fn<() => Promise<PortalContactLoaderData>>(),
    insertContactSubmissionMock:
      vi.fn<
        (db: unknown, submission: ContactFormSubmission) => Promise<ContactSubmissionSummary>
      >(),
  }),
);

vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    getSharedDb: getSharedDbMock,
    loadPortalContactData: loadPortalContactDataMock,
    insertContactSubmission: insertContactSubmissionMock,
  };
});

import PortalContactRoute, { action, meta } from './contact';

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

function makeActionArgs(formDataImpl: () => Promise<FormData>): Parameters<typeof action>[0] {
  return {
    request: { formData: formDataImpl } as unknown as Request,
    params: {},
    context: {} as Parameters<typeof action>[0]['context'],
    unstable_pattern: '/contact',
    url: new URL('http://localhost/contact'),
    pattern: '/contact',
  } as Parameters<typeof action>[0];
}

function makeFileWithBuffer(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  if (typeof file.arrayBuffer !== 'function') {
    const encoded = new TextEncoder().encode(content);
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () =>
        encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength),
    });
  }
  return file;
}

function unwrapDataResult(result: Awaited<ReturnType<typeof action>>) {
  if (result instanceof Response) {
    throw new Error('Expected DataWithResponseInit, received Response');
  }
  return result;
}

describe('PortalContactRoute & action', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('builds route meta with loader description and fallback description', () => {
    const withLoader = meta({
      loaderData: CONTACT_LOADER_FIXTURE,
      matches: [],
      location: { pathname: '/contact', search: '', hash: '', state: null, key: 'c1' },
      params: {},
    } as Parameters<typeof meta>[0]);
    expect(withLoader).toContainEqual({ title: 'Contact // andrew-k.us' });
    expect(withLoader).toContainEqual({
      name: 'description',
      content: CONTACT_LOADER_FIXTURE.content.description,
    });

    const fallback = meta({
      loaderData: undefined,
      matches: [],
      location: { pathname: '/contact', search: '', hash: '', state: null, key: 'c2' },
      params: {},
    } as Parameters<typeof meta>[0]);
    expect(fallback).toContainEqual(
      expect.objectContaining({
        name: 'description',
        content: expect.stringContaining('PostgreSQL 19'),
      }),
    );
  });

  it('rejects malformed non-multipart payloads with 400', async () => {
    const res = unwrapDataResult(
      await action(
        makeActionArgs(async () => {
          throw new TypeError('Invalid multipart body');
        }),
      ),
    );

    expect(res.init?.status).toBe(400);
    expect(res.data).toMatchObject({
      ok: false,
      source: 'server',
      formError: expect.stringMatching(/Malformed form submission/i),
    });
    expect(insertContactSubmissionMock).not.toHaveBeenCalled();
  });

  it('rejects invalid fields and disallowed attachments with 400 on the server', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);

    const missingFd = new FormData();
    missingFd.set('name', '');
    missingFd.set('email', 'not-an-email');
    missingFd.set('phone', '12');
    missingFd.set('message', 'short');

    const invalidFieldsRes = unwrapDataResult(await action(makeActionArgs(async () => missingFd)));
    expect(invalidFieldsRes.init?.status).toBe(400);
    expect(invalidFieldsRes.data).toMatchObject({
      ok: false,
      source: 'server',
      fieldErrors: {
        name: expect.any(Array),
        email: expect.any(Array),
        phone: expect.any(Array),
        message: expect.any(Array),
      },
    });

    // Disallowed file extension even with text/plain MIME spoofing
    const badFileFd = new FormData();
    badFileFd.set('name', 'Grace Hopper');
    badFileFd.set('email', 'grace@example.com');
    badFileFd.set('message', 'Testing server-side attachment extension enforcement.');
    badFileFd.set('file', makeFileWithBuffer('#!/bin/sh', 'exploit.sh', 'text/plain'));

    const badFileRes = unwrapDataResult(await action(makeActionArgs(async () => badFileFd)));
    expect(badFileRes.init?.status).toBe(400);
    expect(badFileRes.data).toMatchObject({
      ok: false,
      source: 'server',
      fieldErrors: {
        file: expect.any(Array),
      },
    });
    expect(insertContactSubmissionMock).not.toHaveBeenCalled();
  });

  it('persists valid submissions with SHA-256 attachment metadata and returns 201', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    const payloadText = 'FLOW-MATIC compiler specification';
    const expectedSha = createHash('sha256').update(Buffer.from(payloadText)).digest('hex');

    const summary: ContactSubmissionSummary = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '+1 (555) 867-5309',
      attachmentName: 'spec.txt',
      attachmentSizeBytes: Buffer.byteLength(payloadText),
      attachmentSha256: expectedSha,
      createdAt: '2026-11-24T12:34:56.000Z',
    };
    insertContactSubmissionMock.mockResolvedValue(summary);

    const validFd = new FormData();
    validFd.set('name', '  Grace Hopper ');
    validFd.set('email', 'GRACE@EXAMPLE.COM');
    validFd.set('phone', '+1 (555) 867-5309');
    validFd.set('message', 'Testing valid multipart submission with attachment.');
    validFd.set('file', makeFileWithBuffer(payloadText, '../spec.txt', 'text/plain'));

    const res = unwrapDataResult(await action(makeActionArgs(async () => validFd)));
    expect(res.init?.status).toBe(201);
    expect(res.data).toEqual({ ok: true, submission: summary });
    expect(insertContactSubmissionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        name: 'Grace Hopper',
        email: 'grace@example.com',
        phone: '+1 (555) 867-5309',
        attachment: {
          filename: 'spec.txt',
          mimeType: 'text/plain',
          sizeBytes: Buffer.byteLength(payloadText),
          sha256: expectedSha,
          contentBase64: Buffer.from(payloadText).toString('base64'),
        },
      }),
    );
  });

  it('maps ContactDbConstraintError to 422 database error result and re-throws unexpected errors', async () => {
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    insertContactSubmissionMock.mockRejectedValueOnce(
      new ContactDbConstraintError(
        'contact_email_format_check',
        { email: ['Database constraint rejected Email format.'] },
        'Database constraint rejected Email format.',
      ),
    );

    const fd = new FormData();
    fd.set('name', 'Ada Lovelace');
    fd.set('email', 'ada@example.com');
    fd.set('message', 'Triggering mocked Postgres 19 constraint error.');

    const dbErrRes = unwrapDataResult(await action(makeActionArgs(async () => fd)));
    expect(dbErrRes.init?.status).toBe(422);
    expect(dbErrRes.data).toEqual({
      ok: false,
      source: 'database',
      formError: 'Database constraint rejected Email format.',
      fieldErrors: { email: ['Database constraint rejected Email format.'] },
    });

    insertContactSubmissionMock.mockRejectedValueOnce(new Error('connection terminated'));
    await expect(action(makeActionArgs(async () => fd))).rejects.toThrow(/connection terminated/);
  });

  it('renders recursive contact form, displays Postgres receipt on submit, and resets via New Transmission', async () => {
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

    const router = createMemoryRouter(
      [
        {
          path: '/contact',
          loader: (): PortalContactLoaderData => CONTACT_LOADER_FIXTURE,
          action: (): ContactActionResult => ({ ok: true, submission: receipt }),
          Component: PortalContactRoute,
        },
        {
          path: '/',
          Component: () => <div>Home Destination</div>,
        },
      ],
      { initialEntries: ['/contact'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/01 \/\/ Sender Identity/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Message\b/i), {
      target: { value: 'Submitting through React Router memory router.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Transmit Message/i }));

    expect(await screen.findByTestId('contact-receipt')).toBeTruthy();
    expect(screen.getByText(/TRANSMISSION COMMITTED \/\/ POSTGRES 19/i)).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace <ada@example\.com>/i)).toBeTruthy();
    expect(screen.getByText(/\+1 555-0100/)).toBeTruthy();
    expect(screen.getByText(/notes\.txt \(24 B · sha256:bbbbbbbbbbbb…\)/)).toBeTruthy();

    // Clicking New Transmission dismisses the receipt and shows a fresh form
    fireEvent.click(screen.getByRole('button', { name: /New Transmission/i }));
    expect(screen.queryByTestId('contact-receipt')).toBeNull();
    expect(screen.getByRole('button', { name: /Transmit Message/i })).toBeTruthy();
  });

  it('returns raw JSON Response with HTTP status codes from /api/contact resource route', async () => {
    const { action: apiContactAction } = await import('./api.contact');
    loadPortalContactDataMock.mockResolvedValue(CONTACT_LOADER_FIXTURE);
    const summary: ContactSubmissionSummary = {
      id: '44444444-4444-4444-8444-444444444444',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: null,
      attachmentName: null,
      attachmentSizeBytes: null,
      attachmentSha256: null,
      createdAt: '2026-11-24T14:00:00.000Z',
    };
    insertContactSubmissionMock.mockResolvedValueOnce(summary);

    const makeJsonArgs = (fd: FormData): Parameters<typeof apiContactAction>[0] =>
      ({
        request: {
          headers: new Headers({ Accept: 'application/json' }),
          formData: async () => fd,
        } as unknown as Request,
        params: {},
        context: {} as Parameters<typeof apiContactAction>[0]['context'],
        unstable_pattern: '/api/contact',
        url: new URL('http://localhost/api/contact'),
        pattern: '/api/contact',
      }) as Parameters<typeof apiContactAction>[0];

    const validFd = new FormData();
    validFd.set('name', 'Ada Lovelace');
    validFd.set('email', 'ada@example.com');
    validFd.set('message', 'Submitting from inline terminal mode over JSON.');

    const okRes = await apiContactAction(makeJsonArgs(validFd));
    expect(okRes).toBeInstanceOf(Response);
    expect(okRes.status).toBe(201);
    expect(await okRes.json()).toEqual({ ok: true, submission: summary });

    insertContactSubmissionMock.mockRejectedValueOnce(
      new ContactDbConstraintError(
        'contact_email_format_check',
        { email: ['Database constraint rejected Email format.'] },
        'Database constraint rejected Email format.',
      ),
    );
    const dbErrRes = await apiContactAction(makeJsonArgs(validFd));
    expect(dbErrRes).toBeInstanceOf(Response);
    expect(dbErrRes.status).toBe(422);
    expect(await dbErrRes.json()).toEqual({
      ok: false,
      source: 'database',
      formError: 'Database constraint rejected Email format.',
      fieldErrors: { email: ['Database constraint rejected Email format.'] },
    });

    const honeypotFd = new FormData();
    honeypotFd.set('name', 'Bot Sender');
    honeypotFd.set('email', 'bot@example.com');
    honeypotFd.set('message', 'Honeypot test payload should be rejected.');
    honeypotFd.set('website', 'https://spam.example.invalid');
    const spamRes = await apiContactAction(makeJsonArgs(honeypotFd));
    expect(spamRes.status).toBe(400);
  });
});
