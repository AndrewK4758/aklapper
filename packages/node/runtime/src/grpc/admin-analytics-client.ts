import {
  AdminAnalyticsBreakdownsDataSchema,
  AdminAnalyticsContentSchema,
  AdminAnalyticsSummaryDataSchema,
  AdminHomeContentSchema,
  AdminOverviewLoaderDataSchema,
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsFilter,
  type AdminAnalyticsSummaryData,
  type AdminOverviewLoaderData,
  type AdminServiceHealth,
  type AnalyticsBatch,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import { mapProtoMenuItem } from './admin-cms-mappers.ts';
import {
  buildAdminGrpcCallMeta,
  parseAdminJsonObject,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { GrpcPayloadContractError } from './errors.ts';
import {
  AdminAnalyticsFilterSchema as ProtoAnalyticsFilterSchema,
  AdminAnalyticsService,
  GetAnalyticsBreakdownsRequestSchema,
  GetAnalyticsSummaryRequestSchema,
  GetOverviewDataRequestSchema,
  IngestAdminAnalyticsRequestSchema,
} from './gen/admin/v1/analytics_pb.ts';
import { AnalyticsEventSchema, ClientRequestContextSchema } from './gen/portal/v1/analytics_pb.ts';
import { encodeAnalyticsMetadataMap } from './portal-mappers.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

function createAnalyticsClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminAnalyticsService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

function toProtoFilter(filter: Partial<AdminAnalyticsFilter>) {
  return create(ProtoAnalyticsFilterSchema, {
    window: filter.window ?? '7d',
    ...(filter.source ? { source: filter.source } : {}),
    ...(filter.country ? { country: filter.country } : {}),
    ...(filter.path ? { path: filter.path } : {}),
    ...(filter.campaign ? { campaign: filter.campaign } : {}),
    bots: filter.bots ?? 'exclude',
    identified: filter.identified ?? 'all',
  });
}

export async function getAdminOverviewDataViaGrpc(
  sessionId: string,
  options: {
    readonly handle?: string;
    readonly passkeyCount?: number;
    readonly totpEnabled?: boolean;
    readonly qdrantHealth?: AdminServiceHealth;
    readonly portfolioPublicHealth?: AdminServiceHealth;
  } = {},
  ctx: AdminGrpcCallContext = {},
): Promise<AdminOverviewLoaderData> {
  const { client, meta } = createAnalyticsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAnalyticsService/GetOverviewData',
      meta,
      opts =>
        client.getOverviewData(
          create(GetOverviewDataRequestSchema, {
            sessionId,
            ...(options.handle !== undefined ? { handle: options.handle } : {}),
            ...(options.passkeyCount !== undefined ? { passkeyCount: options.passkeyCount } : {}),
            ...(options.totpEnabled !== undefined ? { totpEnabled: options.totpEnabled } : {}),
          }),
          opts,
        ),
    );
    const content = parseAdminJsonObject(res.contentJson, 'AdminHomeContent', v =>
      AdminHomeContentSchema.parse(v),
    );
    if (!res.postgresHealth || !res.metrics || !res.security) {
      throw new GrpcPayloadContractError('AdminOverviewLoaderData');
    }
    return AdminOverviewLoaderDataSchema.parse({
      content,
      menuItems: res.menuItems.map(mapProtoMenuItem),
      health: {
        postgres: {
          name: res.postgresHealth.name,
          status: res.postgresHealth.status,
          detail: res.postgresHealth.detail,
        },
        qdrant: options.qdrantHealth ?? {
          name: 'Qdrant',
          status: 'offline',
          detail: 'Qdrant status unavailable.',
        },
        portfolioPublic: options.portfolioPublicHealth ?? {
          name: 'Cloud Run Services',
          status: 'degraded',
          detail: 'Runtime health unavailable.',
        },
      },
      metrics: {
        contactCount: res.metrics.contactCount,
        sessions24h: res.metrics.sessions24h,
        events24h: res.metrics.events24h,
        dailyTokensUsed: Number(res.metrics.dailyTokensUsed),
        dailyTokenCap: Number(res.metrics.dailyTokenCap),
        totalSandboxRuns: res.metrics.totalSandboxRuns,
        pendingGates: res.metrics.pendingGates,
      },
      security: {
        handle: res.security.handle,
        passkeyCount: res.security.passkeyCount,
        totpEnabled: res.security.totpEnabled,
      },
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.analytics.overview', ctx);
  }
}

export async function getAdminAnalyticsSummaryViaGrpc(
  sessionId: string,
  filter: Partial<AdminAnalyticsFilter>,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminAnalyticsSummaryData> {
  const { client, meta } = createAnalyticsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAnalyticsService/GetAnalyticsSummary',
      meta,
      opts =>
        client.getAnalyticsSummary(
          create(GetAnalyticsSummaryRequestSchema, { filter: toProtoFilter(filter) }),
          opts,
        ),
    );
    const content = parseAdminJsonObject(res.contentJson, 'AdminAnalyticsContent', v =>
      AdminAnalyticsContentSchema.parse(v),
    );
    return AdminAnalyticsSummaryDataSchema.parse({
      content,
      window: res.window,
      filters: {
        window: res.filters?.window ?? res.window,
        ...(res.filters?.source ? { source: res.filters.source } : {}),
        ...(res.filters?.country ? { country: res.filters.country } : {}),
        ...(res.filters?.path ? { path: res.filters.path } : {}),
        ...(res.filters?.campaign ? { campaign: res.filters.campaign } : {}),
        bots: res.filters?.bots ?? 'exclude',
        identified: res.filters?.identified ?? 'all',
      },
      totalSessions: res.totalSessions,
      totalEvents: res.totalEvents,
      uniqueVisitors: res.uniqueVisitors,
      returningVisitors: res.returningVisitors,
      totalPageViews: res.totalPageViews,
      profileViews: res.profileViews,
      highIntentActions: res.highIntentActions,
      identifiedLeads: res.identifiedLeads,
      botSessionsExcluded: res.botSessionsExcluded,
      dailyTrend: res.dailyTrend.map(pt => ({
        date: pt.date,
        uniqueVisitors: pt.uniqueVisitors,
        sessions: pt.sessions,
        pageViews: pt.pageViews,
      })),
      summary: { totalSessions: res.totalSessions, totalEvents: res.totalEvents },
      cwv: res.cwv.map(row => ({
        metric: row.metric,
        sampleCount: row.sampleCount,
        p50: row.p50 ?? null,
        p75: row.p75 ?? null,
        p95: row.p95 ?? null,
      })),
      aiMetrics: {
        totalRuns: res.aiMetrics?.totalRuns ?? 0,
        totalTokensIn: Number(res.aiMetrics?.totalTokensIn ?? 0),
        totalTokensOut: Number(res.aiMetrics?.totalTokensOut ?? 0),
        approvedGates: res.aiMetrics?.approvedGates ?? 0,
        rejectedGates: res.aiMetrics?.rejectedGates ?? 0,
        pendingGates: res.aiMetrics?.pendingGates ?? 0,
        abstentionEvents: res.aiMetrics?.abstentionEvents ?? 0,
      },
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.analytics.summary', ctx);
  }
}

export async function getAdminAnalyticsBreakdownsViaGrpc(
  sessionId: string,
  filter: Partial<AdminAnalyticsFilter>,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminAnalyticsBreakdownsData> {
  const { client, meta } = createAnalyticsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAnalyticsService/GetAnalyticsBreakdowns',
      meta,
      opts =>
        client.getAnalyticsBreakdowns(
          create(GetAnalyticsBreakdownsRequestSchema, { filter: toProtoFilter(filter) }),
          opts,
        ),
    );
    const mapRow = (r: {
      label: string;
      count: number;
      secondaryLabel?: string;
      uniqueVisitors?: number;
      filterValue?: string;
    }) => ({
      label: r.label,
      count: r.count,
      ...(r.secondaryLabel !== undefined ? { secondaryLabel: r.secondaryLabel } : {}),
      ...(r.uniqueVisitors !== undefined ? { uniqueVisitors: r.uniqueVisitors } : {}),
      ...(r.filterValue !== undefined ? { filterValue: r.filterValue } : {}),
    });

    return AdminAnalyticsBreakdownsDataSchema.parse({
      topPaths: res.topPaths.map(mapRow),
      topReferrers: res.topReferrers.map(mapRow),
      geoBreakdown: res.geoBreakdown.map(mapRow),
      agensiConversions: res.agensiConversions.map(r => ({ slug: r.slug, clicks: r.clicks })),
      orgBreakdown: res.orgBreakdown.map(mapRow),
      campaignBreakdown: res.campaignBreakdown.map(mapRow),
      deviceBreakdown: res.deviceBreakdown.map(mapRow),
      osBreakdown: res.osBreakdown.map(mapRow),
      browserBreakdown: res.browserBreakdown.map(mapRow),
      conversionFunnel: res.conversionFunnel.map(f => ({
        step: f.step,
        label: f.label,
        sessions: f.sessions,
        conversionRate: f.conversionRate,
      })),
      recentVisitors: res.recentVisitors.map(v => ({
        sessionId: v.sessionId,
        startedAt: v.startedAt,
        lastSeenAt: v.lastSeenAt,
        isBot: v.isBot,
        country: v.country ?? null,
        region: v.region ?? null,
        city: v.city ?? null,
        asnOrg: v.asnOrg ?? null,
        referrerHost: v.referrerHost ?? null,
        referrerCategory: v.referrerCategory ?? null,
        landingPath: v.landingPath ?? null,
        refParam: v.refParam ?? null,
        utmSource: v.utmSource ?? null,
        utmMedium: v.utmMedium ?? null,
        utmCampaign: v.utmCampaign ?? null,
        deviceType: v.deviceType ?? null,
        osName: v.osName ?? null,
        browserName: v.browserName ?? null,
        pageViewCount: v.pageViewCount,
        eventCount: v.eventCount,
        askTurnCount: v.askTurnCount,
        contactId: v.contactId ?? null,
        contactName: v.contactName ?? null,
        contactEmail: v.contactEmail ?? null,
        trail: v.trail.map(t => ({
          type: t.type,
          name: t.name,
          path: t.path,
          detail: t.detail ?? null,
          createdAt: t.createdAt,
        })),
      })),
      askTurnsFeed: res.askTurnsFeed.map(a => ({
        attemptId: a.attemptId,
        guestSessionId: a.guestSessionId,
        analyticsSessionId: a.analyticsSessionId ?? null,
        mode: a.mode === 'jd_match' ? 'jd_match' : 'qa',
        status: a.status,
        promptExcerpt: a.promptExcerpt ?? null,
        tokensUsed: a.tokensUsed,
        country: a.country ?? null,
        region: a.region ?? null,
        city: a.city ?? null,
        asnOrg: a.asnOrg ?? null,
        contactId: a.contactId ?? null,
        contactName: a.contactName ?? null,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.analytics.breakdowns', ctx);
  }
}

export async function ingestAdminAnalyticsViaGrpc(
  sessionId: string,
  batch: AnalyticsBatch,
  userAgent: string,
  ctx: AdminGrpcCallContext = {},
): Promise<{ readonly accepted: number; readonly sessionId: string; readonly ipHash: string }> {
  const { client, meta } = createAnalyticsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminAnalyticsService/IngestAdminAnalytics',
      meta,
      opts =>
        client.ingestAdminAnalytics(
          create(IngestAdminAnalyticsRequestSchema, {
            sessionId: batch.sessionId,
            adminSessionId: sessionId,
            ...(batch.referrer ? { referrer: batch.referrer } : {}),
            ...(batch.landingPath ? { landingPath: batch.landingPath } : {}),
            ...(batch.refParam ? { refParam: batch.refParam } : {}),
            ...(batch.utmSource ? { utmSource: batch.utmSource } : {}),
            ...(batch.utmMedium ? { utmMedium: batch.utmMedium } : {}),
            ...(batch.utmCampaign ? { utmCampaign: batch.utmCampaign } : {}),
            ...(batch.utmContent ? { utmContent: batch.utmContent } : {}),
            events: batch.events.map(ev =>
              create(AnalyticsEventSchema, {
                type: ev.type,
                name: ev.name,
                path: ev.path,
                ...(ev.value !== undefined ? { value: ev.value } : {}),
                metadata: encodeAnalyticsMetadataMap(ev.metadata),
                timestamp: ev.timestamp,
              }),
            ),
            clientContext: create(ClientRequestContextSchema, { userAgent }),
          }),
          opts,
        ),
    );
    return { accepted: res.accepted, sessionId: res.sessionId, ipHash: res.ipHash };
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.analytics.ingest', ctx);
  }
}
