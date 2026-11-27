import type {
  AgensiSyncState,
  AnalyticsBatch,
  CadencePreset,
  ContactSubmissionSummary,
  PortalAboutLoaderData,
  PortalAgensiLoaderData,
  PortalAskLoaderData,
  PortalCadenceContent,
  PortalContactLoaderData,
  PortalHomeLoaderData,
  PortalRootLoaderData,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import { GrpcPayloadContractError, mapProtoQuotaToDomain } from './errors.ts';
import { AgensiService } from './gen/portal/v1/agensi_pb.ts';
import {
  AnalyticsMetadataValueSchema,
  AnalyticsService,
  ClientRequestContextSchema,
  type AnalyticsMetadataValue,
  type ClientRequestContext,
} from './gen/portal/v1/analytics_pb.ts';
import { ContactAttachmentUploadSchema, ContactService } from './gen/portal/v1/contact_pb.ts';
import { PortalContentService } from './gen/portal/v1/content_pb.ts';
import {
  logPortalPayloadViolation,
  mapProtoAgensiCatalogMetaToDomain,
  mapProtoAgensiSkillToDomain,
  mapProtoAgensiSyncStateToDomain,
  mapProtoCadencePresetToDomain,
  mapProtoCareerDossierToDomain,
  mapProtoContactSummaryToDomain,
  mapProtoStatusBadgeToDomain,
  mapProtoTerminalProfileToDomain,
  parseContactFormJson,
  parsePortalAboutJson,
  parsePortalAgensiJson,
  parsePortalAskJson,
  parsePortalCadenceJson,
  parsePortalChromeJson,
  parsePortalContactJson,
  parsePortalHomeJson,
} from './portal-mappers.ts';
import {
  getOrCreateGoGrpcTransport,
  invokeUnaryWithAuth,
  type GrpcCallMetadata,
} from './transport.ts';

const CONTACT_WRITE_MAX_BYTES = 8 * 1024 * 1024;

export interface PortalClientRequestContextInput {
  readonly userAgent?: string;
  readonly referer?: string;
  readonly host?: string;
  readonly requestUrl?: string;
  readonly cloudCountry?: string;
  readonly cloudRegion?: string;
  readonly guestSessionId?: string;
}

export interface PortalCadenceContentResult {
  readonly content: PortalCadenceContent;
  readonly presets: readonly CadencePreset[];
}

export interface PortalAgensiCatalogResult extends PortalAgensiLoaderData {
  readonly syncState: AgensiSyncState | null;
}

export interface IngestPortalAnalyticsResult {
  readonly accepted: number;
  readonly sessionId: string;
  readonly ipHash: string;
}

export interface SubmitPortalContactInput {
  readonly name: string;
  readonly phone?: string | null;
  readonly email: string;
  readonly message: string;
  readonly attachment?: {
    readonly filename: string;
    readonly mimeType: string;
    readonly content: Uint8Array;
  } | null;
  readonly candidateAnalyticsSessionId?: string | null;
  readonly clientContext: PortalClientRequestContextInput;
}

function buildClientContextProto(input?: PortalClientRequestContextInput): ClientRequestContext {
  return create(ClientRequestContextSchema, {
    userAgent: input?.userAgent ?? '',
    referer: input?.referer ?? '',
    host: input?.host ?? '',
    requestUrl: input?.requestUrl ?? '',
    cloudCountry: input?.cloudCountry ?? '',
    cloudRegion: input?.cloudRegion ?? '',
    guestSessionId: input?.guestSessionId ?? '',
  });
}

function encodeMetadataMap(
  meta?: Readonly<Record<string, string | number | boolean>>,
): Record<string, AnalyticsMetadataValue> {
  if (!meta) return {};
  const out: Record<string, AnalyticsMetadataValue> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string') {
      out[k] = create(AnalyticsMetadataValueSchema, { kind: { case: 'stringValue', value: v } });
    } else if (typeof v === 'number') {
      out[k] = create(AnalyticsMetadataValueSchema, { kind: { case: 'numberValue', value: v } });
    } else if (typeof v === 'boolean') {
      out[k] = create(AnalyticsMetadataValueSchema, { kind: { case: 'boolValue', value: v } });
    }
  }
  return out;
}

function contentClient(meta: GrpcCallMetadata) {
  return createClient(
    PortalContentService,
    meta.transport ?? getOrCreateGoGrpcTransport(meta.baseUrl),
  );
}

function agensiClient(meta: GrpcCallMetadata) {
  return createClient(AgensiService, meta.transport ?? getOrCreateGoGrpcTransport(meta.baseUrl));
}

function analyticsClient(meta: GrpcCallMetadata) {
  return createClient(AnalyticsService, meta.transport ?? getOrCreateGoGrpcTransport(meta.baseUrl));
}

function contactClient(meta: GrpcCallMetadata) {
  return createClient(
    ContactService,
    meta.transport ??
      getOrCreateGoGrpcTransport(meta.baseUrl, { writeMaxBytes: CONTACT_WRITE_MAX_BYTES }),
  );
}

export async function getPortalRootContent(meta: GrpcCallMetadata): Promise<PortalRootLoaderData> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetRootContent',
    meta,
    opts => client.getRootContent({}, opts),
  );
  return {
    chrome: parsePortalChromeJson(res.chromeJson, meta.logger),
    homeContent: parsePortalHomeJson(res.homeContentJson, meta.logger),
    terminal: mapProtoTerminalProfileToDomain(res.terminal, meta.logger),
    contactForm: parseContactFormJson(res.contactFormJson, meta.logger),
  };
}

export async function getPortalHomeContent(meta: GrpcCallMetadata): Promise<PortalHomeLoaderData> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetHomeContent',
    meta,
    opts => client.getHomeContent({}, opts),
  );
  return {
    content: parsePortalHomeJson(res.contentJson, meta.logger),
    terminal: mapProtoTerminalProfileToDomain(res.terminal, meta.logger),
    contactForm: parseContactFormJson(res.contactFormJson, meta.logger),
  };
}

export async function getPortalAboutContent(
  meta: GrpcCallMetadata,
): Promise<PortalAboutLoaderData> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetAboutContent',
    meta,
    opts => client.getAboutContent({}, opts),
  );
  return {
    content: parsePortalAboutJson(res.contentJson, meta.logger),
    dossiers: res.dossiers.map(d => mapProtoCareerDossierToDomain(d, meta.logger)),
    ...(res.brandContactEmail ? { brandContactEmail: res.brandContactEmail } : {}),
  };
}

export async function getPortalAskContent(
  meta: GrpcCallMetadata,
  sessionId?: string,
): Promise<PortalAskLoaderData> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetAskContent',
    meta,
    opts => client.getAskContent({ sessionId: sessionId ?? '' }, opts),
  );
  const quota = mapProtoQuotaToDomain(res.quota);
  if (!quota) {
    logPortalPayloadViolation(meta.logger, 'GetAskContentResponse', 'missing_quota');
    throw new GrpcPayloadContractError('GetAskContentResponse', 'Missing quota in GetAskContent');
  }
  return {
    content: parsePortalAskJson(res.contentJson, meta.logger),
    quota,
  };
}

export async function getPortalCadenceContent(
  meta: GrpcCallMetadata,
): Promise<PortalCadenceContentResult> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetCadenceContent',
    meta,
    opts => client.getCadenceContent({}, opts),
  );
  return {
    content: parsePortalCadenceJson(res.contentJson, meta.logger),
    presets: res.presets.map(p => mapProtoCadencePresetToDomain(p, meta.logger)),
  };
}

export async function getPortalContactContent(
  meta: GrpcCallMetadata,
): Promise<PortalContactLoaderData> {
  const client = contentClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.PortalContentService/GetContactContent',
    meta,
    opts => client.getContactContent({}, opts),
  );
  return {
    content: parsePortalContactJson(res.contentJson, meta.logger),
  };
}

export async function getPortalAgensiCatalog(
  meta: GrpcCallMetadata,
  options: { readonly forceRefresh?: boolean } = {},
): Promise<PortalAgensiCatalogResult> {
  const client = agensiClient(meta);
  const res = await invokeUnaryWithAuth('/portal.v1.AgensiService/GetCatalog', meta, opts =>
    client.getCatalog({ forceRefresh: options.forceRefresh ?? false }, opts),
  );
  const baseContent = parsePortalAgensiJson(res.contentJson, meta.logger);
  const badgeOverride = mapProtoStatusBadgeToDomain(res.statusBadgeOverride);
  return {
    content: badgeOverride ? { ...baseContent, statusBadge: badgeOverride } : baseContent,
    skills: res.skills.map(s => mapProtoAgensiSkillToDomain(s, meta.logger)),
    catalogMeta: mapProtoAgensiCatalogMetaToDomain(res.catalogMeta, meta.logger),
    syncState: mapProtoAgensiSyncStateToDomain(res.syncState),
  };
}

export async function ingestPortalAnalytics(
  meta: GrpcCallMetadata,
  batch: AnalyticsBatch,
  clientContext: PortalClientRequestContextInput,
): Promise<IngestPortalAnalyticsResult> {
  const client = analyticsClient(meta);
  const res = await invokeUnaryWithAuth('/portal.v1.AnalyticsService/IngestAnalytics', meta, opts =>
    client.ingestAnalytics(
      {
        sessionId: batch.sessionId,
        ...(batch.referrer !== undefined ? { referrer: batch.referrer } : {}),
        ...(batch.landingPath !== undefined ? { landingPath: batch.landingPath } : {}),
        ...(batch.refParam !== undefined ? { refParam: batch.refParam } : {}),
        ...(batch.utmSource !== undefined ? { utmSource: batch.utmSource } : {}),
        ...(batch.utmMedium !== undefined ? { utmMedium: batch.utmMedium } : {}),
        ...(batch.utmCampaign !== undefined ? { utmCampaign: batch.utmCampaign } : {}),
        ...(batch.utmContent !== undefined ? { utmContent: batch.utmContent } : {}),
        events: batch.events.map(ev => ({
          type: ev.type,
          name: ev.name,
          path: ev.path,
          ...(ev.value !== undefined ? { value: ev.value } : {}),
          metadata: encodeMetadataMap(ev.metadata),
          timestamp: ev.timestamp,
        })),
        clientContext: buildClientContextProto(clientContext),
      },
      opts,
    ),
  );
  return {
    accepted: res.accepted,
    sessionId: res.sessionId,
    ipHash: res.ipHash,
  };
}

export async function recordPortalSsrHit(
  meta: GrpcCallMetadata,
  pathname: string,
  clientContext: PortalClientRequestContextInput,
): Promise<string> {
  const client = analyticsClient(meta);
  const res = await invokeUnaryWithAuth('/portal.v1.AnalyticsService/RecordSsrHit', meta, opts =>
    client.recordSsrHit(
      {
        pathname,
        clientContext: buildClientContextProto(clientContext),
      },
      opts,
    ),
  );
  return res.sessionId;
}

export async function bindPortalGuestSession(
  meta: GrpcCallMetadata,
  guestSessionId: string,
  landingPath: string,
  clientContext: PortalClientRequestContextInput,
): Promise<string> {
  const client = analyticsClient(meta);
  const res = await invokeUnaryWithAuth(
    '/portal.v1.AnalyticsService/BindGuestSession',
    meta,
    opts =>
      client.bindGuestSession(
        {
          guestSessionId,
          landingPath,
          clientContext: buildClientContextProto(clientContext),
        },
        opts,
      ),
  );
  return res.sessionId;
}

export async function submitPortalContact(
  meta: GrpcCallMetadata,
  input: SubmitPortalContactInput,
): Promise<ContactSubmissionSummary> {
  const client = contactClient(meta);
  const res = await invokeUnaryWithAuth('/portal.v1.ContactService/SubmitContact', meta, opts =>
    client.submitContact(
      {
        name: input.name,
        ...(input.phone ? { phone: input.phone } : {}),
        email: input.email,
        message: input.message,
        ...(input.attachment
          ? {
              attachment: create(ContactAttachmentUploadSchema, {
                filename: input.attachment.filename,
                mimeType: input.attachment.mimeType,
                content: input.attachment.content,
              }),
            }
          : {}),
        ...(input.candidateAnalyticsSessionId
          ? { candidateAnalyticsSessionId: input.candidateAnalyticsSessionId }
          : {}),
        clientContext: buildClientContextProto(input.clientContext),
      },
      opts,
    ),
  );
  return mapProtoContactSummaryToDomain(res.submission, meta.logger);
}
