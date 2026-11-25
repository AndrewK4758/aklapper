import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MOBILE_LANDSCAPE_MEDIA_QUERY,
  MOBILE_PORTRAIT_MEDIA_QUERY,
  MobileAppShell,
  type MobileNavItem,
  resolveViewportLayoutMode,
  Tooltip,
  TuiWindow,
  useViewportLayoutMode,
  type ViewportLayoutMode,
} from '../src';

interface MockViewportController {
  setViewport: (options: { portrait: boolean; landscapeShort: boolean }) => void;
  restore: () => void;
}

function mockViewportMedia(initial: {
  portrait: boolean;
  landscapeShort: boolean;
}): MockViewportController {
  let state = { ...initial };
  const listeners = new Set<() => void>();
  const originalMatchMedia = window.matchMedia;

  const mockMatchMedia = vi.fn<(query: string) => MediaQueryList>(
    (query: string): MediaQueryList => {
      const matches =
        query === MOBILE_LANDSCAPE_MEDIA_QUERY
          ? state.landscapeShort
          : query === MOBILE_PORTRAIT_MEDIA_QUERY
            ? state.portrait
            : false;

      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          if (typeof listener === 'function') {
            listeners.add(() => listener(new Event('change')));
          }
        },
        removeEventListener: () => {
          listeners.clear();
        },
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      };
    },
  );

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: mockMatchMedia,
  });

  return {
    setViewport(next) {
      state = { ...next };
      for (const listener of listeners) {
        listener();
      }
    },
    restore() {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    },
  };
}

function ViewportProbe() {
  const mode: ViewportLayoutMode = useViewportLayoutMode();
  return <output data-testid='viewport-mode'>{mode}</output>;
}

const SAMPLE_NAV_ITEMS: readonly MobileNavItem[] = [
  {
    id: 'terminal',
    label: 'Terminal',
    icon: '>_',
    active: false,
    renderLink: props => (
      <a href='/' {...props}>
        {props.children}
      </a>
    ),
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: '::',
    active: true,
    renderLink: props => (
      <a href='/menu' {...props}>
        {props.children}
      </a>
    ),
  },
  {
    id: 'ask',
    label: 'Ask',
    icon: '?',
    active: false,
    renderLink: props => (
      <a href='/ask' {...props}>
        {props.children}
      </a>
    ),
  },
  {
    id: 'cadence',
    label: 'CADENCE',
    icon: '◈',
    active: false,
    renderLink: props => (
      <a href='/cadence' {...props}>
        {props.children}
      </a>
    ),
  },
  {
    id: 'contact',
    label: 'Contact',
    icon: '@',
    active: false,
    renderLink: props => (
      <a href='/contact' {...props}>
        {props.children}
      </a>
    ),
  },
];

describe('useViewportLayoutMode and resolveViewportLayoutMode', () => {
  let controller: MockViewportController | null = null;

  afterEach(() => {
    controller?.restore();
    controller = null;
  });

  it('classifies portrait, landscape-short (including >48rem wide phones), and desktop accurately', () => {
    controller = mockViewportMedia({ portrait: true, landscapeShort: false });
    render(<ViewportProbe />);
    expect(resolveViewportLayoutMode()).toBe('mobile-portrait');
    expect(screen.getByTestId('viewport-mode').textContent).toBe('mobile-portrait');

    // Landscape phone wider than 48rem (e.g. 844x390 or 915x412)
    act(() => {
      controller?.setViewport({ portrait: false, landscapeShort: true });
    });
    expect(resolveViewportLayoutMode()).toBe('mobile-landscape');
    expect(screen.getByTestId('viewport-mode').textContent).toBe('mobile-landscape');

    // Desktop viewport (e.g. 1280x800)
    act(() => {
      controller?.setViewport({ portrait: false, landscapeShort: false });
    });
    expect(resolveViewportLayoutMode()).toBe('desktop');
    expect(screen.getByTestId('viewport-mode').textContent).toBe('desktop');
  });

  it('degrades safely to desktop when window.matchMedia is unavailable', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    try {
      expect(resolveViewportLayoutMode()).toBe('desktop');
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    }
  });
});

describe('MobileAppShell', () => {
  it('renders sticky header, overflow secondary menu, and 5-item bottom navigation in portrait mode', () => {
    render(
      <MobileAppShell
        layoutMode='mobile-portrait'
        brand={<span>andrew-k.us</span>}
        pageTitle='Menu'
        navLabel='Primary mobile navigation'
        navItems={SAMPLE_NAV_ITEMS}
        secondaryMenuItems={<a href='/agensi'>Agensi</a>}
      >
        <div>Page body</div>
      </MobileAppShell>,
    );

    expect(document.querySelector('[data-mobile-shell="portrait"]')).toBeTruthy();
    expect(document.querySelector('[data-mobile-header="true"]')).toBeTruthy();
    expect(document.querySelector('[data-mobile-bottom-nav="true"]')).toBeTruthy();
    expect(document.querySelector('[data-mobile-rail="true"]')).toBeNull();

    const menuLink = screen.getByRole('link', { name: 'Menu' });
    expect(menuLink.getAttribute('aria-current')).toBe('page');
    expect(menuLink.dataset.active).toBe('true');

    const toggle = screen.getByRole('button', { name: 'Open navigation menu' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'Agensi' })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Agensi' }).getAttribute('href')).toBe('/agensi');
  });

  it('renders collapsible left rail with rail footer actions and hides bottom nav in landscape mode', () => {
    render(
      <MobileAppShell
        layoutMode='mobile-landscape'
        brand={<span>andrew-k.us</span>}
        pageTitle='CADENCE'
        navLabel='Primary mobile navigation'
        navItems={SAMPLE_NAV_ITEMS}
        railFooterActions={<button type='button'>Sign Out</button>}
      >
        <div>Landscape workspace</div>
      </MobileAppShell>,
    );

    expect(document.querySelector('[data-mobile-shell="landscape"]')).toBeTruthy();
    expect(document.querySelector('[data-mobile-rail="true"]')).toBeTruthy();
    expect(document.querySelector('[data-mobile-bottom-nav="true"]')).toBeNull();
    expect(document.querySelector('[data-mobile-header="true"]')).toBeNull();

    const railToggle = screen.getByRole('button', { name: 'Expand navigation rail' });
    expect(railToggle.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(railToggle);
    expect(railToggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy();
  });

  it('renders an interactive brand link as a sibling of the rail toggle rather than nested inside it', () => {
    render(
      <MobileAppShell
        layoutMode='mobile-landscape'
        brand={<a href='/'>andrew-k.us</a>}
        pageTitle='CADENCE'
        navLabel='Primary mobile navigation'
        navItems={SAMPLE_NAV_ITEMS}
      >
        <div>Landscape workspace</div>
      </MobileAppShell>,
    );

    const railToggle = screen.getByRole('button', { name: 'Expand navigation rail' });
    expect(screen.queryByRole('link', { name: 'andrew-k.us' })).toBeNull();

    fireEvent.click(railToggle);

    expect(railToggle.getAttribute('aria-expanded')).toBe('true');
    expect(railToggle.querySelector('a')).toBeNull();

    const brandLink = screen.getByRole('link', { name: 'andrew-k.us' });
    expect(brandLink.getAttribute('href')).toBe('/');
    expect(railToggle.contains(brandLink)).toBe(false);
    expect(railToggle.parentElement?.contains(brandLink)).toBe(true);
    expect(brandLink.parentElement?.previousElementSibling).toBe(railToggle);

    fireEvent.click(brandLink);
    expect(railToggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('TuiWindow handheld docking without PaneNavigationContext', () => {
  let controller: MockViewportController | null = null;

  afterEach(() => {
    controller?.restore();
    controller = null;
  });

  it('forces data-docked="true" and omits drag/resize handles on mobile portrait and landscape', () => {
    controller = mockViewportMedia({ portrait: true, landscapeShort: false });
    const { container } = render(
      <Tooltip.Provider>
        <TuiWindow title='Handheld Window'>
          <p>Content</p>
        </TuiWindow>
      </Tooltip.Provider>,
    );

    const win = container.querySelector('section[aria-label="Handheld Window"]');
    expect(win?.getAttribute('data-docked')).toBe('true');
    expect(container.querySelector('[data-resize-handle]')).toBeNull();
    expect(container.querySelector('[data-drag-handle]')).toBeNull();

    act(() => {
      controller?.setViewport({ portrait: false, landscapeShort: true });
    });
    expect(win?.getAttribute('data-docked')).toBe('true');
    expect(container.querySelector('[data-resize-handle]')).toBeNull();

    act(() => {
      controller?.setViewport({ portrait: false, landscapeShort: false });
    });
    expect(win?.getAttribute('data-docked')).toBe('false');
    expect(container.querySelector('[data-resize-handle]')).toBeTruthy();
  });
});
