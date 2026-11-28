import {
  AdminTerminalCommandRowSchema,
  AdminTerminalDirectoryEntryRowSchema,
  AdminTerminalInitialEntryRowSchema,
  AdminTerminalProfileRowSchema,
  MenuItemSchema,
  SiteContentRowSchema,
  type AdminTerminalCommandRow,
  type AdminTerminalDirectoryEntryRow,
  type AdminTerminalInitialEntryRow,
  type AdminTerminalProfileRow,
  type CareerDossierUpsertInput,
  type MenuItem,
  type SiteContentRow,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';

import { parseAdminJsonObject } from './admin-common.ts';
import {
  CareerDossierUpsertInputSchema,
  type AdminTerminalCommandRow as ProtoTerminalCommandRow,
  type AdminTerminalDirectoryEntryRow as ProtoTerminalDirectoryEntryRow,
  type AdminTerminalInitialEntryRow as ProtoTerminalInitialEntryRow,
  type AdminTerminalProfileRow as ProtoTerminalProfileRow,
  type CareerDossierUpsertInput as ProtoCareerDossierUpsertInput,
  type MenuItem as ProtoMenuItem,
  type SiteContentRow as ProtoSiteContentRow,
} from './gen/admin/v1/cms_pb.ts';
import { CareerDossierSectionSchema } from './gen/portal/v1/content_pb.ts';

export function mapProtoSiteContentRow(row: ProtoSiteContentRow): SiteContentRow {
  const metadataJson = parseAdminJsonObject(
    row.metadataJson || '{}',
    'SiteContentRow.metadata',
    v =>
      typeof v === 'object' && v !== null && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : {},
  );
  return SiteContentRowSchema.parse({
    key: row.key,
    markdownBody: row.markdownBody,
    metadataJson,
    updatedAt: row.updatedAt,
  });
}

export function mapProtoMenuItem(item: ProtoMenuItem): MenuItem {
  return MenuItemSchema.parse({
    slug: item.slug,
    keyShortcut: item.keyShortcut,
    title: item.title,
    description: item.description,
    adminOnly: item.adminOnly,
    sortOrder: item.sortOrder,
    enabled: item.enabled,
  });
}

export function mapProtoAdminTerminalProfile(
  row: ProtoTerminalProfileRow,
): AdminTerminalProfileRow {
  return AdminTerminalProfileRowSchema.parse({
    slug: row.slug,
    bannerTitle: row.bannerTitle,
    bannerMeta: row.bannerMeta,
    osLabel: row.osLabel,
    directory: row.directory,
    vcsBranch: row.vcsBranch,
    vcsState: row.vcsState,
    contextLabel: row.contextLabel,
    placeholder: row.placeholder,
    quickCommands: [...row.quickCommands],
  });
}

export function mapProtoAdminTerminalCommand(
  row: ProtoTerminalCommandRow,
): AdminTerminalCommandRow {
  return AdminTerminalCommandRowSchema.parse({
    id: row.id,
    profileSlug: row.profileSlug,
    name: row.name,
    description: row.description,
    kind: row.kind,
    output: row.output,
    targetRoute: row.targetRoute ?? null,
    allowedRoutes: [...row.allowedRoutes],
    errorTemplate: row.errorTemplate ?? null,
    sortOrder: row.sortOrder,
  });
}

export function mapProtoAdminTerminalInitialEntry(
  row: ProtoTerminalInitialEntryRow,
): AdminTerminalInitialEntryRow {
  return AdminTerminalInitialEntryRowSchema.parse({
    id: row.id,
    profileSlug: row.profileSlug,
    command: row.command,
    output: row.output,
    status: row.status,
    durationLabel: row.durationLabel,
    timestampLabel: row.timestampLabel,
    sortOrder: row.sortOrder,
  });
}

export function mapProtoAdminTerminalDirectoryEntry(
  row: ProtoTerminalDirectoryEntryRow,
): AdminTerminalDirectoryEntryRow {
  return AdminTerminalDirectoryEntryRowSchema.parse({
    id: row.id,
    profileSlug: row.profileSlug,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
  });
}

export function toProtoCareerDossierInput(
  input: CareerDossierUpsertInput,
): ProtoCareerDossierUpsertInput {
  return create(CareerDossierUpsertInputSchema, {
    slug: input.slug,
    kind: input.kind,
    title: input.title,
    domainLabel: input.domainLabel,
    roleTitle: input.roleTitle,
    timeframe: input.timeframe,
    skills: [...input.skills],
    summaryBody: input.summaryBody,
    sections: input.sections.map(sec =>
      create(CareerDossierSectionSchema, { heading: sec.heading, body: sec.body }),
    ),
    sortOrder: input.sortOrder,
  });
}
