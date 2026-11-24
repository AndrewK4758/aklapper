import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalRoot from './root';

describe('PortalRoot', () => {
  it('renders the Solar Forge portal chrome without admin leakage', () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: PortalRoot,
          children: [{ index: true, Component: () => <div>Home Probe</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByText('andrew-k.us :: tty1')).toBeTruthy();
    expect(screen.getByText('Home Probe')).toBeTruthy();
    expect(screen.queryByText('cadence-admin')).toBeNull();
  });
});
