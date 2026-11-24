import type { AdminRootLoaderData } from '@aklapper/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterContextProvider, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  resolveAdminSessionFromRequest: vi.fn<(request: Request) => Promise<unknown>>(),
}));

const dbMocks = vi.hoisted(() => ({
  loadAdminRootDataWithPrerender: vi.fn<() => Promise<unknown>>(),
}));

vi.mock('@aklapper/db/auth', () => authMocks);
vi.mock('@aklapper/db', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/db')>();
  return {
    ...actual,
    loadAdminRootDataWithPrerender: dbMocks.loadAdminRootDataWithPrerender,
  };
});

import AdminRoot, { loader } from './root';

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
    expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
  });

  it('renders session handle and Sign Out button when admin session is active', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ loggedOut: true }), { status: 200 }));

    const router = createMemoryRouter(
      [
        {
          path: '/',
          loader: (): AdminRootLoaderData => ({
            ...ADMIN_ROOT_FIXTURE,
            session: {
              sessionId: '11111111-1111-4111-8111-111111111111',
              role: 'admin',
              handle: 'aklapper',
              expiresAt: '2026-12-01T00:00:00.000Z',
            },
          }),
          Component: AdminRoot,
          children: [{ index: true, Component: () => <div>Ops Ready</div> }],
        },
      ],
      { initialEntries: ['/'] },
    );

    try {
      render(<RouterProvider router={router} />);

      expect(await screen.findByText('aklapper@admin')).toBeTruthy();
      expect(screen.getByText('Passkey Verified')).toBeTruthy();
      const signOutBtn = screen.getByRole('button', { name: 'Sign Out' });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('redirects unauthenticated requests to /login with sanitized next target', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });

    const reqUrl = new URL('http://localhost:4301/analytics?tab=vitals');
    const thrown = await loader({
      request: new Request(reqUrl),
      url: reqUrl,
      pattern: '/',
      params: {},
      context: new RouterContextProvider(),
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?next=%2Fanalytics%3Ftab%3Dvitals');
  });

  it('allows unauthenticated /login without terminal workspace', async () => {
    authMocks.resolveAdminSessionFromRequest.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });
    dbMocks.loadAdminRootDataWithPrerender.mockResolvedValueOnce({
      ...ADMIN_ROOT_FIXTURE,
      terminal: { slug: 'admin-ops' },
    });

    const loginUrl = new URL('http://localhost:4301/login');
    const data = await loader({
      request: new Request(loginUrl),
      url: loginUrl,
      pattern: '/',
      params: {},
      context: new RouterContextProvider(),
    });

    expect(data.session).toBeNull();
    expect(data.terminal).toBeUndefined();
  });
});
