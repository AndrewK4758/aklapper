import { afterEach, describe, expect, it } from 'vitest';

import {
  closeSharedDb,
  getPrerenderAdminAnalyticsData,
  getPrerenderAdminHomeData,
  getPrerenderAdminRootData,
  getPrerenderPortalAgensiData,
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalMaintenanceData,
  getPrerenderPortalMenuData,
  getPrerenderPortalRootData,
  loadAdminAnalyticsDataWithPrerender,
  loadPortalContactDataWithPrerender,
  loadPortalHomeDataWithPrerender,
  withPrerenderFallback,
} from '../src/index.ts';

describe('db prerender fallback loaders', () => {
  const originalBuildReq = process.env['IS_RR_BUILD_REQUEST'];
  const originalDbUrl = process.env['DATABASE_URL'];

  afterEach(async () => {
    await closeSharedDb();

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
    const portalRoot = getPrerenderPortalRootData();
    const portalHome = getPrerenderPortalHomeData();
    const adminRoot = getPrerenderAdminRootData();

    expect(portalRoot.chrome.pageTitle).toContain('andrew-k.us');
    expect(portalRoot.chrome.shortcutHint).toContain('split');
    expect(getPrerenderPortalRootData(true).maintenance?.content.heading).toBe(
      'Changes in Progress',
    );
    expect(portalHome.terminal.commands.length).toBeGreaterThan(0);
    expect(portalHome.terminal.initialEntries[0]?.command).toBe('ls');
    expect(portalHome.terminal.initialEntries[0]?.output).toContain(
      'menu                  # Site menu',
    );
    expect(portalHome.terminal.initialEntries[0]?.output).toContain(
      'changes-in-progress   # Maintenance preview',
    );
    expect(portalHome.terminal.initialEntries[0]?.output).not.toMatch(
      /drwxr-xr-x|-rw-r--r--|menu\//,
    );
    const portalHelp = portalHome.terminal.commands.find(cmd => cmd.name === 'help')?.output ?? '';
    expect(portalHelp).toContain('Split panes & tabs (keybindings & commands):');
    expect(portalHelp).not.toMatch(/ghostty/i);

    expect(getPrerenderPortalMenuData().items.every(item => !item.adminOnly)).toBe(true);
    expect(getPrerenderPortalAgensiData().skills.length).toBeGreaterThanOrEqual(4);
    expect(getPrerenderPortalAskData().content.starterQuestions.length).toBeGreaterThan(0);
    expect(getPrerenderPortalAskData().quota).toEqual({
      role: 'guest',
      turnsUsed: 0,
      maxTurns: 5,
      tokensUsed: 0,
      maxTokens: 20_000,
    });
    expect(getPrerenderPortalCadenceData().presets.length).toBeGreaterThan(0);
    expect(getPrerenderPortalContactData().content.form.id).toBe('contact-form');
    expect(getPrerenderPortalMaintenanceData().milestones.length).toBeGreaterThan(0);

    expect(adminRoot.chrome.brandLabel).toContain('admin.andrew-k.us');
    expect(adminRoot.chrome.shortcutHint).toContain('split');
    const adminHelp = adminRoot.terminal?.commands.find(cmd => cmd.name === 'help')?.output ?? '';
    expect(adminHelp).toContain('Split panes & tabs (keybindings & commands):');
    expect(adminHelp).not.toMatch(/ghostty/i);
    expect(JSON.stringify(adminRoot.terminal)).not.toMatch(/ghostty/i);
    expect(JSON.stringify(portalHome.terminal)).not.toMatch(/ghostty/i);

    expect(getPrerenderAdminHomeData().menuItems.some(item => item.adminOnly)).toBe(true);
    expect(getPrerenderAdminAnalyticsData().summary).toEqual({ totalSessions: 0, totalEvents: 0 });
  });

  it('uses seed fallback during React Router prerender builds when DATABASE_URL is unset', async () => {
    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    delete process.env['DATABASE_URL'];

    const home = await loadPortalHomeDataWithPrerender();
    const contact = await loadPortalContactDataWithPrerender();
    const analytics = await loadAdminAnalyticsDataWithPrerender();

    expect(home.content.heading).toContain('Solar Forge');
    expect(contact.content.form.nodes.length).toBeGreaterThan(0);
    expect(analytics.summary).toEqual({ totalSessions: 0, totalEvents: 0 });
  });

  it('falls back to seed data during prerender builds when the database query rejects', async () => {
    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    process.env['DATABASE_URL'] = 'postgresql://aklapper:aklapper@127.0.0.1:59999/unreachable';

    const result = await withPrerenderFallback(
      async () => {
        throw new Error('ECONNREFUSED');
      },
      () => ({ recovered: true }),
    );

    expect(result).toEqual({ recovered: true });
  });

  it('fails loud outside prerender builds when DATABASE_URL is missing', async () => {
    delete process.env['IS_RR_BUILD_REQUEST'];
    delete process.env['DATABASE_URL'];

    await expect(loadPortalHomeDataWithPrerender()).rejects.toThrow(/DATABASE_URL is required/i);
  });
});
