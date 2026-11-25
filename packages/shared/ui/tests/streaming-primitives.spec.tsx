import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatusPill, StreamingTextFeed, type StatusPillTone } from '../src';

describe('@aklapper/ui streaming primitives (StatusPill & StreamingTextFeed)', () => {
  it('renders StatusPill across all semantic tones and sizes using @layer element tokens with zero hex/rgb/hsl/px', () => {
    const tones: readonly StatusPillTone[] = [
      'neutral',
      'info',
      'success',
      'warn',
      'danger',
      'accent',
    ];
    render(
      <div>
        {tones.map(tone => (
          <StatusPill
            key={tone}
            tone={tone}
            size={tone === 'accent' ? 'md' : 'sm'}
            pulse={tone === 'info'}
          >
            {`tone-${tone}`}
          </StatusPill>
        ))}
      </div>,
    );

    for (const tone of tones) {
      const label = screen.getByText(`tone-${tone}`);
      const pill = label.parentElement;
      expect(pill?.getAttribute('data-tone')).toBe(tone);
      expect(pill?.getAttribute('data-size')).toBe(tone === 'accent' ? 'md' : 'sm');
    }

    const uiSrc = resolve(import.meta.dirname, '../src');
    const pillCss = readFileSync(resolve(uiSrc, 'elements/StatusPill.module.css'), 'utf8');
    const feedCss = readFileSync(resolve(uiSrc, 'components/StreamingTextFeed.module.css'), 'utf8');

    expect(pillCss).toContain('@layer element');
    expect(feedCss).toContain('@layer component');
    expect(pillCss).toContain('prefers-reduced-motion: reduce');
    expect(feedCss).toContain('prefers-reduced-motion: reduce');

    for (const css of [pillCss, feedCss]) {
      expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(css).not.toMatch(/\b(?:rgba?|hsla?)\(/i);
      expect(css).not.toMatch(/\b\d+(?:\.\d+)?px\b/);
    }
  });

  it('exposes live accessible log semantics and pauses auto-scroll when the user scrolls upward', () => {
    const { rerender } = render(
      <StreamingTextFeed
        content='chunk 1'
        isStreaming={true}
        ariaLabel='Assistant response'
        statusLabel='Streaming'
      />,
    );

    const logRegion = screen.getByRole('log', { name: 'Assistant response' });
    expect(logRegion.getAttribute('aria-live')).toBe('polite');
    expect(logRegion.getAttribute('aria-busy')).toBe('true');

    // Simulate viewport geometry pinned near bottom
    let scrollTopValue = 400;
    Object.defineProperty(logRegion, 'scrollHeight', { configurable: true, get: () => 600 });
    Object.defineProperty(logRegion, 'clientHeight', { configurable: true, get: () => 200 });
    Object.defineProperty(logRegion, 'scrollTop', {
      configurable: true,
      get: () => scrollTopValue,
      set: (val: number) => {
        scrollTopValue = val;
      },
    });

    rerender(
      <StreamingTextFeed
        content='chunk 1\nchunk 2'
        isStreaming={true}
        ariaLabel='Assistant response'
        statusLabel='Streaming'
      />,
    );
    expect(scrollTopValue).toBe(600);

    // User scrolls upward reading earlier lines -> auto-scroll pauses
    scrollTopValue = 50;
    fireEvent.scroll(logRegion);

    rerender(
      <StreamingTextFeed
        content='chunk 1\nchunk 2\nchunk 3'
        isStreaming={true}
        ariaLabel='Assistant response'
        statusLabel='Streaming'
      />,
    );
    expect(scrollTopValue).toBe(50);
  });

  it('renders fallback emptyText when idle with zero console warnings', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      render(
        <div>
          <StatusPill tone='accent' pulse={true} as='output'>
            Ready
          </StatusPill>
          <StreamingTextFeed
            content=''
            isStreaming={false}
            emptyText='No stream output yet.'
            ariaLabel='Empty output'
          />
        </div>,
      );

      const logRegion = screen.getByRole('log', { name: 'Empty output' });
      expect(logRegion.getAttribute('aria-busy')).toBe('false');
      expect(screen.getByText('No stream output yet.')).toBeTruthy();
      expect(screen.getByText('Ready')).toBeTruthy();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });
});
