import type { AdminRootLoaderData } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import AdminRoot from './root';

const ADMIN_ROOT_FIXTURE: AdminRootLoaderData = {
  chrome: {
    pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
    brandLabel: 'admin.andrew-k.us :: cadence-admin',
    statusBadge: {
      source: 'cadence-admin',
      state: 'gate',
      label: 'Passkey Auth Required',
    },
  },
};

describe('AdminRoot', () => {
  it('renders the isolated cadence-admin passkey gate chrome from loader data', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminRootLoaderData => ADMIN_ROOT_FIXTURE,
          Component: AdminRoot,
          children: [{ index: true, Component: () => <div>Admin Probe</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('admin.andrew-k.us :: cadence-admin')).toBeTruthy();
    expect(screen.getByText('Passkey Auth Required')).toBeTruthy();
    expect(screen.getByText('Admin Probe')).toBeTruthy();
  });
});
