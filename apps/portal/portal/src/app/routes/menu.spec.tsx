import { createPublicAppError, type PortalMenuLoaderData, type StreamResult } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import PortalMenuRoute, { ErrorBoundary, meta } from './menu';

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
  it('builds synchronous SEO meta without awaiting deferred payload', () => {
    const pending = Promise.withResolvers<StreamResult<PortalMenuLoaderData>>();
    const loaderData = { correlationId: 'corr-menu-meta', payload: pending.promise };
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
            maintenanceMode: false,
            rootPayload: Promise.withResolvers<never>().promise,
          },
        },
        { id: 'routes/menu', params: {}, pathname: '/menu', meta: [], loaderData },
      ],
      location: { pathname: '/menu', search: '', hash: '', state: null, key: 'm1' },
      params: {},
    });

    expect(tags).toContainEqual({ title: 'Launch Menu // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'index, follow' });
  });

  it('streams loading state, filters adminOnly items, and honors numeric and Escape keybindings', async () => {
    const deferred = Promise.withResolvers<StreamResult<PortalMenuLoaderData>>();
    const Stub = createRoutesStub([
      {
        path: '/menu',
        loader: () => ({
          correlationId: 'corr-menu-1',
          payload: deferred.promise,
        }),
        Component: props => (
          <div>
            <input aria-label='Filter probe' />
            <PortalMenuRoute {...props} />
          </div>
        ),
        ErrorBoundary,
      },
      { path: '/cadence', Component: () => <div>Cadence Route</div> },
      { path: '/contact', Component: () => <div>Contact Route</div> },
      { path: '/', Component: () => <div>Home Route</div> },
    ]);

    render(<Stub initialEntries={['/menu']} />);

    expect(await screen.findByRole('status')).toBeTruthy();

    deferred.resolve({ ok: true, data: MENU_FIXTURE });

    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    expect(screen.getByText(/CADENCE Builder/)).toBeTruthy();
    expect(screen.getByText('local-ssr')).toBeTruthy();
    expect(screen.queryByText(/Admin Console/)).toBeNull();

    // Shortcuts ignored while focused in an input element
    const probeInput = screen.getByLabelText('Filter probe');
    fireEvent.keyDown(probeInput, { key: '1' });
    expect(screen.queryByText('Cadence Route')).toBeNull();

    // Shortcuts ignored when modifier keys are pressed
    fireEvent.keyDown(window, { key: '1', ctrlKey: true });
    expect(screen.queryByText('Cadence Route')).toBeNull();

    // Pressing `1` launches /cadence
    fireEvent.keyDown(window, { key: '1' });
    expect(await screen.findByText('Cadence Route')).toBeTruthy();
  });

  it('returns to / when Escape closes the TUI menu window', async () => {
    const Stub = createRoutesStub([
      {
        path: '/menu',
        loader: () => ({
          correlationId: 'corr-menu-esc',
          payload: Promise.resolve<StreamResult<PortalMenuLoaderData>>({
            ok: true,
            data: MENU_FIXTURE,
          }),
        }),
        Component: PortalMenuRoute,
        ErrorBoundary,
      },
      { path: '/', Component: () => <div>Home Route</div> },
    ]);

    render(<Stub initialEntries={['/menu']} />);
    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('Home Route')).toBeTruthy();
  });

  it('renders correlated ErrorElement when streamed payload settles to ERR_DB_UNAVAILABLE', async () => {
    const dbError = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-menu-503',
    });

    const Stub = createRoutesStub([
      {
        path: '/menu',
        loader: () => ({
          correlationId: 'corr-menu-503',
          payload: Promise.resolve<StreamResult<PortalMenuLoaderData>>({
            ok: false,
            error: dbError,
          }),
        }),
        Component: PortalMenuRoute,
        ErrorBoundary,
      },
    ]);

    render(<Stub initialEntries={['/menu']} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(alert.textContent).toContain('corr-menu-503');
    expect(alert.textContent).not.toContain('Unexpected Server Error');
  });
});
