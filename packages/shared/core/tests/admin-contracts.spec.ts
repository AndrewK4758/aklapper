import {
  AdminAnalyticsLoaderDataSchema,
  AdminAnalyticsWindowSchema,
  AdminCmsLoaderDataSchema,
  AdminGateOverrideSchema,
  AdminInboxLoaderDataSchema,
  AdminOpsLoaderDataSchema,
  AdminOverviewLoaderDataSchema,
  AdminQuotasLoaderDataSchema,
  AdminWakeDeploymentSchema,
  AgensiSkillUpsertSchema,
  AgensiSyncStateSchema,
  BucketPurgeSchema,
  BucketResetSchema,
  CadencePresetUpsertSchema,
  MaintenanceModeUpdateSchema,
  MenuItemUpsertSchema,
  QdrantHealthStatusSchema,
  QuotaPolicyUpdateSchema,
  RoadmapMilestoneUpsertSchema,
  SiteContentUpsertSchema,
  TerminalCommandUpsertSchema,
  TerminalInitialEntryUpsertSchema,
  TerminalProfileUpsertSchema,
} from '../src/index.ts';

describe('@aklapper/core admin console contracts', () => {
  it('validates AdminOverviewLoaderDataSchema', () => {
    const parsed = AdminOverviewLoaderDataSchema.parse({
      content: {
        heading: 'Admin Operations Console',
        description: 'Isolated ops hub.',
        actions: [{ label: 'Analytics', to: '/analytics', variant: 'primary' }],
      },
      menuItems: [],
      health: {
        postgres: { name: 'PostgreSQL 19', status: 'ok', detail: 'Connected' },
        qdrant: { name: 'Qdrant', status: 'ok', detail: '12 points' },
        portfolioPublic: { name: 'portfolio-public', status: 'ok', detail: 'Ready' },
      },
      metrics: {
        contactCount: 4,
        sessions24h: 18,
        events24h: 92,
        dailyTokensUsed: 1500,
        dailyTokenCap: 100000,
        totalSandboxRuns: 7,
        pendingGates: 2,
      },
      maintenanceModeDefault: false,
      rebuildProgressPercent: 72,
      security: {
        handle: 'aklapper',
        passkeyCount: 2,
        totpEnabled: true,
      },
    });

    expect(parsed.metrics.pendingGates).toBe(2);
    expect(parsed.security.totpEnabled).toBe(true);
  });

  it('validates windowed AdminAnalyticsLoaderDataSchema with CWV percentiles and funnels', () => {
    expect(AdminAnalyticsWindowSchema.parse('24h')).toBe('24h');
    expect(() => AdminAnalyticsWindowSchema.parse('90d')).toThrow(/Invalid/i);

    const parsed = AdminAnalyticsLoaderDataSchema.parse({
      content: {
        windowTitle: 'Analytics // PG19',
        description: 'Telemetry',
      },
      window: '30d',
      totalSessions: 25,
      totalEvents: 140,
      summary: { totalSessions: 25, totalEvents: 140 },
      cwv: [
        { metric: 'LCP', sampleCount: 10, p50: 1200, p75: 1650, p95: 2300 },
        { metric: 'INP', sampleCount: 8, p50: 45, p75: 80, p95: 120 },
        { metric: 'CLS', sampleCount: 10, p50: 0.01, p75: 0.03, p95: 0.08 },
        { metric: 'TTFB', sampleCount: 10, p50: 95, p75: 140, p95: 210 },
      ],
      topPaths: [{ label: '/cadence', count: 50 }],
      topReferrers: [{ label: 'direct', count: 20 }],
      geoBreakdown: [{ label: 'US', secondaryLabel: 'GA', count: 19 }],
      agensiConversions: [{ slug: 'solar-forge-cli', clicks: 6 }],
      aiMetrics: {
        totalRuns: 5,
        totalTokensIn: 1200,
        totalTokensOut: 3400,
        approvedGates: 3,
        rejectedGates: 1,
        pendingGates: 1,
        abstentionEvents: 2,
      },
    });

    expect(parsed.cwv).toHaveLength(4);
    expect(parsed.agensiConversions[0]?.clicks).toBe(6);
  });

  it('validates inbox, quota policies, bucket reset/purge, and ops mutation schemas', () => {
    const inbox = AdminInboxLoaderDataSchema.parse({
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: null,
          message: 'Interested in collaborating on Go and React SSR systems.',
          attachmentName: 'brief.txt',
          attachmentMimeType: 'text/plain',
          attachmentSizeBytes: 128,
          attachmentSha256: 'a'.repeat(64),
          createdAt: '2026-11-24T12:00:00.000Z',
        },
      ],
      totalCount: 1,
      page: 1,
      pageSize: 20,
      query: 'ada',
    });
    expect(inbox.items[0]?.attachmentName).toBe('brief.txt');

    const quotas = AdminQuotasLoaderDataSchema.parse({
      policies: [
        {
          role: 'guest',
          maxTurnsPerSession: 5,
          maxTokensPerRun: 4000,
          maxDailyGlobalTokens: 100000,
        },
      ],
      buckets: [
        {
          scopeKey: 'session:abc',
          windowStart: '2026-11-24T12:00:00.000Z',
          turnsUsed: 2,
          tokensUsed: 900,
        },
      ],
    });
    expect(quotas.policies[0]?.role).toBe('guest');

    expect(
      QuotaPolicyUpdateSchema.parse({
        role: 'guest',
        maxTurnsPerSession: '8',
        maxTokensPerRun: '5000',
        maxDailyGlobalTokens: '150000',
      }).maxTurnsPerSession,
    ).toBe(8);
    expect(BucketResetSchema.parse({ scopeKey: 'session:abc' }).scopeKey).toBe('session:abc');
    expect(BucketPurgeSchema.parse({ olderThanHours: '48' }).olderThanHours).toBe(48);

    expect(
      AdminGateOverrideSchema.parse({
        runId: '11111111-1111-4111-8111-111111111111',
        gateVerdict: 'approved',
      }).gateVerdict,
    ).toBe('approved');
    expect(() =>
      AdminGateOverrideSchema.parse({ runId: 'not-a-uuid', gateVerdict: 'approved' }),
    ).toThrow(/UUID/i);
    expect(AdminWakeDeploymentSchema.parse({ deployment: 'svc-cadence-demo' }).deployment).toBe(
      'svc-cadence-demo',
    );
    expect(() => AdminWakeDeploymentSchema.parse({ deployment: '../evil' })).toThrow(/Invalid/i);
  });

  it('validates CMS loader and CRUD upsert schemas', () => {
    const cms = AdminCmsLoaderDataSchema.parse({
      siteContents: [
        {
          key: 'portal-chrome',
          markdownBody: '# Chrome',
          metadataJson: { maintenanceModeDefault: false },
          updatedAt: '2026-11-24T12:00:00.000Z',
        },
      ],
      maintenanceModeDefault: false,
      rebuildProgressPercent: 60,
      menuItems: [],
      terminalProfiles: [],
      terminalCommands: [],
      terminalInitialEntries: [],
      roadmapMilestones: [],
      agensiSkills: [],
      cadencePresets: [],
    });
    expect(cms.siteContents).toHaveLength(1);

    expect(
      SiteContentUpsertSchema.parse({
        key: 'admin-home',
        markdownBody: 'Body',
        metadataJson: { heading: 'Ops' },
      }).key,
    ).toBe('admin-home');

    expect(
      MaintenanceModeUpdateSchema.parse({ enabled: true, rebuildProgressPercent: '85' })
        .rebuildProgressPercent,
    ).toBe(85);

    expect(
      MenuItemUpsertSchema.parse({
        slug: 'ops-check',
        keyShortcut: '7',
        title: 'Ops Check',
        description: 'Health check',
        targetK8sDeploy: 'svc-ops',
        namespace: 'portfolio-public',
        adminOnly: false,
        sortOrder: '7',
        enabled: true,
      }).sortOrder,
    ).toBe(7);

    expect(
      TerminalProfileUpsertSchema.parse({
        slug: 'portal-home',
        bannerTitle: 'Banner',
        bannerMeta: 'Meta',
        osLabel: '⚡',
        directory: '~/app',
        vcsBranch: 'main',
        vcsState: 'clean',
        contextLabel: 'guest',
        placeholder: 'cmd',
        quickCommands: ['help'],
      }).slug,
    ).toBe('portal-home');

    expect(
      TerminalCommandUpsertSchema.parse({
        profileSlug: 'portal-home',
        name: 'status',
        description: 'Show status',
        kind: 'static',
        output: 'ok',
        targetRoute: null,
        allowedRoutes: [],
        errorTemplate: null,
        sortOrder: '1',
      }).name,
    ).toBe('status');

    expect(
      TerminalInitialEntryUpsertSchema.parse({
        profileSlug: 'portal-home',
        command: 'whoami',
        output: 'guest',
        status: 'ok',
        durationLabel: '2ms',
        timestampLabel: '00:00:00',
        sortOrder: '0',
      }).status,
    ).toBe('ok');

    expect(
      RoadmapMilestoneUpsertSchema.parse({
        slug: 'phase-5',
        status: 'active',
        label: 'Admin console launch',
        sortOrder: '5',
        enabled: true,
      }).status,
    ).toBe('active');

    expect(
      AgensiSkillUpsertSchema.parse({
        slug: 'cloud-ops',
        name: 'Cloud Ops',
        summary: 'Automates GKE Autopilot checks',
        tags: ['gke', 'ops'],
        url: 'https://agensi.io/skills/cloud-ops',
        sortOrder: '2',
      }).slug,
    ).toBe('cloud-ops');

    expect(
      CadencePresetUpsertSchema.parse({
        slug: 'ops-tile',
        title: 'Ops Tile',
        starterPrompt: 'Build an ops tile',
        expectedKind: 'widget',
        starterArtifactHtml: '<html><body>ok</body></html>',
        sortOrder: '3',
      }).slug,
    ).toBe('ops-tile');

    const ops = AdminOpsLoaderDataSchema.parse({
      qdrantStatus: {
        online: true,
        collection: 'portfolio_docs',
        status: 'ready',
        pointsCount: 14,
        provider: 'local',
      },
      sandboxRuns: [],
      k8sWatchConfigured: false,
    });
    expect(ops.qdrantStatus.collection).toBe('portfolio_docs');

    const legacyHealth = QdrantHealthStatusSchema.parse({
      online: true,
      collection: 'portfolio_docs',
      status: 'green',
      pointsCount: 11,
      provider: 'local',
    });
    expect(legacyHealth.collections).toBeUndefined();

    const multiHealth = QdrantHealthStatusSchema.parse({
      online: true,
      collection: 'portfolio_docs',
      status: 'green',
      pointsCount: 11,
      provider: 'qdrant-direct',
      collections: [
        { name: 'portfolio_docs', online: true, status: 'green', pointsCount: 11 },
        { name: 'cadence_patterns', online: true, status: 'green', pointsCount: 8 },
      ],
    });
    expect(multiHealth.collections).toHaveLength(2);
  });

  it('validates optional agensiSyncState inside AdminCmsLoaderDataSchema', () => {
    const syncState = AgensiSyncStateSchema.parse({
      creatorHandle: 'aklapper',
      lastSyncedAt: '2026-11-24T12:00:00.000Z',
      lastAttemptAt: '2026-11-24T12:05:00.000Z',
      lastStatus: 'ok',
      lastError: null,
      itemCount: 6,
    });
    expect(syncState.itemCount).toBe(6);

    const cmsWithSync = AdminCmsLoaderDataSchema.parse({
      siteContents: [],
      maintenanceModeDefault: false,
      rebuildProgressPercent: 50,
      menuItems: [],
      terminalProfiles: [],
      terminalCommands: [],
      terminalInitialEntries: [],
      roadmapMilestones: [],
      agensiSkills: [],
      agensiSyncState: syncState,
      cadencePresets: [],
    });
    expect(cmsWithSync.agensiSyncState?.lastStatus).toBe('ok');
  });
});
