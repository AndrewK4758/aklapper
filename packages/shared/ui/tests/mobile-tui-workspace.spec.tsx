import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  Button,
  OscStatusBadge,
  usePaneNavigation,
  ViewportProvider,
  ZshP10kTerminal,
} from '../src';
import {
  type MobileNavItem,
  MobileTuiWorkspace,
  TerminalAccessoryBar,
} from '../src/mobile-tui-workspace';

const NAV_ITEMS: readonly MobileNavItem[] = [
  {
    id: 'home',
    label: 'Terminal',
    shortLabel: 'TUI',
    icon: '⌘',
    active: true,
    renderLink: ({ className, children, ...props }) => (
      <a href='/' className={className} {...props}>
        {children}
      </a>
    ),
  },
  {
    id: 'menu',
    label: 'Menu',
    shortLabel: 'Menu',
    icon: '☰',
    active: false,
    renderLink: ({ className, children, ...props }) => (
      <a href='/menu' className={className} {...props}>
        {children}
      </a>
    ),
  },
];

function StackPushProbe() {
  const nav = usePaneNavigation();
  return (
    <Button.Root type='button' onClick={() => nav?.push('menu-view')}>
      Push Nested Pane
    </Button.Root>
  );
}

describe('MobileTuiWorkspace and TerminalAccessoryBar', () => {
  it('renders sticky TUI status header, portrait bottom dock, quick-launch sheet, overflow sheet, and in-pane TUI stack Back button', () => {
    render(
      <ViewportProvider mode='mobile-portrait'>
        <MobileTuiWorkspace
          layoutMode='mobile-portrait'
          brand={<span>Solar Forge</span>}
          activeTtyLabel='tty1 :: /'
          navLabel='Mobile primary navigation'
          navItems={NAV_ITEMS}
          statusBadge={<OscStatusBadge state='ready' label='2 pods' />}
          overflowItems={<div>Overflow Item</div>}
          quickLaunchItems={<div>Quick Launch Launcher</div>}
          renderStackedPane={viewId => <div data-testid='stacked-pane'>View: {viewId}</div>}
        >
          <StackPushProbe />
        </MobileTuiWorkspace>
      </ViewportProvider>,
    );

    expect(screen.getByText('Solar Forge')).toBeTruthy();
    expect(screen.getByText('tty1 :: /')).toBeTruthy();
    expect(screen.getByText('2 pods')).toBeTruthy();
    expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Push Nested Pane' }));
    expect(screen.getByTestId('stacked-pane').textContent).toBe('View: menu-view');
    const backBtn = screen.getByRole('button', { name: 'Back to previous pane' });
    expect(backBtn).toBeTruthy();

    fireEvent.click(backBtn);
    expect(screen.queryByTestId('stacked-pane')).toBeNull();
    expect(screen.getByRole('button', { name: 'Push Nested Pane' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Open TUI Quick Launch' }));
    expect(screen.getByText('Quick Launch Launcher')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close TUI quick launch' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open workspace menu' }));
    expect(screen.getByText('Overflow Item')).toBeTruthy();
  });

  it('hides portrait bottom dock and reveals TerminalAccessoryBar when ZshP10kTerminal input is focused', () => {
    const onRun = vi.fn(() => ({ output: 'help output', status: 'ok' as const }));
    render(
      <ViewportProvider mode='mobile-portrait'>
        <MobileTuiWorkspace
          layoutMode='mobile-portrait'
          brand={<span>SF</span>}
          activeTtyLabel='tty1 :: /'
          navLabel='Mobile primary navigation'
          navItems={NAV_ITEMS}
        >
          <ZshP10kTerminal
            bannerTitle='Solar Forge Terminal'
            osLabel='⚡'
            directory='~/andrew-k.us'
            vcsBranch='main'
            vcsState='clean'
            contextLabel='guest@andrew-k.us'
            placeholder='type a command'
            quickCommands={['help', 'clear']}
            commands={{ help: onRun }}
          />
        </MobileTuiWorkspace>
      </ViewportProvider>,
    );

    expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeTruthy();
    expect(document.querySelector('[data-terminal-accessory-bar="true"]')).toBeNull();

    const input = screen.getByRole('textbox', { name: 'Terminal command input' });
    fireEvent.focus(input);

    expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeNull();
    expect(document.querySelector('[data-terminal-accessory-bar="true"]')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tab' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Esc' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ctrl+C' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Previous command' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next command' })).toBeTruthy();

    fireEvent.blur(input);
    expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeTruthy();
  });

  it('renders landscape compact collapsible left rail with aria-expanded toggle and hides portrait bottom dock', () => {
    render(
      <ViewportProvider mode='mobile-landscape'>
        <MobileTuiWorkspace
          layoutMode='mobile-landscape'
          brand={<span>SF</span>}
          activeTtyLabel='tty1 :: /'
          navLabel='Mobile primary navigation'
          navItems={NAV_ITEMS}
          railFooterActions={<button type='button'>Sign Out</button>}
        >
          <div>Landscape Content</div>
        </MobileTuiWorkspace>
      </ViewportProvider>,
    );

    expect(document.querySelector('[data-mobile-tui-dock="true"]')).toBeNull();
    const rail = document.querySelector('[data-mobile-rail="true"]');
    expect(rail).toBeTruthy();
    expect(rail?.getAttribute('data-expanded')).toBe('false');

    const toggle = screen.getByRole('button', { name: 'Expand navigation rail' });
    fireEvent.click(toggle);
    expect(rail?.getAttribute('data-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Collapse navigation rail' })).toBeTruthy();
  });

  it('dispatches TerminalAccessoryBar actions when buttons are tapped', () => {
    const onAction = vi.fn();
    render(
      <TerminalAccessoryBar visible quickCommands={['status']} onAction={onAction} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ctrl+C' }));
    fireEvent.click(screen.getByRole('button', { name: 'status' }));

    expect(onAction).toHaveBeenNthCalledWith(1, 'tab');
    expect(onAction).toHaveBeenNthCalledWith(2, 'ctrl-c');
    expect(onAction).toHaveBeenNthCalledWith(3, { type: 'command', command: 'status' });
  });
});
