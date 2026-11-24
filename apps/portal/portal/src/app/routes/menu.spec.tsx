import type { PortalMenuLoaderData } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalMenuRoute, { meta } from './menu';

const MENU_FIXTURE: PortalMenuLoaderData = {
  content: {
    heading: 'Launch Menu',
    description: 'Select a Solar Forge module by keybinding or click.',
    localTargetLabel: 'local-ssr',
  },
  items: [
    {
      slug: 'cadence',
      keyShortcut: '1',
      title: 'CADENCE Builder',
      description: 'Interactive spec-to-artifact sandbox',
      targetK8sDeploy: 'svc-cadence-demo',
      namespace: 'portfolio-public',
      adminOnly: false,
      sortOrder: 1,
      enabled: true,
    },
    {
      slug: 'contact',
      keyShortcut: '4',
      title: 'Contact Channel',
      description: 'Recursive TUI contact form',
      targetK8sDeploy: null,
      namespace: 'portfolio-public',
      adminOnly: false,
      sortOrder: 4,
      enabled: true,
    },
    {
      slug: 'cadence-admin',
      keyShortcut: '9',
      title: 'Admin Console',
      description: 'Isolated ops view',
      targetK8sDeploy: 'svc-admin',
      namespace: 'portfolio-admin',
      adminOnly: true,
      sortOrder: 9,
      enabled: true,
    },
  ],
};

describe('PortalMenuRoute', () => {
  it('builds page meta from loaderData and falls back when loaderData is absent', () => {
    const withData = meta({
      loaderData: MENU_FIXTURE,
      matches: [],
      location: { pathname: '/menu', search: '', hash: '', state: null, key: 'm1' },
      params: {},
    } as Parameters<typeof meta>[0]);
    expect(withData).toContainEqual({ title: 'Launch Menu // andrew-k.us' });

    const withoutData = meta({
      loaderData: undefined,
      matches: [],
      location: { pathname: '/menu', search: '', hash: '', state: null, key: 'm2' },
      params: {},
    } as Parameters<typeof meta>[0]);
    expect(withoutData).toContainEqual({ title: 'Launch Menu // andrew-k.us' });
  });

  it('filters out adminOnly items for guests and navigates via numeric keybindings', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/menu',
          loader: (): PortalMenuLoaderData => MENU_FIXTURE,
          Component: () => (
            <div>
              <input aria-label='Filter probe' />
              <PortalMenuRoute />
            </div>
          ),
        },
        { path: '/cadence', Component: () => <div>Cadence Route</div> },
        { path: '/contact', Component: () => <div>Contact Route</div> },
        { path: '/', Component: () => <div>Home Route</div> },
      ],
      { initialEntries: ['/menu'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    expect(screen.getByText(/CADENCE Builder/)).toBeTruthy();
    expect(screen.getByText('local-ssr')).toBeTruthy();
    expect(screen.queryByText(/Admin Console/)).toBeNull();

    // Shortcuts ignored while focused in an input element
    const probeInput = screen.getByLabelText('Filter probe');
    fireEvent.keyDown(probeInput, { key: '1' });
    expect(router.state.location.pathname).toBe('/menu');

    // Shortcuts ignored when modifier keys are pressed
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(router.state.location.pathname).toBe('/menu');

    // Pressing `1` launches /cadence
    fireEvent.keyDown(window, { key: '1' });
    expect(await screen.findByText('Cadence Route')).toBeTruthy();
  });

  it('returns to / when Escape closes the TUI menu window', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/menu',
          loader: (): PortalMenuLoaderData => MENU_FIXTURE,
          Component: PortalMenuRoute,
        },
        { path: '/', Component: () => <div>Home Route</div> },
      ],
      { initialEntries: ['/menu'] },
    );

    render(<RouterProvider router={router} />);
    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('Home Route')).toBeTruthy();
  });
});
