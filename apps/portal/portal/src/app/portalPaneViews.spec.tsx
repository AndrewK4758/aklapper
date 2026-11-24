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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import PortalRoot from './root';
import PortalAgensiRoute from './routes/agensi';
import PortalGreeterRoute from './routes/home';

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

  it('renders Retry UI and emits error telemetry when an in-pane fetcher load fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldFail = true;

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
              loader: () => {
                if (shouldFail) {
                  return undefined as unknown as PortalAgensiLoaderData;
                }
                return AGENSI_DATA;
              },
              Component: PortalAgensiRoute,
            },
          ],
        },
      ],
      { initialEntries: ['/'] },
    );

    render(<RouterProvider router={router} />);

    const input = (await screen.findByLabelText('Terminal command input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'agensi' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(
      errorSpy.mock.calls.some(args =>
        String(args[0]).includes('portal.pane_nav.fetcher_load_failed'),
      ),
    ).toBe(true);

    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Commercial AI skills.')).toBeTruthy();
    errorSpy.mockRestore();
  });
});
