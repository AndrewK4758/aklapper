import type { AdminAnalyticsLoaderData } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { AdminAnalyticsPage } from './index';

const ANALYTICS_DATA: AdminAnalyticsLoaderData = {
  content: {
    windowTitle: 'ANALYTICS // Telemetry',
    description: 'First-party visitor telemetry.',
  },
  window: '7d',
  totalSessions: 14,
  totalEvents: 42,
  summary: {
    totalSessions: 14,
    totalEvents: 42,
  },
  cwv: [
    { metric: 'LCP', sampleCount: 10, p50: 1100, p75: 1500, p95: 2100 },
    { metric: 'INP', sampleCount: 6, p50: 40, p75: 75, p95: 110 },
    { metric: 'CLS', sampleCount: 10, p50: 0.01, p75: 0.02, p95: 0.05 },
    { metric: 'TTFB', sampleCount: 10, p50: 85, p75: 120, p95: 190 },
  ],
  topPaths: [{ label: '/cadence', count: 18 }],
  topReferrers: [{ label: 'direct', count: 14 }],
  geoBreakdown: [{ label: 'US', secondaryLabel: 'GA', count: 11 }],
  agensiConversions: [{ slug: 'solar-forge-cli', clicks: 5 }],
  aiMetrics: {
    totalRuns: 3,
    totalTokensIn: 450,
    totalTokensOut: 1200,
    approvedGates: 2,
    rejectedGates: 0,
    pendingGates: 1,
    abstentionEvents: 1,
  },
};

describe('admin/pages/analytics', () => {
  it('renders telemetry counts, CWV percentiles, funnels, and window links', () => {
    render(
      <MemoryRouter>
        <AdminAnalyticsPage data={ANALYTICS_DATA} />
      </MemoryRouter>,
    );

    expect(screen.getByText(ANALYTICS_DATA.content.description)).toBeTruthy();
    expect(screen.getByText('42 / 100')).toBeTruthy();
    expect(screen.getByText('LCP')).toBeTruthy();
    expect(screen.getByText('1100 ms')).toBeTruthy();
    expect(screen.getByText('/cadence')).toBeTruthy();
    expect(screen.getByText('solar-forge-cli')).toBeTruthy();
    expect(screen.getByRole('link', { name: '30d' }).getAttribute('href')).toBe(
      '/analytics?window=30d',
    );
  });
});
