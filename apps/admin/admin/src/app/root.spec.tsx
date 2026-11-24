import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import AdminRoot from './root';

describe('AdminRoot', () => {
  it('renders the isolated cadence-admin passkey gate chrome', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: AdminRoot,
          children: [{ index: true, Component: () => <div>Admin Probe</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText('admin.andrew-k.us :: cadence-admin')).toBeTruthy();
    expect(screen.getByText('Passkey Auth Required')).toBeTruthy();
    expect(screen.getByText('Admin Probe')).toBeTruthy();
  });
});
