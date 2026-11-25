import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  buildFaviconFrameDataUri,
  buildZshCommandHandlers,
  Button,
  OscStatusBadge,
  RecursiveTuiForm,
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

  it('sweeps the entire favicon circle and crosshairs horizontally over a full-bleed badge while keeping the bolt centered', () => {
    vi.useFakeTimers();
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = '/favicon.svg';
    document.head.appendChild(link);

    const frameRight = buildFaviconFrameDataUri(5.5);
    expect(frameRight.startsWith('data:image/svg+xml,')).toBe(true);
    const decodedSvg = decodeURIComponent(frameRight);
    expect(decodedSvg).toContain('<rect x="2" y="2" width="60" height="60"');
    expect(decodedSvg).toContain('<g transform="translate(5.5 0)"><circle cx="32" cy="32" r="20"');
    expect(decodedSvg).toContain(
      'stroke-linecap="round"/></g><path d="M37.5 6.5 L15.5 35.5 H29.5 L26.5 57.5 L48.5 28.5 H34.5 Z"',
    );

    const { unmount } = render(<FaviconHost />);
    vi.advanceTimersByTime(560);
    expect(link.href.startsWith('data:image/svg+xml,')).toBe(true);

    const pausedHref = link.href;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(700);
    expect(link.href).toBe(pausedHref);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(280);
    expect(link.href).not.toBe(pausedHref);

    unmount();
    expect(link.getAttribute('href')).toBe('/favicon.svg');
    link.remove();
    vi.useRealTimers();
  });

  it('executes typed terminal commands, supports shell keybindings, and runs quick-command chips', () => {
    const onEscape = vi.fn<() => void>();
    const { container } = render(
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

    const leftTail = container.querySelector('svg[data-prompt-tail="left"]');
    const rightTail = container.querySelector('svg[data-prompt-tail="right"]');
    expect(leftTail?.getAttribute('viewBox')).toBe('0 0 24 16');
    expect(rightTail?.getAttribute('viewBox')).toBe('0 0 24 16');
    expect(leftTail?.querySelector('path')?.getAttribute('d')).toBeTruthy();
    expect(rightTail?.querySelector('path')?.getAttribute('d')).toBeTruthy();

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sta' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('status');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('all systems nominal')).toBeTruthy();

    fireEvent.keyDown(input, { key: 'p', code: 'KeyP', ctrlKey: true });
    expect(input.value).toBe('status');

    fireEvent.keyDown(input, { key: 'n', code: 'KeyN', altKey: true });
    expect(input.value).toBe('');

    fireEvent.change(input, { target: { value: 'hello world' } });
    input.setSelectionRange(11, 11);
    fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace', altKey: true });
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

  it('recursively parses nested fieldsets/fields in RecursiveTuiForm and enforces client validation', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const onValidSubmit = vi.fn<(values: unknown, event: { preventDefault: () => void }) => void>(
      (_values, event) => event.preventDefault(),
    );

    const { container } = render(
      <RecursiveTuiForm
        definition={CONTACT_FORM_DEFINITION}
        serverErrors={{ email: ['Server flagged disposable domain'] }}
        serverFormError='Server validation failed'
        errorSource='server'
        onValidSubmit={onValidSubmit}
      />,
    );

    // Verifies recursive fieldset nesting (2 top-level + 1 nested fieldset)
    const fieldsets = container.querySelectorAll('fieldset');
    expect(fieldsets).toHaveLength(3);
    expect(screen.getByText(/01 \/\/ Sender Identity/i)).toBeTruthy();
    expect(screen.getByText(/01\.1 \/\/ Optional Callback Channel/i)).toBeTruthy();
    expect(screen.getByText(/02 \/\/ Message & Attachment/i)).toBeTruthy();

    // Server error renders initially
    expect(screen.getByText('Server flagged disposable domain')).toBeTruthy();

    // Empty submit triggers client-side validation and blocks onValidSubmit
    fireEvent.click(screen.getByRole('button', { name: /Transmit Message/i }));
    expect(onValidSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Email is required')).toBeTruthy();
    expect(screen.getByText('Message is required')).toBeTruthy();

    // Fill required fields (leaving optional Phone & File empty) -> clears errors and succeeds
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'ada@analytical-engine.org' },
    });
    fireEvent.change(screen.getByLabelText(/^Message\b/i), {
      target: { value: 'Building a recursive Solar Forge TUI form.' },
    });

    // Live CLI command preview reflects current values
    expect(screen.getByText(/\$ contact --name "Ada Lovelace"/i)).toBeTruthy();

    // Attach optional file and then clear it
    const fileInput = screen.getByLabelText(/File/i) as HTMLInputElement;
    const sampleFile = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [sampleFile] } });
    expect(screen.getByText(/▸ notes\.txt/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Clear File/i }));
    expect(screen.queryByText(/▸ notes\.txt/i)).toBeNull();

    // Valid submit succeeds without optional phone/file
    fireEvent.click(screen.getByRole('button', { name: /Transmit Message/i }));
    expect(onValidSubmit).toHaveBeenCalledTimes(1);
  });

  it('validates fields on blur, rejects disallowed files, resets buffer, and submits with Ctrl+Enter', async () => {
    const { CONTACT_FORM_DEFINITION } = await import('@aklapper/core');
    const onValidSubmit = vi.fn<(values: unknown, event: { preventDefault: () => void }) => void>(
      (_values, event) => event.preventDefault(),
    );

    render(
      <RecursiveTuiForm
        definition={CONTACT_FORM_DEFINITION}
        serverErrors={{ email: ['Email field rejected by DB check'] }}
        serverFormError='Database constraint rejected submission.'
        errorSource='database'
        onValidSubmit={onValidSubmit}
      />,
    );

    // Database constraint error source badge and field error render
    expect(screen.getByText('[database]')).toBeTruthy();
    expect(screen.getByText('Email field rejected by DB check')).toBeTruthy();

    // Editing email clears the server/database field error on that field
    const emailInput = screen.getByLabelText(/Email/i) as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    expect(screen.queryByText('Email field rejected by DB check')).toBeNull();

    // Blur validates invalid email and optional invalid phone
    fireEvent.blur(emailInput);
    expect(screen.getByText(/Enter a valid email address/i)).toBeTruthy();

    const phoneInput = screen.getByLabelText(/Phone/i) as HTMLInputElement;
    fireEvent.change(phoneInput, { target: { value: '12' } });
    fireEvent.blur(phoneInput);
    expect(screen.getByText(/Phone must be at least 7 characters/i)).toBeTruthy();

    // Disallowed file extension shows immediate client validation error
    const fileInput = screen.getByLabelText(/File/i) as HTMLInputElement;
    const badFile = new File(['#!/bin/sh'], 'payload.sh', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });
    expect(screen.getByText(/Unsupported file type/i)).toBeTruthy();

    // Reset Buffer clears values, file, and client errors
    fireEvent.click(screen.getByRole('button', { name: /Reset Buffer/i }));
    expect(emailInput.value).toBe('');
    expect(phoneInput.value).toBe('');
    expect(screen.queryByText(/Unsupported file type/i)).toBeNull();

    // Populate valid required fields and submit via Ctrl+Enter in message textarea
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Linus Torvalds' } });
    fireEvent.change(emailInput, { target: { value: 'linus@kernel.example' } });
    const messageInput = screen.getByLabelText(/^Message\b/i);
    fireEvent.change(messageInput, {
      target: { value: 'Testing Ctrl+Enter submission shortcut from textarea.' },
    });
    fireEvent.keyDown(messageInput, { key: 'Enter', ctrlKey: true });
    expect(onValidSubmit).toHaveBeenCalledTimes(1);
  });
});
