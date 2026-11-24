import * as analytics from '@aklapper/core/analytics';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PortalAgensiPage } from './PortalAgensiPage';

const SAMPLE_CONTENT = {
  windowTitle: 'tui :: agensi storefront',
  statusBadge: {
    source: 'agensi-catalog',
    state: 'ready' as const,
    label: 'catalog · live',
  },
  description: 'Published commercial skills.',
  searchPlaceholder: 'Filter skills...',
  emptyStateLabel: 'No matching skills.',
  outboundCtaLabel: 'Open on Agensi →',
};

const SAMPLE_SKILLS = [
  {
    slug: 'cadence-sdlc',
    name: 'CADENCE Agentic SDLC',
    summary: 'Specification-driven delivery framework.',
    tags: ['sdlc', 'agents'],
    url: 'https://agensi.io/creators/aklapper',
    sortOrder: 1,
  },
  {
    slug: 'gke-go',
    name: 'GKE Go Microservices',
    summary: 'Scale-from-zero distroless Go services.',
    tags: ['kubernetes', 'go'],
    url: 'https://agensi.io/creators/aklapper',
    sortOrder: 2,
  },
];

describe('PortalAgensiPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters skills by tag and search text and tracks outbound CTA clicks', () => {
    const track = vi.fn<analytics.AnalyticsClient['track']>();
    vi.spyOn(analytics, 'getActiveAnalyticsClient').mockReturnValue({
      enabled: true,
      sessionId: 'test-sess',
      track,
      startWebVitals: vi.fn<() => void>(),
      flush: vi.fn<() => void>(),
    });

    render(
      <PortalAgensiPage
        content={SAMPLE_CONTENT}
        skills={SAMPLE_SKILLS}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('agensi-card-cadence-sdlc')).toBeTruthy();
    expect(screen.getByTestId('agensi-card-gke-go')).toBeTruthy();

    fireEvent.click(screen.getByTestId('agensi-tag-kubernetes'));
    expect(screen.queryByTestId('agensi-card-cadence-sdlc')).toBeNull();
    expect(screen.getByTestId('agensi-card-gke-go')).toBeTruthy();

    fireEvent.click(screen.getByTestId('agensi-cta-gke-go'));
    expect(track).toHaveBeenCalledWith({
      type: 'interaction',
      name: 'agensi_outbound_click',
      path: '/agensi',
      metadata: { slug: 'gke-go' },
    });

    fireEvent.change(screen.getByTestId('agensi-search-input'), {
      target: { value: 'nonexistent-query' },
    });
    expect(screen.getByTestId('agensi-empty-state')).toBeTruthy();
  });
});
