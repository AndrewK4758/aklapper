import type { ContactActionResult, PortalContactContent } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { PortalContactPage } from './index';

const CONTENT: PortalContactContent = {
  windowTitle: 'CONTACT // Direct Transmission',
  description: 'Direct TUI contact form.',
  statusBadge: { source: 'contact-form', state: 'ready', label: 'pg19 ready' },
  form: {
    id: 'contact',
    slug: 'contact',
    title: 'Direct Transmission',
    description: 'Send a validated transmission.',
    cliCommand: 'contact',
    submitLabel: 'Transmit',
    resetLabel: 'Reset',
    nodes: [
      {
        kind: 'field',
        id: 'contact-name',
        name: 'name',
        fieldType: 'text',
        label: 'Name',
        required: true,
        minLength: 2,
      },
    ],
  },
};

describe('portal/pages/contact', () => {
  it('renders a transmission receipt after submission', () => {
    const onClose = vi.fn<() => void>();
    const successResult: ContactActionResult = {
      ok: true,
      submission: {
        id: 'rcpt-001',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-24T00:00:00.000Z',
      },
    };

    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <PortalContactPage
            content={CONTENT}
            actionData={successResult}
            isSubmitting={false}
            onClose={onClose}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId('contact-receipt')).toBeTruthy();
    expect(screen.getByText('rcpt-001')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Return to Terminal' }).getAttribute('href')).toBe('/');
  });

  it('forwards structured error code, action, and correlationId into the form alert banner', () => {
    const failedResult: ContactActionResult = {
      ok: false,
      source: 'database',
      formError: 'Database temporarily unavailable.',
      fieldErrors: {},
      code: 'ERR_DB_UNAVAILABLE',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-contact-503',
    };

    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <PortalContactPage
            content={CONTENT}
            actionData={failedResult}
            isSubmitting={false}
            onClose={vi.fn<() => void>()}
          />
        ),
      },
    ]);

    render(<RouterProvider router={router} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Database temporarily unavailable.');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('Retry shortly or share ID.');
    expect(alert.textContent).toContain('corr-contact-503');
  });
});
