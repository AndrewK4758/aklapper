import { type AppErrorCode, validateSiteContentMetadata } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  deleteAgensiSkill,
  deleteCadencePreset,
  deleteMenuItem,
  deleteRoadmapMilestone,
  deleteTerminalCommand,
  deleteTerminalDirectoryEntry,
  deleteTerminalInitialEntry,
  getSharedDb,
  setMaintenanceModeDefault,
  upsertAgensiSkill,
  upsertCadencePreset,
  upsertMenuItem,
  upsertRoadmapMilestone,
  upsertSiteContent,
  upsertTerminalCommand,
  upsertTerminalDirectoryEntry,
  upsertTerminalInitialEntry,
  upsertTerminalProfile,
} from '@aklapper/db';
import { logDiagnosticError, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import type { AdminCmsActionData } from '#pages/cms';

import { triggerQdrantReindex } from './admin-ops.server';

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

export async function dispatchAdminCmsIntent(
  intent: string,
  formData: FormData,
  correlationId: string,
  logger: SsrStructuredLogger,
): Promise<CmsActionOutcome> {
  if (intent === 'reindex-qdrant') {
    const result = await triggerQdrantReindex();
    if (result.ok) {
      return ok(result.message);
    }
    const upstreamError = Object.assign(new Error(result.message), {
      status: 503,
      statusText: 'Service Unavailable',
      data: null,
    });
    const { publicError, diagnostic } = classifyServerError(upstreamError, {
      correlationId,
      source: 'admin.cms.action.reindex_qdrant',
    });
    logDiagnosticError(logger, diagnostic);
    return fail(
      publicError.status,
      publicError.message,
      publicError.code,
      publicError.action,
      publicError.correlationId,
    );
  }

  if (intent === 'set-maintenance') {
    const enabled = formData.get('maintenanceModeDefault') === 'true';
    const rawProgress = formData.get('rebuildProgressPercent');
    const progress =
      rawProgress !== null && String(rawProgress).trim() !== '' ? Number(rawProgress) : undefined;
    const result = await setMaintenanceModeDefault(getSharedDb(), enabled, progress);
    return ok(
      `Maintenance mode is now ${result.maintenanceModeDefault ? 'ON' : 'OFF'} (rebuild progress ${result.rebuildProgressPercent}%).`,
    );
  }

  if (intent === 'upsert-site-content') {
    const key = String(formData.get('key') ?? '').trim();
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
    const targetDeploy = String(formData.get('targetK8sDeploy') ?? '').trim();
    const namespace = String(formData.get('namespace') ?? '').trim();
    const saved = await upsertMenuItem(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
      keyShortcut: String(formData.get('keyShortcut') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      targetK8sDeploy: targetDeploy || null,
      namespace: namespace || null,
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
    const saved = await upsertTerminalProfile(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
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
    const rawId = formData.get('id');
    const targetRoute = String(formData.get('targetRoute') ?? '').trim();
    const errorTemplate = String(formData.get('errorTemplate') ?? '').trim();
    const saved = await upsertTerminalCommand(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug: String(formData.get('profileSlug') ?? ''),
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
    const rawId = formData.get('id');
    const saved = await upsertTerminalInitialEntry(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug: String(formData.get('profileSlug') ?? ''),
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
    const rawId = formData.get('id');
    const saved = await upsertTerminalDirectoryEntry(getSharedDb(), {
      ...(rawId ? { id: Number(rawId) } : {}),
      profileSlug: String(formData.get('profileSlug') ?? ''),
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

  if (intent === 'upsert-roadmap-milestone') {
    const saved = await upsertRoadmapMilestone(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
      status: String(formData.get('status') ?? 'active') as 'done' | 'active' | 'queued',
      label: String(formData.get('label') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
      enabled: formData.get('enabled') === 'true',
    });
    return ok(`Saved roadmap milestone "${saved.slug}".`);
  }

  if (intent === 'delete-roadmap-milestone') {
    const slug = String(formData.get('slug') ?? '').trim();
    const deleted = await deleteRoadmapMilestone(getSharedDb(), slug);
    return deleted
      ? ok(`Deleted roadmap milestone "${slug}".`)
      : notFound(`Milestone "${slug}" not found.`, correlationId);
  }

  if (intent === 'upsert-agensi-skill') {
    const saved = await upsertAgensiSkill(getSharedDb(), {
      slug: String(formData.get('slug') ?? ''),
      name: String(formData.get('name') ?? ''),
      summary: String(formData.get('summary') ?? ''),
      tags: splitTags(formData.get('tags')),
      url: String(formData.get('url') ?? ''),
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    });
    return ok(`Saved Agensi skill "${saved.name}".`);
  }

  if (intent === 'delete-agensi-skill') {
    const slug = String(formData.get('slug') ?? '').trim();
    const deleted = await deleteAgensiSkill(getSharedDb(), slug);
    return deleted
      ? ok(`Deleted Agensi skill "${slug}".`)
      : notFound(`Agensi skill "${slug}" not found.`, correlationId);
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
