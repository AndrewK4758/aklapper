import type { PortalHomeContent, TerminalProfileData } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { PortalHomePage } from './index';

const CONTENT: PortalHomeContent = {
  tuiTitle: 'tui :: solar-forge launcher',
  tuiBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods' },
  heading: 'Solar Forge Agentic Terminal — tty1',
  description: 'Interactive terminal workspace.',
  actions: [{ label: 'Open Menu', to: '/menu', variant: 'primary' }],
};

const TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1',
  osLabel: '⚡',
  directory: '~/projects/aklapper',
  vcsBranch: 'portfolio_v2',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['tui'],
  initialEntries: [],
  commands: [
    {
      name: 'tui',
      description: 'open launcher',
      kind: 'tui',
      output: 'opening tui ...',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
  ],
};

describe('portal/pages/home', () => {
  it('renders the full-viewport terminal workspace and snaps its TUI launcher into a split pane', () => {
    const onNavigate = vi.fn<(to: string) => void>();
    const { container } = render(
      <MemoryRouter>
        <PortalHomePage content={CONTENT} terminal={TERMINAL} onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    const workspaceEl = container.querySelector('[data-pane-count]') as HTMLElement;
    expect(workspaceEl.getAttribute('data-pane-count')).toBe('1');

    const input = screen.getByLabelText('Terminal command input');
    fireEvent.change(input, { target: { value: 'tui' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(workspaceEl.getAttribute('data-pane-count')).toBe('2');
    const tuiPane = container.querySelector('[data-pane-kind="tui"]') as HTMLElement;
    expect(tuiPane).toBeTruthy();
    expect(tuiPane.getAttribute('data-active')).toBe('true');
    expect(screen.getByRole('heading', { name: CONTENT.heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Menu' }).getAttribute('href')).toBe('/menu');
  });
});
