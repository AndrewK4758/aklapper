import { once } from 'node:events';
import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import * as dbExports from '../src/index.ts';
import {
  closeSharedDb,
  getPrerenderAdminAnalyticsData,
  getPrerenderAdminHomeData,
  getPrerenderAdminRootData,
  getPrerenderPortalAboutData,
  getPrerenderPortalAgensiData,
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalRootData,
  loadAdminAnalyticsDataWithPrerender,
  loadPortalAboutDataWithPrerender,
  loadPortalAgensiDataWithPrerender,
  loadPortalContactDataWithPrerender,
  loadPortalHomeDataWithPrerender,
  withPrerenderFallback,
} from '../src/index.ts';

describe('db prerender fallback loaders', () => {
  const originalBuildReq = process.env['IS_RR_BUILD_REQUEST'];
  const originalDbUrl = process.env['DATABASE_URL'];
  const originalAgensiBase = process.env['AGENSI_API_BASE_URL'];

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

    if (originalAgensiBase === undefined) {
      delete process.env['AGENSI_API_BASE_URL'];
    } else {
      process.env['AGENSI_API_BASE_URL'] = originalAgensiBase;
    }
  });

  it('builds complete validated seed snapshots for all portal and admin routes', () => {
    const portalRoot = getPrerenderPortalRootData();
    const portalHome = getPrerenderPortalHomeData();
    const adminRoot = getPrerenderAdminRootData();

    expect(portalRoot.chrome.pageTitle).toContain('andrew-k.us');
    expect(portalRoot.chrome.shortcutHint).toContain('Alt+⇧N');
    expect(portalRoot.chrome.shortcutHint).not.toMatch(/Alt\+⇧T|⌘D/);
    expect('maintenanceMode' in portalRoot).toBe(false);
    expect('maintenance' in portalRoot).toBe(false);
    expect('getPrerenderPortalMaintenanceData' in dbExports).toBe(false);
    expect('loadPortalMaintenanceDataWithPrerender' in dbExports).toBe(false);
    expect('loadPortalMaintenanceData' in dbExports).toBe(false);
    expect('getRoadmapMilestones' in dbExports).toBe(false);
    expect(portalHome.terminal.commands.length).toBeGreaterThan(0);
    expect(portalHome.terminal.initialEntries[0]?.command).toBe('ls');
    expect(portalHome.terminal.initialEntries[0]?.output).toContain(
      'about     # Resume & platform services guide',
    );
    expect(portalHome.terminal.initialEntries[0]?.output).toContain('tui       # TUI version');
    expect(portalHome.terminal.initialEntries[0]?.output).not.toContain('menu');
    expect(portalHome.terminal.initialEntries[0]?.output).not.toContain('changes-in-progress');
    expect(portalHome.terminal.initialEntries[0]?.output).not.toContain('Maintenance preview');
    expect(portalHome.terminal.initialEntries[0]?.output).not.toMatch(
      /drwxr-xr-x|-rw-r--r--|menu\//,
    );
    expect(portalHome.content.actions.some(a => a.to === '/about')).toBe(true);
    expect(portalHome.content.actions.some(a => a.to === '/changes-in-progress')).toBe(false);
    expect(portalHome.content.portrait).toEqual({
      src: '/images/andrew-klapper-portrait.webp',
      alt: 'Greyscale terminal portrait of Andrew Klapper',
      caption: 'andrew@andrew-k.us :: tty1',
      width: 440,
      height: 520,
    });
    expect(portalRoot.homeContent?.portrait).toEqual(portalHome.content.portrait);
    expect(portalRoot.homeContent?.resumeSummary).toEqual(portalHome.content.resumeSummary);
    expect(portalHome.content.resumeSummary.publicEmail).toBe('andrew@andrew-k.us');
    expect(portalHome.content.resumeSummary.githubUrl).toBe('https://github.com/AndrewK4758');
    expect(portalHome.content.resumeSummary.highlights.join('\n')).toMatch(/Ghostty Union/);
    expect(portalHome.content.resumeSummary.services.map(s => s.command)).toEqual([
      'cadence',
      'chat',
      'agensi',
      'about',
      'contact',
    ]);
    const homeSummaryJson = JSON.stringify(portalHome.content.resumeSummary);
    expect(homeSummaryJson).not.toMatch(/References|\bGA\s+\d{5}\b|\(\d{3}\)\s*\d{3}-\d{4}/i);
    expect(homeSummaryJson).not.toMatch(/\bzsh\b|p10k|powerlevel10k/i);
    const cdCommand = portalHome.terminal.commands.find(cmd => cmd.name === 'cd');
    expect(cdCommand?.allowedRoutes).toEqual(['about', 'cadence', 'chat', 'agensi', 'contact']);
    expect(cdCommand?.errorTemplate).not.toContain('changes-in-progress');
    const portalHelp = portalHome.terminal.commands.find(cmd => cmd.name === 'help')?.output ?? '';
    expect(portalHelp).toContain('about');
    expect(portalHelp).not.toContain('changes-in-progress');
    expect(portalHelp).toContain('Split panes & tabs (keybindings & commands):');
    expect(portalHelp).toContain('Alt+Shift+N');
    expect(portalHelp).toContain('F2');
    expect(portalHelp).toContain('Alt+Shift+1..9');
    expect(portalHelp).toContain('Alt+H/J/K/L');
    expect(portalHelp).toContain('Alt+Backspace');
    expect(portalHelp).not.toMatch(
      /ghostty|Ctrl\+Shift\+O|\bCmd\+D\b|\bCtrl\+W\b|\bCtrl\+N\b|Alt\+1\.\.9/i,
    );

    const prerenderAgensi = getPrerenderPortalAgensiData();
    expect(prerenderAgensi.skills).toHaveLength(6);
    expect(prerenderAgensi.catalogMeta?.mode).toBe('prerender');
    expect(
      prerenderAgensi.skills.every(
        skill =>
          skill.creatorHandle === 'aklapper' &&
          skill.isPublished === true &&
          skill.source === 'prerender',
      ),
    ).toBe(true);
    expect(getPrerenderPortalAskData().content.starterQuestions.length).toBeGreaterThan(0);
    expect(getPrerenderPortalAskData().quota).toEqual({
      role: 'guest',
      turnsUsed: 0,
      maxTurns: 10,
      tokensUsed: 0,
      maxTokens: 40_000,
    });
    expect(getPrerenderPortalCadenceData().presets.length).toBeGreaterThan(0);
    expect(getPrerenderPortalContactData().content.form.id).toBe('contact-form');
    const prerenderAbout = getPrerenderPortalAboutData();
    expect(prerenderAbout.content.identity.fullName).toBe('Andrew Klapper');
    expect(prerenderAbout.dossiers).toHaveLength(10);
    expect(prerenderAbout.brandContactEmail).toBe('andrew@andrew-k.us');

    expect(adminRoot.chrome.brandLabel).toContain('admin.andrew-k.us');
    expect(adminRoot.chrome.shortcutHint).toContain('Alt+⇧N');
    expect(adminRoot.chrome.shortcutHint).not.toMatch(/Alt\+⇧T|⌘D/);
    const adminHelp = adminRoot.terminal?.commands.find(cmd => cmd.name === 'help')?.output ?? '';
    expect(adminHelp).toContain('Split panes & tabs (keybindings & commands):');
    expect(adminHelp).toContain('Alt+Shift+N');
    expect(adminHelp).toContain('F2');
    expect(adminHelp).not.toMatch(/ghostty|Ctrl\+Shift\+O|\bCmd\+D\b|Alt\+1\.\.9/i);
    expect(JSON.stringify(adminRoot.terminal)).not.toMatch(/ghostty/i);
    expect(JSON.stringify(portalHome.terminal)).not.toMatch(/ghostty/i);

    expect(getPrerenderAdminHomeData().menuItems.some(item => item.adminOnly)).toBe(true);
    expect(getPrerenderAdminAnalyticsData().summary).toEqual({ totalSessions: 0, totalEvents: 0 });
  });

  it('uses seed fallback during React Router prerender builds when DATABASE_URL is unset', async () => {
    process.env['IS_RR_BUILD_REQUEST'] = 'yes';
    delete process.env['DATABASE_URL'];

    const home = await loadPortalHomeDataWithPrerender();
    const about = await loadPortalAboutDataWithPrerender();
    const contact = await loadPortalContactDataWithPrerender();
    const analytics = await loadAdminAnalyticsDataWithPrerender();

    expect(home.content.heading).toContain('Andrew Klapper');
    expect(about.content.identity.location).toBe('Marietta, GA');
    expect(about.dossiers).toHaveLength(10);
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

  it('skips live external Agensi HTTP calls when IS_RR_BUILD_REQUEST=yes', async () => {
    let requestCount = 0;
    const spyServer = createServer((_req, res) => {
      requestCount += 1;
      res.statusCode = 500;
      res.end('should not be called');
    });
    spyServer.listen(0, '127.0.0.1');
    await once(spyServer, 'listening');
    const addr = spyServer.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('Failed to bind spy server');
    }

    try {
      process.env['IS_RR_BUILD_REQUEST'] = 'yes';
      process.env['AGENSI_API_BASE_URL'] = `http://127.0.0.1:${addr.port}`;

      // With DATABASE_URL unset -> returns creator-scoped prerender snapshot, zero HTTP
      delete process.env['DATABASE_URL'];
      const noDbData = await loadPortalAgensiDataWithPrerender({
        correlationId: 'prerender-no-db',
      });
      expect(noDbData.skills).toHaveLength(6);
      expect(noDbData.catalogMeta?.mode).toBe('prerender');
      expect(requestCount).toBe(0);

      // Even with DATABASE_URL active -> skipLiveSync suppresses upstream Agensi HTTP during build
      expect(originalDbUrl).toBeTruthy();
      process.env['DATABASE_URL'] = originalDbUrl;
      const dbPrerenderData = await loadPortalAgensiDataWithPrerender({
        correlationId: 'prerender-with-db',
      });
      expect(dbPrerenderData.skills.length).toBeGreaterThan(0);
      expect(requestCount).toBe(0);
    } finally {
      await new Promise<void>(resolveClose => spyServer.close(() => resolveClose()));
    }
  });
});
