import type { AdminRootLoaderData, StreamResult } from '@aklapper/core';
import {
  buildRouteWorkspaceStorageKey,
  parseRouteWorkspaceSnapshot,
} from '@aklapper/ui/workspace-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRoutesStub, Link } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { adminRouteWorkspaceStore, resetAdminRootBranchTelemetryForTest } from './AdminRootShell';
import AdminRoot, { ErrorBoundary, shouldRevalidate } from './root';

const ADMIN_TERMINAL: NonNullable<AdminRootLoaderData['terminal']> = {
  slug: 'admin-ops',
  bannerTitle: 'Admin Terminal // tty1',
  bannerMeta: 'tty1 · ops',
  osLabel: '⚡',
  directory: '~/ops',
  vcsBranch: 'main',
  vcsState: 'clean',
  contextLabel: 'aklapper@admin',
  placeholder: 'type a command',
  quickCommands: ['status'],
  initialEntries: [],
  commands: [
    {
      name: 'status',
      description: 'status',
      kind: 'static',
      output: 'ADMIN_OK',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
  ],
};

const ADMIN_ROOT_DATA: AdminRootLoaderData = {
  chrome: {
    pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
    brandLabel: 'admin.andrew-k.us :: cadence-admin',
    shortcutHint: 'Alt+⇧N tab',
    statusBadge: {
      source: 'cadence-admin',
      state: 'gate',
      label: 'Passkey Auth Required',
    },
  },
  terminal: ADMIN_TERMINAL,
};

const ADMIN_SESSION = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  role: 'admin' as const,
  handle: 'aklapper',
  expiresAt: '2026-12-01T00:00:00.000Z',
};

describe('Admin route workspace keep-alive and sign-out security boundary', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    adminRouteWorkspaceStore.resetForTest();
    resetAdminRootBranchTelemetryForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    adminRouteWorkspaceStore.resetForTest();
    resetAdminRootBranchTelemetryForTest();
  });

  it('partitions workspaces across /analytics and /cms and synchronously purges all admin storage on Sign Out before fetch resolves', async () => {
    const portalKey = buildRouteWorkspaceStorageKey('portal', '/');
    window.sessionStorage.setItem(portalKey, '{"portal":"untouched"}');

    let storageClearedBeforeFetch = false;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      storageClearedBeforeFetch =
        window.sessionStorage.getItem(buildRouteWorkspaceStorageKey('admin', '/analytics')) ===
          null &&
        window.sessionStorage.getItem(buildRouteWorkspaceStorageKey('admin', '/cms')) === null;
      return new Response(JSON.stringify({ loggedOut: true }), { status: 200 });
    });

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-admin-ka',
          isLoginRoute: false,
          session: ADMIN_SESSION,
          authMeta: { totpEnabled: true, passkeyCount: 1 },
          rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
            ok: true,
            data: ADMIN_ROOT_DATA,
          }),
        }),
        shouldRevalidate,
        Component: AdminRoot,
        ErrorBoundary,
        children: [
          {
            path: 'analytics',
            Component: () => (
              <div>
                <span>Analytics View</span>
                <Link to='/cms'>Go CMS</Link>
              </div>
            ),
          },
          {
            path: 'cms',
            Component: () => (
              <div>
                <span>CMS View</span>
                <Link to='/analytics'>Go Analytics</Link>
              </div>
            ),
          },
        ],
      },
    ]);

    render(<Stub initialEntries={['/analytics']} />);
    await screen.findByText('Analytics View');

    // Create a second tab on /analytics
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    const analyticsSaved = window.sessionStorage.getItem(
      buildRouteWorkspaceStorageKey('admin', '/analytics'),
    );
    expect(analyticsSaved).not.toBeNull();
    expect(parseRouteWorkspaceSnapshot(analyticsSaved as string)?.tabs.tabs).toHaveLength(2);

    // Navigate to /cms and create a tab there too
    fireEvent.click(screen.getByRole('link', { name: 'Go CMS' }));
    await screen.findByText('CMS View');
    fireEvent.keyDown(window, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true });
    expect(
      window.sessionStorage.getItem(buildRouteWorkspaceStorageKey('admin', '/cms')),
    ).not.toBeNull();

    // Sign Out must synchronously clear admin storage BEFORE fetch('/api/auth/logout') runs
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
    });
    expect(storageClearedBeforeFetch).toBe(true);
    expect(window.sessionStorage.getItem(portalKey)).toBe('{"portal":"untouched"}');
  });

  it('clears stale admin workspace storage idempotently when rendering /login and emits admin-cleared telemetry', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const opsKey = buildRouteWorkspaceStorageKey('admin', '/ops');
    window.sessionStorage.setItem(opsKey, '{"stale":true}');

    const Stub = createRoutesStub([
      {
        id: 'root',
        path: '/',
        loader: () => ({
          runtimeSeo: { siteUrl: 'https://admin.andrew-k.us' },
          correlationId: 'corr-admin-login',
          isLoginRoute: true,
          session: null,
          authMeta: { totpEnabled: true, passkeyCount: 1 },
          rootPayload: Promise.resolve<StreamResult<AdminRootLoaderData>>({
            ok: true,
            data: { ...ADMIN_ROOT_DATA, terminal: undefined },
          }),
        }),
        Component: AdminRoot,
        ErrorBoundary,
        children: [{ path: 'login', Component: () => <div>Admin Login Form</div> }],
      },
    ]);

    render(<Stub initialEntries={['/login']} />);
    await screen.findByText('Admin Login Form');

    expect(window.sessionStorage.getItem(opsKey)).toBeNull();
    expect(
      infoSpy.mock.calls.some(call => String(call[0]).includes('"branch":"admin-cleared"')),
    ).toBe(true);
  });

  it('shouldRevalidate returns false on authenticated child switches and defers on /login or auth actions', () => {
    expect(
      shouldRevalidate({
        currentUrl: new URL('https://admin.andrew-k.us/analytics'),
        nextUrl: new URL('https://admin.andrew-k.us/cms'),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(false);

    expect(
      shouldRevalidate({
        currentUrl: new URL('https://admin.andrew-k.us/analytics'),
        nextUrl: new URL('https://admin.andrew-k.us/login'),
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);

    expect(
      shouldRevalidate({
        currentUrl: new URL('https://admin.andrew-k.us/analytics'),
        nextUrl: new URL('https://admin.andrew-k.us/analytics'),
        formAction: '/api/auth/logout',
        defaultShouldRevalidate: true,
      } as Parameters<typeof shouldRevalidate>[0]),
    ).toBe(true);
  });
});
