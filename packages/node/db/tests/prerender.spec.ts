import { afterEach, describe, expect, it } from 'vitest';

import {
  getPrerenderAdminAnalyticsData,
  getPrerenderAdminHomeData,
  getPrerenderAdminRootData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalHomeData,
  getPrerenderPortalMaintenanceData,
  getPrerenderPortalMenuData,
  getPrerenderPortalRootData,
  loadAdminAnalyticsDataWithPrerender,
  loadPortalHomeDataWithPrerender,
} from '../src/index.ts';

describe('db prerender fallback loaders', () => {
  const originalBuildReq = process.env['IS_RR_BUILD_REQUEST'];
  const originalDbUrl = process.env['DATABASE_URL'];

  afterEach(() => {
    if (originalBuildReq === undefined) {
      delete process.env['IS_RR_BUILD_REQUEST'];
    } else {
      process.env['IS_RR_BUILD_REQUEST'] = originalBuildReq;
    }

    if (originalDbUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDbUrl;
    }
  });

  it('builds complete validated seed snapshots for all portal and admin routes', () => {
    expect(getPrerenderPortalRootData().chrome.pageTitle).toContain('andrew-k.us');
    expect(getPrerenderPortalRootData(true).maintenance?.content.heading).toBe(
      'Changes in Progress',
    );
    expect(getPrerenderPortalHomeData().terminal.commands.length).toBeGreaterThan(0);
    expect(getPrerenderPortalMenuData().items.every(item => !item.adminOnly)).toBe(true);
    expect(getPrerenderPortalCadenceData().presets.length).toBeGreaterThan(0);
    expect(getPrerenderPortalMaintenanceData().milestones.length).toBeGreaterThan(0);
    expect(getPrerenderAdminRootData().chrome.brandLabel).toContain('admin.andrew-k.us');
    expect(getPrerenderAdminHomeData().menuItems.some(item => item.adminOnly)).toBe(true);
    expect(getPrerenderAdminAnalyticsData().summary).toEqual({ totalSessions: 0, totalEvents: 0 });
  });

  it('uses seed fallback during React Router prerender builds when DATABASE_URL is unset', async () => {
    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    delete process.env['DATABASE_URL'];

    const home = await loadPortalHomeDataWithPrerender();
    const analytics = await loadAdminAnalyticsDataWithPrerender();

    expect(home.content.heading).toContain('Solar Forge');
    expect(analytics.summary).toEqual({ totalSessions: 0, totalEvents: 0 });
  });

  it('fails loud outside prerender builds when DATABASE_URL is missing', async () => {
    delete process.env['IS_RR_BUILD_REQUEST'];
    delete process.env['DATABASE_URL'];

    await expect(loadPortalHomeDataWithPrerender()).rejects.toThrow(/DATABASE_URL is required/i);
  });
});
