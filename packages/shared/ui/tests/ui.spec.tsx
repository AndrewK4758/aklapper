import { render, screen } from '@testing-library/react';

import {
  OscStatusBadge,
  SandboxedArtifactFrame,
  SfButton,
  SolarForgeEmblem,
  TuiWindow,
} from '../src';

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
});
