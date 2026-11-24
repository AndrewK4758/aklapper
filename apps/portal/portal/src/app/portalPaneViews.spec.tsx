import {
  CONTACT_FORM_DEFINITION,
  type ContactActionResult,
  type PortalAgensiLoaderData,
  type PortalContactLoaderData,
  type PortalHomeContent,
  type PortalMenuLoaderData,
  type PortalRootLoaderData,
  type TerminalProfileData,
} from '@aklapper/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, type LoaderFunctionArgs, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { runPaneSafeLoader } from './pane-loader';
import PortalRoot from './root';
import PortalAgensiRoute from './routes/agensi';
import PortalGreeterRoute from './routes/home';
import PortalMenuRoute from './routes/menu';

const CHROME: PortalRootLoaderData['chrome'] = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'andrew-k.us :: tty1',
  shortcutHint: 'Alt+T tui',
  statusBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods' },
  footerText: 'Solar Forge',
  footerLinkLabel: 'agensi.io',
  footerLinkUrl: 'https://agensi.io',
  maintenanceModeDefault: false,
};

const HOME_CONTENT: PortalHomeContent = {
  tuiTitle: 'tui :: launcher',
  tuiBadge: { source: 'portal', state: 'ready', label: 'READY' },
  heading: 'Portal Launcher',
  description: 'Choose a module.',
  actions: [
    { label: 'Launch Menu', to: '/menu', variant: 'primary' },
    { label: 'Contact', to: '/contact', variant: 'default' },
  ],
};

const TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1',
  osLabel: '⚡',
  directory: '~/andrew-k.us',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['tui'],
  initialEntries: [],
  commands: [
    {
      name: 'tui',
      description: 'open tui',
      kind: 'tui',
      output: 'opening TUI launcher ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'contact',
      description: 'open contact',
      kind: 'navigate',
      output: 'opening /contact ...',
      targetRoute: '/contact',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'agensi',
      description: 'open agensi',
      kind: 'navigate',
      output: 'opening /agensi ...',
      targetRoute: '/agensi',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
  ],
};

const CONTACT_DATA: PortalContactLoaderData = {
  content: {
    windowTitle: 'tui :: contact',
    statusBadge: { source: 'contact', state: 'idle', label: 'ready' },
    description: 'Send a transmission.',
    form: CONTACT_FORM_DEFINITION,
  },
};

const AGENSI_DATA: PortalAgensiLoaderData = {
  content: {
    windowTitle: 'tui :: agensi',
    statusBadge: { source: 'agensi', state: 'ready', label: 'LIVE' },
    description: 'Commercial AI skills.',
    searchPlaceholder: 'Filter skills...',
    emptyStateLabel: 'No matching skills.',
    outboundCtaLabel: 'Visit Agensi',
  },
  skills: [],
};

const MENU_DATA: PortalMenuLoaderData = {
  content: {
    heading: 'Launch Menu',
    description: 'Select a module.',
    localTargetLabel: 'local',
  },
  items: [
    {
      slug: 'agensi',
      title: 'Agensi',
      description: 'AI storefront',
      keyShortcut: '1',
      targetK8sDeploy: null,
      adminOnly: false,
      namespace: 'portfolio-public',
      sortOrder: 1,
      enabled: true,
    },
  ],
};

describe('Portal in-pane route adapters & deep-links', () => {
  it('submits in-pane /contact form explicitly to /contact while keeping URL at /', async () => {
    const contactActionSpy = vi.fn<() => Promise<ContactActionResult>>(async () => ({
      ok: true,
      submission: {
        id: 'rcpt-101',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-11-24T19:00:00Z',
      },
    }));

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME,
            maintenance: null,
            terminal: TERMINAL,
            homeContent: HOME_CONTENT,
          }),
          Component: PortalRoot,
          children: [
            {
              index: true,
              loader: () => ({ content: HOME_CONTENT, terminal: TERMINAL }),
              Component: PortalGreeterRoute,
            },
            {
              path: 'menu',
              loader: () => MENU_DATA,
              Component: () => <div>Menu SSR</div>,
            },
            {
              path: 'contact',
              loader: () => CONTACT_DATA,
              action: contactActionSpy,
              Component: () => <div>Contact SSR</div>,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Click Contact in docked launcher -> loads /contact in-pane via useFetcher
    fireEvent.click(await screen.findByRole('link', { name: 'Contact' }));
    const nameInput = await screen.findByLabelText(/Name/i);
    const emailInput = screen.getByLabelText(/Email/i);
    const messageInput = screen.getByRole('textbox', { name: /Message/i });

    fireEvent.change(nameInput, { target: { value: 'Ada Lovelace' } });
    fireEvent.change(emailInput, { target: { value: 'ada@example.com' } });
    fireEvent.change(messageInput, { target: { value: 'Hello from an in-pane contact test!' } });

    const submitButton = screen.getByRole('button', { name: /Transmit|Send|Submit/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(contactActionSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('contact-receipt')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
  });

  it('seeds pane-1 on direct /agensi deep-link and returns to / on Exit TUI', async () => {
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME,
            maintenance: null,
            terminal: TERMINAL,
            homeContent: HOME_CONTENT,
          }),
          Component: PortalRoot,
          children: [
            {
              index: true,
              loader: () => ({ content: HOME_CONTENT, terminal: TERMINAL }),
              Component: PortalGreeterRoute,
            },
            {
              path: 'agensi',
              loader: () => AGENSI_DATA,
              Component: PortalAgensiRoute,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('isolates thrown HTTP 500 Response and Error in in-pane loader without crashing PortalRoot and recovers on Retry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempt = 0;

    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME,
            maintenance: null,
            terminal: TERMINAL,
            homeContent: HOME_CONTENT,
          }),
          Component: PortalRoot,
          children: [
            {
              index: true,
              loader: () => ({ content: HOME_CONTENT, terminal: TERMINAL }),
              Component: PortalGreeterRoute,
            },
            {
              path: 'agensi',
              loader: ({ request }: LoaderFunctionArgs) =>
                runPaneSafeLoader<PortalAgensiLoaderData>(request, async () => {
                  attempt += 1;
                  if (attempt === 1) {
                    throw new Response('upstream unavailable', { status: 500 });
                  }
                  if (attempt === 2) {
                    throw new Error('Failed query: select * from secret_table where token = $1');
                  }
                  return AGENSI_DATA;
                }),
              Component: PortalAgensiRoute,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    // Attempt 1 (thrown HTTP 500 Response): PortalRoot + TerminalWorkspace remain mounted
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(container.querySelector('[data-pane-count="1"]')).toBeTruthy();
    expect(
      errorSpy.mock.calls.some(args =>
        String(args[0]).includes('portal.pane_nav.fetcher_load_failed'),
      ),
    ).toBe(true);

    // Attempt 2 (thrown SQL Error): isolated inside pane without leaking SQL internals over the wire
    errorSpy.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => {
      expect(attempt).toBe(2);
    });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).not.toContain('secret_table');
    expect(alert.textContent).not.toContain('select *');
    const clientFetcherErrorLogs = errorSpy.mock.calls
      .map(args => String(args[0]))
      .filter(msg => msg.includes('portal.pane_nav.fetcher_load_failed'));
    expect(clientFetcherErrorLogs.length).toBeGreaterThan(0);
    for (const msg of clientFetcherErrorLogs) {
      expect(msg).not.toContain('secret_table');
      expect(msg).not.toContain('select *');
    }
    expect(container.querySelector('[data-pane-count="1"]')).toBeTruthy();

    // Attempt 3: recovers cleanly
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    errorSpy.mockRestore();
  });

  it('handles browser Back/Forward re-entry from / to /agensi and /menu -> /agensi -> Back without deadlocks or stale overlays', async () => {
    const router = createMemoryRouter(
      [
        {
          id: 'root',
          path: '/',
          loader: (): PortalRootLoaderData => ({
            maintenanceMode: false,
            chrome: CHROME,
            maintenance: null,
            terminal: TERMINAL,
            homeContent: HOME_CONTENT,
          }),
          Component: PortalRoot,
          children: [
            {
              index: true,
              loader: () => ({ content: HOME_CONTENT, terminal: TERMINAL }),
              Component: PortalGreeterRoute,
            },
            {
              path: 'agensi',
              loader: () => AGENSI_DATA,
              Component: PortalAgensiRoute,
            },
            {
              path: 'menu',
              loader: () => MENU_DATA,
              Component: PortalMenuRoute,
            },
          ],
        },
      ],
      { initialEntries: ['/agensi'] },
    );

    const { container } = render(<RouterProvider router={router} />);

    // Deep-link /agensi -> Exit TUI -> / -> Browser Back to /agensi -> Escape returns cleanly to /
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    const pane1 = container.querySelector('[data-pane-id="pane-1"]') as HTMLElement;
    expect(pane1.getAttribute('data-tui-depth')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Exit TUI' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    });

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/agensi');
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
      expect(pane1.getAttribute('data-tui-depth')).toBe('0');
    });

    // Deep-link route switch: /menu -> /agensi -> Browser Back to /menu (no stale Agensi overlay)
    await act(async () => {
      await router.navigate('/menu');
    });
    expect(await screen.findByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    await waitFor(() => {
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });

    await act(async () => {
      await router.navigate('/agensi');
    });
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();

    await act(async () => {
      await router.navigate(-1);
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/menu');
      expect(pane1.getAttribute('data-tui-depth')).toBe('1');
    });
    const shellLayer = pane1.querySelector('[data-shell-layer="true"]') as HTMLElement;
    expect(shellLayer.hidden).toBe(false);
    expect(screen.getByRole('heading', { name: 'Launch Menu' })).toBeTruthy();
    expect(screen.queryByText('Commercial AI skills.')).toBeNull();
  });
});
