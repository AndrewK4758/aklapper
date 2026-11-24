import type { AdminAnalyticsContent, AdminAnalyticsSummary } from '@aklapper/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AdminAnalyticsPage } from './index';

const CONTENT: AdminAnalyticsContent = {
  windowTitle: 'ANALYTICS // Telemetry',
  description: 'First-party visitor telemetry.',
};

const SUMMARY: AdminAnalyticsSummary = {
  totalSessions: 14,
  totalEvents: 42,
};

describe('admin/pages/analytics', () => {
  it('renders telemetry counts and event meter', () => {
    render(<AdminAnalyticsPage content={CONTENT} summary={SUMMARY} />);

    expect(screen.getByText(CONTENT.description)).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('42 / 100')).toBeTruthy();
  });
});
