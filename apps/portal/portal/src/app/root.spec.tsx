import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalRoot from './root';

describe('PortalRoot', () => {
  it('renders the Solar Forge portal chrome without admin leakage', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => ({ maintenanceMode: false }),
          Component: PortalRoot,
          children: [{ index: true, Component: () => <div>Home Probe</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('andrew-k.us :: tty1')).toBeTruthy();
    expect(screen.getByText('Home Probe')).toBeTruthy();
    expect(screen.queryByText('cadence-admin')).toBeNull();
  });

  it('renders Changes in Progress with zero navigation links in maintenance mode', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: () => ({ maintenanceMode: true }),
          Component: PortalRoot,
          children: [{ index: true, Component: () => <div>Should Not Render</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Changes in Progress' })).toBeTruthy();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('Should Not Render')).toBeNull();

    const input = screen.getByLabelText('Zsh command input');
    fireEvent.change(input, { target: { value: 'whoami' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText(/visitor@andrew-k\.us \(read-only maintenance tty1\)/)).toBeTruthy();
  });
});
