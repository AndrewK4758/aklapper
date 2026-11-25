import type { AdminOverviewLoaderData } from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AdminHomePage } from './index';

const OVERVIEW_DATA: AdminOverviewLoaderData = {
  content: {
    heading: 'Operations Console',
    description: 'Isolated admin operations console.',
    actions: [{ label: 'Analytics Telemetry', to: '/analytics', variant: 'primary' }],
  },
  menuItems: [
    {
      slug: 'analytics',
      title: 'Analytics Telemetry',
      description: 'Telemetry dashboard',
      keyShortcut: 'a',
      sortOrder: 1,
      adminOnly: true,
      namespace: 'portfolio-admin',
      enabled: true,
      targetK8sDeploy: null,
    },
  ],
  health: {
    postgres: { name: 'PostgreSQL 19', status: 'ok', detail: 'Connected' },
    qdrant: { name: 'Qdrant', status: 'ok', detail: 'portfolio_docs (12 points)' },
    portfolioPublic: { name: 'portfolio-public', status: 'ok', detail: 'Scale-to-0 watcher ready' },
  },
  metrics: {
    contactCount: 4,
    sessions24h: 19,
    events24h: 82,
    dailyTokensUsed: 1200,
    dailyTokenCap: 100000,
    totalSandboxRuns: 3,
    pendingGates: 1,
  },
  maintenanceModeDefault: false,
  rebuildProgressPercent: 60,
  security: {
    handle: 'admin',
    passkeyCount: 1,
    totpEnabled: false,
  },
};

describe('admin/pages/home', () => {
  it('renders overview health cards, KPIs, security settings trigger, and registry items', () => {
    render(
      <MemoryRouter>
        <AdminHomePage data={OVERVIEW_DATA} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: OVERVIEW_DATA.content.heading })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Analytics Telemetry' }).getAttribute('href')).toBe(
      '/analytics',
    );
    expect(screen.getByText('PostgreSQL 19')).toBeTruthy();
    expect(screen.getAllByText('portfolio-public').length).toBeGreaterThan(0);
    expect(screen.queryByText('cadence-admin')).toBeNull();
    expect(screen.getByText('PORTAL LIVE')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Security Settings' })).toBeTruthy();
    expect(screen.getByText(/\(admin\)/)).toBeTruthy();
  });

  it('renders local inline QR SVG alongside Base32 secret, otpauth URI, and backup codes on TOTP enrollment', async () => {
    const otpauthUrl =
      'otpauth://totp/andrew-k.us%20Admin:admin?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=andrew-k.us+Admin&algorithm=SHA1&digits=6&period=30';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
          otpauthUrl,
          backupCodes: [
            'AAAA-1111',
            'BBBB-2222',
            'CCCC-3333',
            'DDDD-4444',
            'EEEE-5555',
            'FFFF-6666',
            'GGGG-7777',
            'HHHH-8888',
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    try {
      render(
        <MemoryRouter>
          <AdminHomePage data={OVERVIEW_DATA} />
        </MemoryRouter>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Security Settings' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Enroll TOTP 2FA' }));

      const qrImg = await screen.findByRole('img', { name: 'TOTP 2FA QR Code' });
      expect(qrImg.tagName.toLowerCase()).toBe('svg');
      expect(screen.getByTestId('totp-secret').textContent).toBe(
        'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      );
      expect(screen.getByTestId('totp-uri').textContent).toBe(otpauthUrl);
      expect(screen.getByText('AAAA-1111')).toBeTruthy();
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
