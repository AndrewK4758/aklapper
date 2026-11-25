import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectServerViewportMode,
  MOBILE_LANDSCAPE_MEDIA_QUERY,
  MOBILE_PORTRAIT_MEDIA_QUERY,
  useViewportContext,
  ViewportProvider,
  type ViewportLayoutMode,
} from '../src';

interface MatchMediaHarness {
  setMode: (mode: ViewportLayoutMode) => void;
  restore: () => void;
}

function installMatchMediaHarness(initialMode: ViewportLayoutMode): MatchMediaHarness {
  let currentMode: ViewportLayoutMode = initialMode;
  const listeners = new Set<() => void>();
  const originalMatchMedia = window.matchMedia;

  const mockMatchMedia = vi.fn<(query: string) => MediaQueryList>(
    (query: string): MediaQueryList => {
      const matches =
        query === MOBILE_LANDSCAPE_MEDIA_QUERY
          ? currentMode === 'mobile-landscape'
          : query === MOBILE_PORTRAIT_MEDIA_QUERY
            ? currentMode === 'mobile-portrait'
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
        removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
          if (typeof listener === 'function') {
            listeners.clear();
          }
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
    setMode(nextMode: ViewportLayoutMode) {
      currentMode = nextMode;
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

function ViewportProbe({ testId = 'probe' }: { readonly testId?: string }) {
  const ctx = useViewportContext();
  return (
    <div
      data-testid={testId}
      data-layout-mode={ctx.layoutMode}
      data-is-mobile={String(ctx.isMobile)}
      data-is-scoped={String(ctx.isScopedOverride)}
    >
      {ctx.layoutMode}
    </div>
  );
}

describe('detectServerViewportMode', () => {
  it('returns mobile-portrait when Sec-CH-UA-Mobile is ?1', () => {
    const headers = new Headers({
      'Sec-CH-UA-Mobile': '?1',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
    });
    expect(detectServerViewportMode(headers)).toBe('mobile-portrait');
  });

  it('returns desktop when Sec-CH-UA-Mobile is ?0 even if User-Agent contains mobile tokens', () => {
    const headers = new Headers({
      'Sec-CH-UA-Mobile': '?0',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
    });
    expect(detectServerViewportMode(headers)).toBe('desktop');
  });

  it('falls back to mobile User-Agent detection when Sec-CH-UA-Mobile is absent', () => {
    expect(
      detectServerViewportMode(
        new Headers({
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        }),
      ),
    ).toBe('mobile-portrait');

    expect(
      detectServerViewportMode({
        'user-agent':
          'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      }),
    ).toBe('mobile-portrait');
  });

  it('defaults to desktop for desktop User-Agent, bots, missing headers, and never infers mobile-landscape', () => {
    expect(detectServerViewportMode(new Headers())).toBe('desktop');
    expect(
      detectServerViewportMode({
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0.0.0',
      }),
    ).toBe('desktop');
    expect(
      detectServerViewportMode({
        'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      }),
    ).toBe('desktop');
  });

  it('bounds User-Agent inspection to linear time against adversarial 64 KB ReDoS strings', () => {
    const adversarialUa = 'Android'.repeat(9_200);
    const start = performance.now();
    const result = detectServerViewportMode({ 'user-agent': adversarialUa });
    const elapsedMs = performance.now() - start;

    expect(result).toBe('desktop');
    expect(elapsedMs).toBeLessThan(10);
  });
});

describe('ViewportProvider', () => {
  let harness: MatchMediaHarness | null = null;

  afterEach(() => {
    harness?.restore();
    harness = null;
  });

  it('uses initialMode during SSR rendering', () => {
    const html = renderToString(
      <ViewportProvider initialMode='mobile-portrait'>
        <ViewportProbe />
      </ViewportProvider>,
    );
    expect(html).toContain('data-layout-mode="mobile-portrait"');
    expect(html).toContain('data-is-mobile="true"');
  });

  it('reconciles portrait, landscape, and desktop transitions via matchMedia', () => {
    harness = installMatchMediaHarness('mobile-portrait');

    render(
      <ViewportProvider initialMode='mobile-portrait'>
        <ViewportProbe />
      </ViewportProvider>,
    );

    const probe = screen.getByTestId('probe');
    expect(probe.getAttribute('data-layout-mode')).toBe('mobile-portrait');
    expect(probe.getAttribute('data-is-mobile')).toBe('true');

    act(() => {
      harness?.setMode('mobile-landscape');
    });
    expect(probe.getAttribute('data-layout-mode')).toBe('mobile-landscape');
    expect(probe.getAttribute('data-is-mobile')).toBe('true');

    act(() => {
      harness?.setMode('desktop');
    });
    expect(probe.getAttribute('data-layout-mode')).toBe('desktop');
    expect(probe.getAttribute('data-is-mobile')).toBe('false');
  });

  it('supports nested scoped mode overrides without mutating parent context or documentElement', () => {
    harness = installMatchMediaHarness('desktop');
    document.documentElement.dataset.viewport = 'desktop';

    render(
      <ViewportProvider initialMode='desktop'>
        <ViewportProbe testId='outer' />
        <ViewportProvider mode='mobile-portrait'>
          <ViewportProbe testId='inner' />
        </ViewportProvider>
      </ViewportProvider>,
    );

    expect(screen.getByTestId('outer').getAttribute('data-layout-mode')).toBe('desktop');
    expect(screen.getByTestId('outer').getAttribute('data-is-scoped')).toBe('false');
    expect(screen.getByTestId('inner').getAttribute('data-layout-mode')).toBe('mobile-portrait');
    expect(screen.getByTestId('inner').getAttribute('data-is-mobile')).toBe('true');
    expect(screen.getByTestId('inner').getAttribute('data-is-scoped')).toBe('true');
    expect(document.documentElement.dataset.viewport).toBe('desktop');
  });

  it('preserves live client viewport state when initialMode prop changes on revalidation', () => {
    harness = installMatchMediaHarness('mobile-landscape');

    const { rerender } = render(
      <ViewportProvider initialMode='mobile-portrait'>
        <ViewportProbe />
      </ViewportProvider>,
    );

    expect(screen.getByTestId('probe').getAttribute('data-layout-mode')).toBe('mobile-landscape');

    rerender(
      <ViewportProvider initialMode='desktop'>
        <ViewportProbe />
      </ViewportProvider>,
    );

    expect(screen.getByTestId('probe').getAttribute('data-layout-mode')).toBe('mobile-landscape');
  });
});
