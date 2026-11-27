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

  it('renders URL filter controls, visitor-first KPIs, trend, organizations, funnel, expandable Recent Visitors with Contact deep-link, and Visitor Q&A feed', () => {
    const enrichedData: AdminAnalyticsLoaderData = {
      ...ANALYTICS_DATA,
      filters: {
        window: '30d',
        bots: 'exclude',
        identified: 'true',
        source: 'linkedin.com',
        country: 'US',
      },
      window: '30d',
      uniqueVisitors: 9,
      returningVisitors: 3,
      totalPageViews: 24,
      profileViews: 7,
      highIntentActions: 5,
      identifiedLeads: 2,
      botSessionsExcluded: 4,
      dailyTrend: [
        { date: '2026-11-26', uniqueVisitors: 4, sessions: 5, pageViews: 10 },
        { date: '2026-11-27', uniqueVisitors: 5, sessions: 9, pageViews: 14 },
      ],
      topPaths: [{ label: '/about', count: 12, uniqueVisitors: 7, filterValue: '/about' }],
      topReferrers: [
        {
          label: 'linkedin.com',
          secondaryLabel: 'social',
          count: 8,
          filterValue: 'linkedin.com',
        },
      ],
      geoBreakdown: [{ label: 'US', secondaryLabel: 'GA · Atlanta', count: 8, filterValue: 'US' }],
      orgBreakdown: [{ label: 'Acme Recruiting Corp', count: 6 }],
      campaignBreakdown: [
        { label: 'ref:recruiter', secondaryLabel: 'fall26', count: 5, filterValue: 'recruiter' },
      ],
      deviceBreakdown: [{ label: 'desktop', count: 11 }],
      osBreakdown: [{ label: 'macOS', count: 9 }],
      browserBreakdown: [{ label: 'Chrome', count: 10 }],
      conversionFunnel: [
        { step: 'landing', label: 'All Sessions', sessions: 14, conversionRate: 1 },
        { step: 'profile', label: 'Viewed /about', sessions: 7, conversionRate: 0.5 },
        { step: 'contact', label: 'Submitted /contact', sessions: 2, conversionRate: 0.14 },
      ],
      recentVisitors: [
        {
          sessionId: 'sess_vis_1',
          startedAt: '2026-11-27T02:00:00.000Z',
          lastSeenAt: '2026-11-27T02:10:00.000Z',
          isBot: false,
          country: 'US',
          region: 'GA',
          city: 'Atlanta',
          asnOrg: 'Acme Recruiting Corp',
          referrerHost: 'linkedin.com',
          referrerCategory: 'social',
          landingPath: '/about',
          refParam: 'recruiter',
          utmSource: 'linkedin',
          utmMedium: 'social',
          utmCampaign: 'fall26',
          deviceType: 'desktop',
          osName: 'macOS',
          browserName: 'Chrome',
          pageViewCount: 3,
          eventCount: 6,
          askTurnCount: 2,
          contactId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contactName: 'Ada Lovelace',
          contactEmail: 'ada@example.com',
          trail: [
            {
              type: 'page_view',
              name: 'portal_page_view',
              path: '/about',
              detail: null,
              createdAt: '2026-11-27T02:00:00.000Z',
            },
            {
              type: 'interaction',
              name: 'about_outbound_click',
              path: '/about',
              detail: 'github',
              createdAt: '2026-11-27T02:03:00.000Z',
            },
          ],
        },
      ],
      askTurnsFeed: [
        {
          attemptId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          guestSessionId: 'guest_123',
          analyticsSessionId: 'sess_vis_1',
          mode: 'jd_match',
          status: 'completed',
          promptExcerpt: 'Staff Distributed Systems Engineer — Go + TypeScript + GCP',
          tokensUsed: 640,
          country: 'US',
          region: 'GA',
          city: 'Atlanta',
          asnOrg: 'Acme Recruiting Corp',
          contactId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          contactName: 'Ada Lovelace',
          createdAt: '2026-11-27T02:05:00.000Z',
        },
      ],
    };

    render(
      <MemoryRouter>
        <AdminAnalyticsPage data={enrichedData} />
      </MemoryRouter>,
    );

    // Filter controls & active filter chips
    expect(screen.getByRole('navigation', { name: 'Analytics bot filter' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Include Bots' }).getAttribute('href')).toContain(
      'bots=include',
    );
    expect(screen.getByRole('link', { name: 'Bots Only' }).getAttribute('href')).toContain(
      'bots=only',
    );
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe(
      '/analytics?window=30d',
    );

    // Visitor-first KPI labels
    expect(screen.getByText('Unique Visitors')).toBeTruthy();
    expect(screen.getByText('Filtered Bots')).toBeTruthy();
    expect(screen.getByText('Profile Views')).toBeTruthy();

    // Recent Visitors expandable trail & Contact Name badge -> /inbox?selected=<uuid>
    const visitorsFeed = screen.getByTestId('analytics-recent-visitors');
    expect(visitorsFeed.textContent).toContain('Atlanta, GA, US');
    expect(visitorsFeed.textContent).toContain('Acme Recruiting Corp');
    const contactLink = screen.getAllByRole('link', { name: /Ada Lovelace/i })[0];
    expect(contactLink?.getAttribute('href')).toBe(
      '/inbox?selected=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(visitorsFeed.textContent).toContain('about_outbound_click');

    // Visitor Q&A / JD Match feed
    const askFeed = screen.getByTestId('analytics-ask-feed');
    expect(askFeed.textContent).toContain('JD Match');
    expect(askFeed.textContent).toContain('Staff Distributed Systems Engineer');
  });
});
