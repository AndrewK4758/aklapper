import {
  AgensiCatalogMetaSchema,
  AgensiSkillSchema,
  AgensiSyncStateSchema,
  CadencePresetSchema,
  CareerDossierSchema,
  FormDefinitionSchema,
  PortalAboutContentSchema,
  PortalAgensiContentSchema,
  PortalAskContentSchema,
  PortalCadenceContentSchema,
  PortalChromeContentSchema,
  PortalContactContentSchema,
  PortalHomeContentSchema,
  StatusBadgeSpecSchema,
  TerminalProfileDataSchema,
  type AgensiCatalogMeta,
  type AgensiSkill,
  type AgensiSyncState,
  type CadencePreset,
  type CareerDossier,
  type ContactSubmissionSummary,
  type FormDefinition,
  type PortalAboutContent,
  type PortalAgensiContent,
  type PortalAskContent,
  type PortalCadenceContent,
  type PortalChromeContent,
  type PortalContactContent,
  type PortalHomeContent,
  type StatusBadgeSpec,
  type TerminalProfileData,
} from '@aklapper/core';
import type { z } from 'zod';

import type { SsrStructuredLogger } from '../request-context.ts';
import { GrpcPayloadContractError } from './errors.ts';
import type {
  AgensiCatalogMeta as ProtoAgensiCatalogMeta,
  AgensiSkill as ProtoAgensiSkill,
  AgensiSyncState as ProtoAgensiSyncState,
  StatusBadgeSpec as ProtoStatusBadgeSpec,
} from './gen/portal/v1/agensi_pb.ts';
import type { ContactSubmissionSummary as ProtoContactSubmissionSummary } from './gen/portal/v1/contact_pb.ts';
import type {
  CadencePreset as ProtoCadencePreset,
  CareerDossier as ProtoCareerDossier,
  TerminalProfileData as ProtoTerminalProfileData,
} from './gen/portal/v1/content_pb.ts';

export function logPortalPayloadViolation(
  logger: SsrStructuredLogger | undefined,
  schema: string,
  detail?: string,
): void {
  const entry = {
    seam_type: 'BOUNDARY_FAULT',
    event: 'bff.grpc.payload_contract_violation',
    service: 'portal-api',
    schema,
    ...(detail ? { detail } : {}),
  };
  if (logger) {
    logger.error(entry, 'Portal gRPC response violated core payload schema contract');
  } else {
    console.error(JSON.stringify(entry));
  }
}

export function parsePortalJsonContent<T>(
  rawJson: string,
  schema: z.ZodType<T>,
  schemaName: string,
  logger?: SsrStructuredLogger,
): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawJson);
  } catch {
    logPortalPayloadViolation(logger, schemaName, 'invalid_json');
    throw new GrpcPayloadContractError(schemaName, `${schemaName} contained invalid JSON`);
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    logPortalPayloadViolation(logger, schemaName, parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError(schemaName, `${schemaName} failed Zod schema validation`);
  }
  return parsed.data;
}

export function parsePortalChromeJson(
  raw: string,
  logger?: SsrStructuredLogger,
): PortalChromeContent {
  return parsePortalJsonContent(raw, PortalChromeContentSchema, 'PortalChromeContent', logger);
}

export function parsePortalHomeJson(raw: string, logger?: SsrStructuredLogger): PortalHomeContent {
  return parsePortalJsonContent(raw, PortalHomeContentSchema, 'PortalHomeContent', logger);
}

export function parsePortalAboutJson(
  raw: string,
  logger?: SsrStructuredLogger,
): PortalAboutContent {
  return parsePortalJsonContent(raw, PortalAboutContentSchema, 'PortalAboutContent', logger);
}

export function parsePortalAgensiJson(
  raw: string,
  logger?: SsrStructuredLogger,
): PortalAgensiContent {
  return parsePortalJsonContent(raw, PortalAgensiContentSchema, 'PortalAgensiContent', logger);
}

export function parsePortalAskJson(raw: string, logger?: SsrStructuredLogger): PortalAskContent {
  return parsePortalJsonContent(raw, PortalAskContentSchema, 'PortalAskContent', logger);
}

export function parsePortalCadenceJson(
  raw: string,
  logger?: SsrStructuredLogger,
): PortalCadenceContent {
  return parsePortalJsonContent(raw, PortalCadenceContentSchema, 'PortalCadenceContent', logger);
}

export function parsePortalContactJson(
  raw: string,
  logger?: SsrStructuredLogger,
): PortalContactContent {
  return parsePortalJsonContent(raw, PortalContactContentSchema, 'PortalContactContent', logger);
}

export function parseContactFormJson(raw: string, logger?: SsrStructuredLogger): FormDefinition {
  return parsePortalJsonContent(raw, FormDefinitionSchema, 'FormDefinition', logger);
}

export function mapProtoTerminalProfileToDomain(
  proto: ProtoTerminalProfileData | undefined,
  logger?: SsrStructuredLogger,
): TerminalProfileData {
  if (!proto) {
    logPortalPayloadViolation(logger, 'TerminalProfileData', 'missing_terminal');
    throw new GrpcPayloadContractError('TerminalProfileData', 'Missing terminal profile payload');
  }
  const parsed = TerminalProfileDataSchema.safeParse({
    slug: proto.slug,
    bannerTitle: proto.bannerTitle,
    bannerMeta: proto.bannerMeta,
    osLabel: proto.osLabel,
    directory: proto.directory,
    vcsBranch: proto.vcsBranch,
    vcsState: proto.vcsState,
    contextLabel: proto.contextLabel,
    placeholder: proto.placeholder,
    quickCommands: [...proto.quickCommands],
    initialEntries: proto.initialEntries.map(e => ({
      command: e.command,
      output: e.output,
      status: e.status,
      durationLabel: e.durationLabel,
      timestamp: e.timestamp,
      sortOrder: e.sortOrder,
    })),
    commands: proto.commands.map(c => ({
      name: c.name,
      description: c.description,
      kind: c.kind,
      output: c.output,
      targetRoute: c.targetRoute ?? null,
      allowedRoutes: [...c.allowedRoutes],
      errorTemplate: c.errorTemplate ?? null,
      sortOrder: c.sortOrder,
    })),
  });
  if (!parsed.success) {
    logPortalPayloadViolation(logger, 'TerminalProfileData', parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError('TerminalProfileData');
  }
  return parsed.data;
}

export function mapProtoCareerDossierToDomain(
  proto: ProtoCareerDossier,
  logger?: SsrStructuredLogger,
): CareerDossier {
  const parsed = CareerDossierSchema.safeParse({
    slug: proto.slug,
    kind: proto.kind,
    title: proto.title,
    domainLabel: proto.domainLabel,
    roleTitle: proto.roleTitle,
    timeframe: proto.timeframe,
    skills: [...proto.skills],
    summaryBody: proto.summaryBody,
    sections: proto.sections.map(s => ({ heading: s.heading, body: s.body })),
    publishStatus: proto.publishStatus,
    sanitizationVerifiedAt: proto.sanitizationVerifiedAt ?? null,
    denylistHash: proto.denylistHash ?? null,
    sortOrder: proto.sortOrder,
    updatedAt: proto.updatedAt,
  });
  if (!parsed.success) {
    logPortalPayloadViolation(logger, 'CareerDossier', parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError('CareerDossier');
  }
  return parsed.data;
}

export function mapProtoCadencePresetToDomain(
  proto: ProtoCadencePreset,
  logger?: SsrStructuredLogger,
): CadencePreset {
  const parsed = CadencePresetSchema.safeParse({
    slug: proto.slug,
    title: proto.title,
    starterPrompt: proto.starterPrompt,
    expectedKind: proto.expectedKind,
    starterArtifactHtml: proto.starterArtifactHtml,
    sortOrder: proto.sortOrder,
  });
  if (!parsed.success) {
    logPortalPayloadViolation(logger, 'CadencePreset', parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError('CadencePreset');
  }
  return parsed.data;
}

export function mapProtoAgensiSkillToDomain(
  proto: ProtoAgensiSkill,
  logger?: SsrStructuredLogger,
): AgensiSkill {
  const parsed = AgensiSkillSchema.safeParse({
    slug: proto.slug,
    name: proto.name,
    summary: proto.summary,
    tags: [...proto.tags],
    url: proto.url,
    sortOrder: proto.sortOrder,
    creatorHandle: proto.creatorHandle ?? null,
    isPublished: proto.isPublished,
    syncedAt: proto.syncedAt ?? null,
    source: proto.source,
  });
  if (!parsed.success) {
    logPortalPayloadViolation(logger, 'AgensiSkill', parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError('AgensiSkill');
  }
  return parsed.data;
}

export function mapProtoAgensiCatalogMetaToDomain(
  proto: ProtoAgensiCatalogMeta | undefined,
  logger?: SsrStructuredLogger,
): AgensiCatalogMeta {
  if (!proto) {
    logPortalPayloadViolation(logger, 'AgensiCatalogMeta', 'missing_catalog_meta');
    throw new GrpcPayloadContractError('AgensiCatalogMeta');
  }
  const parsed = AgensiCatalogMetaSchema.safeParse({
    mode: proto.mode,
    creatorHandle: proto.creatorHandle,
    syncedAt: proto.syncedAt ?? null,
  });
  if (!parsed.success) {
    logPortalPayloadViolation(logger, 'AgensiCatalogMeta', parsed.error.issues[0]?.message);
    throw new GrpcPayloadContractError('AgensiCatalogMeta');
  }
  return parsed.data;
}

export function mapProtoStatusBadgeToDomain(
  proto: ProtoStatusBadgeSpec | undefined,
): StatusBadgeSpec | undefined {
  if (!proto) return undefined;
  const parsed = StatusBadgeSpecSchema.safeParse({
    source: proto.source,
    state: proto.state,
    label: proto.label,
  });
  return parsed.success ? parsed.data : undefined;
}

export function mapProtoAgensiSyncStateToDomain(
  proto: ProtoAgensiSyncState | undefined,
): AgensiSyncState | null {
  if (!proto) return null;
  const parsed = AgensiSyncStateSchema.safeParse({
    creatorHandle: proto.creatorHandle,
    lastSyncedAt: proto.lastSyncedAt ?? null,
    lastAttemptAt: proto.lastAttemptAt ?? null,
    lastStatus: proto.lastStatus,
    lastError: proto.lastError ?? null,
    itemCount: proto.itemCount,
  });
  return parsed.success ? parsed.data : null;
}

export function mapProtoContactSummaryToDomain(
  proto: ProtoContactSubmissionSummary | undefined,
  logger?: SsrStructuredLogger,
): ContactSubmissionSummary {
  if (
    !proto ||
    !proto.id.trim() ||
    !proto.name.trim() ||
    !proto.email.trim() ||
    !proto.createdAt.trim()
  ) {
    logPortalPayloadViolation(logger, 'ContactSubmissionSummary', 'missing_required_fields');
    throw new GrpcPayloadContractError('ContactSubmissionSummary');
  }
  return {
    id: proto.id,
    name: proto.name,
    email: proto.email,
    phone: proto.phone ?? null,
    attachmentName: proto.attachmentName ?? null,
    attachmentSizeBytes: proto.attachmentSizeBytes ?? null,
    attachmentSha256: proto.attachmentSha256 ?? null,
    createdAt: proto.createdAt,
  };
}
