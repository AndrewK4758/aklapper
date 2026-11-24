import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import {
  buildFaviconFrameDataUri,
  OscStatusBadge,
  SandboxedArtifactFrame,
  SfButton,
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
  it('renders Base UI Solar Forge button, emblem, OSC badge, and TuiWindow', () => {
    render(
      <TuiWindow
        title='GKE Cluster Watch'
        badge={
          <OscStatusBadge source='svc-cadence-demo' state='scaling' label='0 -> 1' progress={40} />
        }
      >
        <SolarForgeEmblem />
        <SfButton variant='primary'>Launch</SfButton>
      </TuiWindow>,
    );

    expect(screen.getByText('GKE Cluster Watch')).toBeTruthy();
    expect(screen.getByText('svc-cadence-demo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Launch' })).toBeTruthy();
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

  it('executes typed zsh commands and completes suggestions with Tab', () => {
    render(
      <ZshP10kTerminal
        directory='~/andrew-k.us'
        vcsBranch='portfolio_v2'
        contextLabel='visitor@andrew-k.us'
        commands={{
          status: () => ({ output: 'all systems nominal' }),
        }}
      />,
    );

    const input = screen.getByLabelText('Zsh command input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'sta' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input.value).toBe('status');

    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByText('all systems nominal')).toBeTruthy();
  });
});
