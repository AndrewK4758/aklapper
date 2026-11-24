import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  buildFaviconFrameDataUri,
  buildZshCommandHandlers,
  Button,
  OscStatusBadge,
  SandboxedArtifactFrame,
  SolarForgeEmblem,
  TuiWindow,
  useAnimatedFavicon,
  ZshP10kTerminal,
} from '../src';

function FaviconHost() {
  useAnimatedFavicon();
  return null;
}

describe('@aklapper/ui', () => {
  it('renders Base UI Solar Forge button, button link, emblem, OSC progress badge, and TuiWindow controls', () => {
    const onClose = vi.fn<() => void>();
    render(
      <TuiWindow
        title='GKE Cluster Watch'
        onClose={onClose}
        badge={
          <OscStatusBadge source='svc-cadence-demo' state='scaling' label='0 -> 1' progress={40} />
        }
      >
        <SolarForgeEmblem />
        <Button.Root variant='primary'>
          <Button.Label>Launch</Button.Label>
        </Button.Root>
        <Button.Link href='/menu' variant='secondary' size='sm'>
          <Button.Label>Open Menu</Button.Label>
        </Button.Link>
      </TuiWindow>,
    );

    expect(screen.getByText('GKE Cluster Watch')).toBeTruthy();
    expect(screen.getByText('svc-cadence-demo')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'svc-cadence-demo progress' })).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy();

    const menuLink = screen.getByRole('link', { name: 'Open Menu' });
    expect(menuLink.getAttribute('href')).toBe('/menu');
    expect(menuLink.getAttribute('data-variant')).toBe('secondary');

    fireEvent.click(screen.getByRole('button', { name: 'Close window' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const titlebar = screen.getByRole('button', { name: /GKE Cluster Watch window handle/i });
    const windowEl = screen.getByRole('region', { name: 'GKE Cluster Watch' });
    expect(windowEl.getAttribute('data-floating')).toBe('false');

    fireEvent.keyDown(titlebar, { key: 'ArrowRight' });
    expect(windowEl.getAttribute('data-floating')).toBe('true');

    fireEvent.keyDown(titlebar, { key: 'ArrowRight', shiftKey: true });
    expect(windowEl.getAttribute('data-floating')).toBe('true');

    fireEvent.keyDown(titlebar, { key: '0' });
    expect(windowEl.getAttribute('data-floating')).toBe('false');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('enforces opaque-origin iframe sandbox without allow-same-origin', () => {
    render(<SandboxedArtifactFrame title='Generated App' srcDoc='<h1>Hello</h1>' />);
    const iframe = screen.getByTitle('Generated App');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
  });

  it('sweeps favicon crosshairs horizontally and restores static svg on unmount', () => {
    vi.useFakeTimers();
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.appendChild(link);

    const frameRight = buildFaviconFrameDataUri(5);
    expect(frameRight.startsWith('data:image/svg+xml,')).toBe(true);
    expect(decodeURIComponent(frameRight)).toContain('translate(5 0)');

    const { unmount } = render(<FaviconHost />);
    vi.advanceTimersByTime(560);
    expect(link.href.startsWith('data:image/svg+xml,')).toBe(true);

    unmount();
    expect(link.getAttribute('href')).toBe('/favicon.svg');
    link.remove();
    vi.useRealTimers();
  });

  it('executes typed terminal commands, supports shell keybindings, and runs quick-command chips', () => {
    const onEscape = vi.fn<() => void>();
    render(
      <ZshP10kTerminal
        directory='~/andrew-k.us'
        vcsBranch='portfolio_v2'
        contextLabel='visitor@andrew-k.us'
        quickCommands={['whoami']}
        onEscape={onEscape}
        commands={{
          status: () => ({ output: 'all systems nominal' }),
          whoami: () => ({ output: 'visitor@andrew-k.us (tty1)' }),
        }}
      />,
    );

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sta' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('status');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('all systems nominal')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'p', ctrlKey: true });
    expect(input.value).toBe('status');

    fireEvent.keyDown(input, { key: 'n', ctrlKey: true });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'hello world' } });
    input.setSelectionRange(11, 11);
    fireEvent.keyDown(input, { key: 'w', ctrlKey: true });
    expect(input.value).toBe('hello ');

    fireEvent.keyDown(input, { key: 'c', ctrlKey: true });
    expect(input.value).toBe('');
    expect(screen.getByText('hello ^C')).toBeTruthy();

    fireEvent.change(input, { target: { value: 'abc def' } });
    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(input.value).toBe('abc');

    input.setSelectionRange(3, 3);
    fireEvent.keyDown(input, { key: 'u', ctrlKey: true });
    expect(input.value).toBe('');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(input, { key: 'l', ctrlKey: true });
    expect(screen.queryByText('all systems nominal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'whoami' }));
    expect(screen.getByText('visitor@andrew-k.us (tty1)')).toBeTruthy();
  });

  it('builds command handlers dynamically from DB command specs', () => {
    const navigate = vi.fn<(to: string) => void>();
    const openTui = vi.fn<() => void>();
    const handlers = buildZshCommandHandlers(
      [
        {
          name: 'whoami',
          description: 'identity',
          kind: 'static',
          output: 'guest@andrew-k.us',
          targetRoute: null,
          allowedRoutes: [],
          errorTemplate: null,
          sortOrder: 1,
        },
        {
          name: 'tui',
          description: 'open TUI launcher',
          kind: 'tui',
          output: 'opening TUI launcher ...',
          targetRoute: null,
          allowedRoutes: [],
          errorTemplate: null,
          sortOrder: 2,
        },
        {
          name: 'cd',
          description: 'change route',
          kind: 'cd',
          output: 'cd /{{target}}',
          targetRoute: null,
          allowedRoutes: ['menu'],
          errorTemplate: 'cd: no such route: {{input}}',
          sortOrder: 3,
        },
        {
          name: 'roadmap',
          description: 'milestones',
          kind: 'roadmap',
          output: '',
          targetRoute: null,
          allowedRoutes: [],
          errorTemplate: null,
          sortOrder: 4,
        },
        {
          name: 'uptime',
          description: 'uptime',
          kind: 'uptime',
          output: 'up {{seconds}}s',
          targetRoute: null,
          allowedRoutes: [],
          errorTemplate: null,
          sortOrder: 5,
        },
      ],
      {
        navigate,
        openTui,
        milestones: [
          { slug: 'm1', status: 'done', label: 'Postgres 19 wired', sortOrder: 1, enabled: true },
        ],
        getUptimeSeconds: () => 42,
      },
    );

    expect(handlers['whoami']?.([], 'whoami')).toEqual({ output: 'guest@andrew-k.us' });
    expect(handlers['tui']?.([], 'tui')).toEqual({ output: 'opening TUI launcher ...' });
    expect(openTui).toHaveBeenCalledTimes(1);
    expect(handlers['cd']?.(['menu'], 'cd menu')).toEqual({ output: 'cd /menu' });
    expect(navigate).toHaveBeenCalledWith('/menu');
    expect(handlers['cd']?.(['bad'], 'cd bad')).toEqual({
      status: 'error',
      output: 'cd: no such route: bad',
    });
    expect(handlers['roadmap']?.([], 'roadmap')).toEqual({ output: '[x] Postgres 19 wired' });
    expect(handlers['uptime']?.([], 'uptime')).toEqual({ output: 'up 42s' });
  });
});
