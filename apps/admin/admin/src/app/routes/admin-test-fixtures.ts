import type {
  AdminAnalyticsLoaderData,
  AdminCmsLoaderData,
  AdminInboxLoaderData,
  AdminOpsLoaderData,
  AdminOverviewLoaderData,
  AdminQuotasLoaderData,
  QdrantHealthStatus,
} from '@aklapper/core';

export const UNAUTH_STATUS = {
  authenticated: false,
  session: null,
  totpEnabled: false,
  passkeyCount: 0,
};

export const AUTH_STATUS = {
  authenticated: true,
  session: {
    sessionId: '11111111-1111-4111-8111-111111111111',
    role: 'admin' as const,
    handle: 'aklapper',
    expiresAt: '2026-12-01T00:00:00.000Z',
  },
  totpEnabled: true,
  passkeyCount: 1,
};

export const ADMIN_OVERVIEW_FIXTURE: AdminOverviewLoaderData = {
  content: {
    heading: 'Admin Operations Console',
    description: 'Manage passkey auth, portal content, and analytics.',
    actions: [{ label: 'Open Telemetry View', to: '/analytics', variant: 'primary' }],
  },
  menuItems: [
    {
      slug: 'cadence',
      keyShortcut: '1',
      title: 'CADENCE Builder',
      description: 'Public sandbox',
      targetK8sDeploy: 'svc-cadence-demo',
      namespace: 'portfolio-public',
      adminOnly: false,
      sortOrder: 1,
      enabled: true,
    },
    {
      slug: 'cadence-admin',
      keyShortcut: '9',
      title: 'Admin Ops',
      description: 'Internal admin route',
      targetK8sDeploy: 'svc-admin',
      namespace: 'portfolio-admin',
      adminOnly: true,
      sortOrder: 9,
      enabled: true,
    },
  ],
  health: {
    postgres: { name: 'PostgreSQL 19', status: 'ok', detail: 'Connected' },
    qdrant: { name: 'Qdrant', status: 'degraded', detail: 'Unconfigured' },
    portfolioPublic: { name: 'portfolio-public', status: 'ok', detail: 'Ready' },
    cadenceAdmin: { name: 'cadence-admin', status: 'ok', detail: 'Isolated' },
  },
  metrics: {
    contactCount: 3,
    sessions24h: 12,
    events24h: 48,
    dailyTokensUsed: 500,
    dailyTokenCap: 100000,
    totalSandboxRuns: 2,
    pendingGates: 1,
  },
  maintenanceModeDefault: false,
  rebuildProgressPercent: 60,
  security: { handle: 'admin', passkeyCount: 1, totpEnabled: false },
};

export const ADMIN_ANALYTICS_FIXTURE: AdminAnalyticsLoaderData = {
  content: {
    windowTitle: 'First-Party Visitor Analytics // Postgres 19',
    description: 'Telemetry ingested via node-api-analytics.',
  },
  window: '7d',
  totalSessions: 42,
  totalEvents: 150,
  summary: { totalSessions: 42, totalEvents: 150 },
  cwv: [{ metric: 'LCP', sampleCount: 5, p50: 1200, p75: 1500, p95: 2000 }],
  topPaths: [{ label: '/cadence', count: 40 }],
  topReferrers: [{ label: 'direct', count: 22 }],
  geoBreakdown: [{ label: 'US', secondaryLabel: 'GA', count: 20 }],
  agensiConversions: [{ slug: 'solar-forge-cli', clicks: 4 }],
  aiMetrics: {
    totalRuns: 2,
    totalTokensIn: 300,
    totalTokensOut: 900,
    approvedGates: 1,
    rejectedGates: 0,
    pendingGates: 1,
    abstentionEvents: 0,
  },
};

export const ADMIN_INBOX_FIXTURE: AdminInboxLoaderData = {
  items: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: null,
      message: 'Testing verified attachment download flow.',
      attachmentName: 'spec.txt',
      attachmentMimeType: 'text/plain',
      attachmentSizeBytes: 64,
      attachmentSha256: 'a'.repeat(64),
      createdAt: '2026-11-24T12:00:00.000Z',
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 20,
  query: '',
};

export const ADMIN_QUOTAS_FIXTURE: AdminQuotasLoaderData = {
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
      scopeKey: 'session:demo-1',
      windowStart: '2026-11-24T12:00:00.000Z',
      turnsUsed: 2,
      tokensUsed: 950,
    },
  ],
};

export const QDRANT_FIXTURE: QdrantHealthStatus = {
  online: false,
  collection: 'portfolio_docs',
  pointsCount: 0,
  status: 'unconfigured',
  provider: 'unconfigured',
  detail: 'Local fallback',
};

export const ADMIN_CMS_FIXTURE: AdminCmsLoaderData = {
  siteContents: [],
  maintenanceModeDefault: false,
  rebuildProgressPercent: 60,
  menuItems: ADMIN_OVERVIEW_FIXTURE.menuItems,
  terminalProfiles: [],
  terminalCommands: [],
  terminalInitialEntries: [],
  terminalDirectoryEntries: [],
  roadmapMilestones: [],
  agensiSkills: [
    {
      slug: 'cadence-governed-agentic-sdlc-framework',
      name: 'CADENCE: Governed Agentic SDLC Framework',
      summary: 'Governed agentic SDLC framework.',
      tags: ['sdlc', 'agents'],
      url: 'https://agensi.io/skills/cadence-governed-agentic-sdlc-framework',
      sortOrder: 1,
      creatorHandle: 'aklapper',
      isPublished: true,
      syncedAt: '2026-11-24T12:00:00.000Z',
      source: 'agensi_api',
    },
  ],
  agensiSyncState: {
    creatorHandle: 'aklapper',
    lastSyncedAt: '2026-11-24T12:00:00.000Z',
    lastAttemptAt: '2026-11-24T12:00:00.000Z',
    lastStatus: 'ok',
    lastError: null,
    itemCount: 1,
  },
  cadencePresets: [],
};

export const ADMIN_OPS_FIXTURE: AdminOpsLoaderData = {
  cadenceAdminStatus: {
    online: false,
    namespace: 'cadence-admin',
    isolated: true,
    mode: 'full-cadence-runtime',
    databaseConnected: false,
    totalSandboxRuns: 1,
    pendingGates: 1,
    timestamp: '2026-11-24T12:00:00.000Z',
    detail: 'Local fallback',
  },
  qdrantStatus: QDRANT_FIXTURE,
  sandboxRuns: [],
  k8sWatchConfigured: false,
};
