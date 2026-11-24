import type { CadencePreset, PortalCadenceContent } from '@aklapper/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PortalCadencePage } from './index';

const CONTENT: PortalCadenceContent = {
  windowTitle: 'CADENCE // Artifact Builder',
  description: 'Quota-gated prompt-to-artifact sandbox.',
  statusBadge: { source: 'cadence-api', state: 'idle', label: '0 pods' },
  iframeTitle: 'CADENCE Artifact Preview',
};

const PRESETS: CadencePreset[] = [
  {
    slug: 'solar-card',
    title: 'Solar Card',
    starterPrompt: 'Render an OKLCH status card.',
    expectedKind: 'html',
    starterArtifactHtml: '<div>Hello Artifact</div>',
    sortOrder: 1,
  },
];

describe('portal/pages/cadence', () => {
  it('renders preset tabs and sandboxed artifact preview', () => {
    const onClose = vi.fn<() => void>();
    render(<PortalCadencePage content={CONTENT} presets={PRESETS} onClose={onClose} />);

    expect(screen.getByText(CONTENT.description)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Solar Card' })).toBeTruthy();
    expect(screen.getByTitle(CONTENT.iframeTitle)).toBeTruthy();
  });
});
