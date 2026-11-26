import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import * as rootUiExports from '../src/index';
import {
  DEFAULT_PORTRAIT_HEIGHT,
  DEFAULT_PORTRAIT_PATH,
  DEFAULT_PORTRAIT_SRC,
  DEFAULT_PORTRAIT_WIDTH,
  TerminalPortrait,
} from '../src/terminal-portrait';

describe('@aklapper/ui/terminal-portrait', () => {
  it('isolates TerminalPortrait strictly on the subpath export and renders bundled greyscale portrait with explicit dimensions', () => {
    expect('TerminalPortrait' in rootUiExports).toBe(false);
    expect(DEFAULT_PORTRAIT_PATH).toBe('/images/andrew-klapper-portrait.webp');
    expect(DEFAULT_PORTRAIT_WIDTH).toBe(440);
    expect(DEFAULT_PORTRAIT_HEIGHT).toBe(520);
    expect(typeof DEFAULT_PORTRAIT_SRC).toBe('string');
    expect(DEFAULT_PORTRAIT_SRC.length).toBeGreaterThan(0);

    const { container } = render(
      <TerminalPortrait
        alt='Andrew Klapper portrait'
        caption='Andrew Klapper · Marietta, GA'
        ttyLabel='portrait // greyscale'
        size='md'
        variant='profile'
        priority
        showScanlines
      />,
    );

    const img = screen.getByRole('img', { name: 'Andrew Klapper portrait' }) as HTMLImageElement;
    expect(img.getAttribute('width')).toBe('440');
    expect(img.getAttribute('height')).toBe('520');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('src')).toBe(DEFAULT_PORTRAIT_SRC);
    expect(screen.getByText('Andrew Klapper · Marietta, GA')).toBeTruthy();
    expect(screen.getByText('portrait // greyscale')).toBeTruthy();
    expect(container.querySelector('[data-portrait-scanlines="true"]')).not.toBeNull();
  });

  it('maps DEFAULT_PORTRAIT_PATH and blank src to DEFAULT_PORTRAIT_SRC and falls back cleanly on failing image sources', () => {
    const { rerender, container } = render(
      <TerminalPortrait src={DEFAULT_PORTRAIT_PATH} alt='Andrew Klapper portrait' size='sm' />,
    );

    const mappedImg = screen.getByRole('img', { name: 'Andrew Klapper portrait' });
    expect(mappedImg.getAttribute('src')).toBe(DEFAULT_PORTRAIT_SRC);

    // Blank source resolves cleanly to bundled DEFAULT_PORTRAIT_SRC
    rerender(<TerminalPortrait src='' alt='Andrew Klapper default' size='lg' />);
    expect(screen.getByRole('img', { name: 'Andrew Klapper default' }).getAttribute('src')).toBe(
      DEFAULT_PORTRAIT_SRC,
    );

    // Runtime image load error transitions cleanly to AK monogram fallback and recovers when src changes
    rerender(<TerminalPortrait src='/broken/portrait.webp' alt='Broken portrait' />);
    const brokenImg = screen.getByRole('img', { name: 'Broken portrait' });
    fireEvent.error(brokenImg);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-portrait-fallback="true"]')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Broken portrait' }).textContent).toContain('AK');

    rerender(<TerminalPortrait src={DEFAULT_PORTRAIT_SRC} alt='Recovered portrait' />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  it('rejects control chars, whitespace, encoded traversal, query/hash, and external custom portrait sources cleanly', () => {
    for (const unsafeSrc of [
      '/\t/evil.com/x.webp',
      '/%2e%2e/x.webp',
      '/%2f/evil.webp',
      '/%5c/evil.webp',
      '//evil.example/x.webp',
      '/images/../secret.webp',
      '/images/portrait.webp?x=1',
      '/images/portrait.webp#frag',
      'javascript:alert(1)',
      'https://evil.example/portrait.webp',
    ]) {
      const { container, unmount } = render(
        <TerminalPortrait src={unsafeSrc} alt='Unsafe portrait source' />,
      );
      expect(
        container.querySelector('img'),
        `expected img omitted for ${JSON.stringify(unsafeSrc)}`,
      ).toBeNull();
      expect(
        container.querySelector('[data-portrait-fallback="true"]'),
        `expected fallback monogram for ${JSON.stringify(unsafeSrc)}`,
      ).not.toBeNull();
      unmount();
    }
  });
});
