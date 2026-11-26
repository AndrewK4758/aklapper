import { type AppErrorCode, SITE_CONTENT_KEYS, validateSiteContentMetadata } from '@aklapper/core';
import {
  deleteCadencePreset,
  deleteMenuItem,
  deleteTerminalCommand,
  deleteTerminalDirectoryEntry,
  deleteTerminalInitialEntry,
  getSharedDb,
  syncAgensiCatalog,
  upsertCadencePreset,
  upsertMenuItem,
  upsertSiteContent,
  upsertTerminalCommand,
  upsertTerminalDirectoryEntry,
  upsertTerminalInitialEntry,
  upsertTerminalProfile,
} from '@aklapper/db';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import type { AdminCmsActionData } from '#pages/cms';

import { handleCareerDossierIntent, isCareerDossierIntent } from './career-dossier-actions.server';
import {
  handleReindexQdrantIntent,
  validatePortalAskPrivacyOutcome,
} from './cms-reindex-privacy.server';

export interface CmsActionOutcome {
  readonly status: number;
  readonly payload: AdminCmsActionData;
}

function splitTags(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

function ok(message: string): CmsActionOutcome {
  return { status: 200, payload: { ok: true, message } };
}

function fail(
  status: number,
  message: string,
  code: AppErrorCode,
  action: string,
  correlationId: string,
): CmsActionOutcome {
  return { status, payload: { ok: false, message, code, action, correlationId } };
}

function notFound(message: string, correlationId: string): CmsActionOutcome {
  return fail(
    404,
    message,
    'ERR_NOT_FOUND',
    'Refresh the CMS view and verify the target identifier.',
    correlationId,
  );
}

const RETIRED_MAINTENANCE_KEY = 'portal-maintenance';

function isRetiredMaintenanceTarget(value: string): boolean {
  return value.trim().toLowerCase() === RETIRED_MAINTENANCE_KEY;
}

function blockRetiredMaintenanceMutation(
  intent: string,
  correlationId: string,
  logger: SsrStructuredLogger,
  target?: string,
): CmsActionOutcome {
  logger.warn(
    {
      seam_type: 'UNSOUND_CONDITION',
      event: 'admin.cms.retired_maintenance_intent_blocked',
      intent,
      ...(target ? { target } : {}),
      correlationId,
    },
    'Blocked retired maintenance or roadmap CMS mutation.',
  );
  return fail(
    410,
    'Maintenance mode and roadmap milestone controls have been retired.',
    'ERR_VALIDATION',
    'Reload the CMS view to use active content controls.',
    correlationId,
  );
}

export async function dispatchAdminCmsIntent(
  intent: string,
  formData: FormData,
  correlationId: string,
  logger: SsrStructuredLogger,
  adminActor = 'admin',
): Promise<CmsActionOutcome> {
  if (isCareerDossierIntent(intent)) {
    return handleCareerDossierIntent(intent, formData, { correlationId, logger, adminActor });
  }

  if (intent === 'reindex-qdrant') {
    return handleReindexQdrantIntent(correlationId, logger);
  }

  if (
    intent === 'set-maintenance' ||
    intent === 'upsert-roadmap-milestone' ||
    intent === 'delete-roadmap-milestone'
  ) {
    return blockRetiredMaintenanceMutation(intent, correlationId, logger);
  }

  if (intent === 'upsert-site-content') {
    const key = String(formData.get('key') ?? '').trim();
    if (isRetiredMaintenanceTarget(key)) {
      return blockRetiredMaintenanceMutation(intent, correlationId, logger, key);
    }
    const markdownBody = String(formData.get('markdownBody') ?? '');
    const rawJson = String(formData.get('metadataJson') ?? '{}');
    let parsedMetadata: Record<string, unknown>;
    try {
      const candidate: unknown = JSON.parse(rawJson);
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        logger.warn(
          {
            event: 'admin.cms.site_content_invalid_payload',
            key,
            correlationId,
            reason: 'non_object_json',
          },
          'Rejected non-object site_content metadata payload.',
        );
        return fail(
          400,
          'Metadata JSON must be a JSON object.',
          'ERR_VALIDATION',
          'Provide a valid JSON object and submit again.',
          correlationId,
        );
      }
      parsedMetadata = candidate as Record<string, unknown>;
    } catch {
      logger.warn(
        {
          event: 'admin.cms.site_content_invalid_payload',
          key,
          correlationId,
          reason: 'malformed_json',
        },
        'Rejected malformed site_content metadata JSON.',
      );
      return fail(
        400,
        'Invalid JSON in metadataJson.',
        'ERR_VALIDATION',
        'Fix JSON syntax errors and submit again.',
        correlationId,
      );
    }

    const validation = validateSiteContentMetadata(key, parsedMetadata);
    if (!validation.ok) {
      const firstIssue = validation.issues[0];
      logger.warn(
        {
          event: 'admin.cms.site_content_invalid_payload',
          key,
          correlationId,
          reason: 'schema_validation_failed',
          issueCount: validation.issues.length,
        },
        'Rejected schema-invalid site_content metadata payload.',
      );
      return fail(
        400,
        firstIssue
          ? `Invalid metadata for "${key}" (${firstIssue.pathKey || 'root'}): ${firstIssue.message}`
          : `Invalid metadata payload for "${key}".`,
        'ERR_VALIDATION',
        'Correct the highlighted schema fields and submit again.',
        correlationId,
      );
    }

    if (key === SITE_CONTENT_KEYS.portalAsk) {
      const privacyFailure = validatePortalAskPrivacyOutcome(
        markdownBody,
        validation.data,
        correlationId,
      );
      if (privacyFailure) return privacyFailure;
    }

    const saved = await upsertSiteContent(getSharedDb(), key, markdownBody, validation.data);
    logger.info(
      {
        event: 'admin.cms.site_content_upsert_committed',
        key: saved.key,
        updatedAt: saved.updatedAt,
        correlationId,
      },
      'Committed site_content update.',
    );
    return ok(`Saved site_content key "${saved.key}".`);
  }

  if (intent === 'upsert-menu-item') {
    const saved = await upsertMenuItem(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
      keyShortcut: String(formData.get('keyShortcut') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
      enabled: formData.get('enabled') === 'true',
      adminOnly: formData.get('adminOnly') === 'true',
    });
    return ok(`Saved menu item "${saved.slug}".`);
  }

  if (intent === 'delete-menu-item') {
    const slug = String(formData.get('slug') ?? '').trim();
    const deleted = await deleteMenuItem(getSharedDb(), slug);
    return deleted
      ? ok(`Deleted menu item "${slug}".`)
      : notFound(`Menu item "${slug}" not found.`, correlationId);
  }

  if (intent === 'upsert-terminal-profile') {
    const slug = String(formData.get('slug') ?? '').trim();
    if (isRetiredMaintenanceTarget(slug)) {
      return blockRetiredMaintenanceMutation(intent, correlationId, logger, slug);
    }
    const saved = await upsertTerminalProfile(getSharedDb(), {
      slug,
      bannerTitle: String(formData.get('bannerTitle') ?? ''),
      bannerMeta: String(formData.get('bannerMeta') ?? ''),
      osLabel: String(formData.get('osLabel') ?? 'linux'),
      directory: String(formData.get('directory') ?? '~'),
      vcsBranch: String(formData.get('vcsBranch') ?? 'main'),
      vcsState: String(formData.get('vcsState') ?? 'clean') as 'clean' | 'modified' | 'untracked',
      contextLabel: String(formData.get('contextLabel') ?? ''),
      placeholder: String(formData.get('placeholder') ?? ''),
      quickCommands: splitTags(formData.get('quickCommands')),
    });
    return ok(`Saved terminal profile "${saved.slug}".`);
  }

  if (intent === 'upsert-terminal-command') {
    const profileSlug = String(formData.get('profileSlug') ?? '').trim();
    if (isRetiredMaintenanceTarget(profileSlug)) {
      return blockRetiredMaintenanceMutation(intent, correlationId, logger, profileSlug);
    }
    const rawId = formData.get('id');
    const targetRoute = String(formData.get('targetRoute') ?? '').trim();
    const errorTemplate = String(formData.get('errorTemplate') ?? '').trim();
    const saved = await upsertTerminalCommand(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      kind: String(formData.get('kind') ?? 'static') as
        | 'static'
        | 'navigate'
        | 'cd'
        | 'tui'
        | 'roadmap'
        | 'uptime'
        | 'clear',
      output: String(formData.get('output') ?? ''),
      targetRoute: targetRoute || null,
      allowedRoutes: splitTags(formData.get('allowedRoutes')),
      errorTemplate: errorTemplate || null,
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    });
    return ok(`Saved terminal command "${saved.name}".`);
  }

  if (intent === 'delete-terminal-command') {
    const id = Number(formData.get('id') ?? 0);
    const deleted = await deleteTerminalCommand(getSharedDb(), id);
    return deleted
      ? ok(`Deleted terminal command #${id}.`)
      : notFound(`Terminal command #${id} not found.`, correlationId);
  }

  if (intent === 'upsert-terminal-entry') {
    const profileSlug = String(formData.get('profileSlug') ?? '').trim();
    if (isRetiredMaintenanceTarget(profileSlug)) {
      return blockRetiredMaintenanceMutation(intent, correlationId, logger, profileSlug);
    }
    const rawId = formData.get('id');
    const saved = await upsertTerminalInitialEntry(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug,
      command: String(formData.get('command') ?? ''),
      output: String(formData.get('output') ?? ''),
      status: String(formData.get('status') ?? 'ok') as 'ok' | 'error',
      durationLabel: String(formData.get('durationLabel') ?? '12ms'),
      timestampLabel: String(formData.get('timestampLabel') ?? '00:00:00'),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    });
    return ok(`Saved initial terminal entry "${saved.command}".`);
  }

  if (intent === 'delete-terminal-entry') {
    const id = Number(formData.get('id') ?? 0);
    const deleted = await deleteTerminalInitialEntry(getSharedDb(), id);
    return deleted
      ? ok(`Deleted terminal entry #${id}.`)
      : notFound(`Terminal entry #${id} not found.`, correlationId);
  }

  if (intent === 'upsert-terminal-directory-entry') {
    const profileSlug = String(formData.get('profileSlug') ?? '').trim();
    if (isRetiredMaintenanceTarget(profileSlug)) {
      return blockRetiredMaintenanceMutation(intent, correlationId, logger, profileSlug);
    }
    const rawId = formData.get('id');
    const saved = await upsertTerminalDirectoryEntry(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug,
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
      enabled: formData.get('enabled') !== 'false',
    });
    return ok(`Saved terminal directory entry "${saved.name}".`);
  }

  if (intent === 'delete-terminal-directory-entry') {
    const id = Number(formData.get('id') ?? 0);
    const deleted = await deleteTerminalDirectoryEntry(getSharedDb(), id);
    return deleted
      ? ok(`Deleted terminal directory entry #${id}.`)
      : notFound(`Terminal directory entry #${id} not found.`, correlationId);
  }

  if (intent === 'sync-agensi-catalog') {
    const result = await syncAgensiCatalog(getSharedDb(), {
      forceRefresh: true,
      correlationId,
    });
    return ok(
      `Synced ${result.skills.length} Agensi skill(s) for ${result.creatorHandle} (status: ${result.syncState.lastStatus}).`,
    );
  }

  if (intent === 'upsert-agensi-skill' || intent === 'delete-agensi-skill') {
    logger.warn(
      {
        seam_type: 'UNSOUND_CONDITION',
        event: 'agensi.cms.legacy_manual_mutation_blocked',
        intent,
        correlationId,
      },
      'Blocked retired manual Agensi skill CMS mutation.',
    );
    return fail(
      410,
      'Manual Agensi skill editing has been retired; use Sync Agensi Catalog instead.',
      'ERR_VALIDATION',
      'Use Sync Agensi Catalog to refresh creator-scoped skills from agensi.io.',
      correlationId,
    );
  }

  if (intent === 'upsert-cadence-preset') {
    const saved = await upsertCadencePreset(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
      title: String(formData.get('title') ?? ''),
      starterPrompt: String(formData.get('starterPrompt') ?? ''),
      expectedKind: String(formData.get('expectedKind') ?? 'html'),
      starterArtifactHtml: String(formData.get('starterArtifactHtml') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    });
    return ok(`Saved CADENCE preset "${saved.title}".`);
  }

  if (intent === 'delete-cadence-preset') {
    const slug = String(formData.get('slug') ?? '').trim();
    const deleted = await deleteCadencePreset(getSharedDb(), slug);
    return deleted
      ? ok(`Deleted CADENCE preset "${slug}".`)
      : notFound(`CADENCE preset "${slug}" not found.`, correlationId);
  }

  return fail(
    400,
    'Unsupported CMS action.',
    'ERR_VALIDATION',
    'Select a valid CMS control and retry.',
    correlationId,
  );
}
