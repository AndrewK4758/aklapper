import type { AdminCmsLoaderData, QdrantHealthStatus } from '@aklapper/core';
import {
  deleteAgensiSkill,
  deleteCadencePreset,
  deleteMenuItem,
  deleteRoadmapMilestone,
  deleteTerminalCommand,
  deleteTerminalInitialEntry,
  getSharedDb,
  loadAdminCmsData,
  setMaintenanceModeDefault,
  upsertAgensiSkill,
  upsertCadencePreset,
  upsertMenuItem,
  upsertRoadmapMilestone,
  upsertSiteContent,
  upsertTerminalCommand,
  upsertTerminalInitialEntry,
  upsertTerminalProfile,
} from '@aklapper/db';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
  useActionData,
  useLoaderData,
} from 'react-router';

import { type AdminCmsActionData, AdminCmsPage } from '#pages/cms';

import { fetchQdrantStatus, requireAdminSession, triggerQdrantReindex } from '../admin-ops.server';
import { buildAdminPageMeta } from '../seo';

interface CmsRouteLoaderData {
  cms: AdminCmsLoaderData;
  qdrant: QdrantHealthStatus;
}

function splitTags(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

export async function loader({ request }: LoaderFunctionArgs): Promise<CmsRouteLoaderData> {
  await requireAdminSession(request);
  const [cms, qdrant] = await Promise.all([loadAdminCmsData(getSharedDb()), fetchQdrantStatus()]);
  return { cms, qdrant };
}

export async function action({ request }: ActionFunctionArgs): Promise<AdminCmsActionData> {
  await requireAdminSession(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const db = getSharedDb();

  try {
    if (intent === 'set-maintenance') {
      const enabled = formData.get('maintenanceModeDefault') === 'true';
      const rawProgress = formData.get('rebuildProgressPercent');
      const progress =
        rawProgress !== null && String(rawProgress).trim() !== '' ? Number(rawProgress) : undefined;
      const result = await setMaintenanceModeDefault(db, enabled, progress);
      return {
        ok: true,
        message: `Maintenance mode is now ${result.maintenanceModeDefault ? 'ON' : 'OFF'} (rebuild progress ${result.rebuildProgressPercent}%).`,
      };
    }

    if (intent === 'reindex-qdrant') {
      const result = await triggerQdrantReindex();
      return { ok: result.ok, message: result.message };
    }

    if (intent === 'upsert-site-content') {
      const key = String(formData.get('key') ?? '').trim();
      const markdownBody = String(formData.get('markdownBody') ?? '');
      const rawJson = String(formData.get('metadataJson') ?? '{}');
      let parsedMetadata: Record<string, unknown>;
      try {
        const candidate: unknown = JSON.parse(rawJson);
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
          throw new Error('Metadata JSON must be a JSON object.');
        }
        parsedMetadata = candidate as Record<string, unknown>;
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Invalid JSON in metadataJson.',
        };
      }
      const saved = await upsertSiteContent(db, key, markdownBody, parsedMetadata);
      return { ok: true, message: `Saved site_content key "${saved.key}".` };
    }

    if (intent === 'upsert-menu-item') {
      const targetDeploy = String(formData.get('targetK8sDeploy') ?? '').trim();
      const namespace = String(formData.get('namespace') ?? '').trim();
      const saved = await upsertMenuItem(db, {
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
      return { ok: true, message: `Saved menu item "${saved.slug}".` };
    }

    if (intent === 'delete-menu-item') {
      const slug = String(formData.get('slug') ?? '').trim();
      const deleted = await deleteMenuItem(db, slug);
      return deleted
        ? { ok: true, message: `Deleted menu item "${slug}".` }
        : { ok: false, message: `Menu item "${slug}" not found.` };
    }

    if (intent === 'upsert-terminal-profile') {
      const saved = await upsertTerminalProfile(db, {
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
      return { ok: true, message: `Saved terminal profile "${saved.slug}".` };
    }

    if (intent === 'upsert-terminal-command') {
      const rawId = formData.get('id');
      const targetRoute = String(formData.get('targetRoute') ?? '').trim();
      const errorTemplate = String(formData.get('errorTemplate') ?? '').trim();
      const saved = await upsertTerminalCommand(db, {
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
      return { ok: true, message: `Saved terminal command "${saved.name}".` };
    }

    if (intent === 'delete-terminal-command') {
      const id = Number(formData.get('id') ?? 0);
      const deleted = await deleteTerminalCommand(db, id);
      return deleted
        ? { ok: true, message: `Deleted terminal command #${id}.` }
        : { ok: false, message: `Terminal command #${id} not found.` };
    }

    if (intent === 'upsert-terminal-entry') {
      const rawId = formData.get('id');
      const saved = await upsertTerminalInitialEntry(db, {
        ...(rawId ? { id: Number(rawId) } : {}),
        profileSlug: String(formData.get('profileSlug') ?? ''),
        command: String(formData.get('command') ?? ''),
        output: String(formData.get('output') ?? ''),
        status: String(formData.get('status') ?? 'ok') as 'ok' | 'error',
        durationLabel: String(formData.get('durationLabel') ?? '12ms'),
        timestampLabel: String(formData.get('timestampLabel') ?? '00:00:00'),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      });
      return { ok: true, message: `Saved initial terminal entry "${saved.command}".` };
    }

    if (intent === 'delete-terminal-entry') {
      const id = Number(formData.get('id') ?? 0);
      const deleted = await deleteTerminalInitialEntry(db, id);
      return deleted
        ? { ok: true, message: `Deleted terminal entry #${id}.` }
        : { ok: false, message: `Terminal entry #${id} not found.` };
    }

    if (intent === 'upsert-roadmap-milestone') {
      const saved = await upsertRoadmapMilestone(db, {
        slug: String(formData.get('slug') ?? ''),
        status: String(formData.get('status') ?? 'active') as 'done' | 'active' | 'queued',
        label: String(formData.get('label') ?? ''),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
        enabled: formData.get('enabled') === 'true',
      });
      return { ok: true, message: `Saved roadmap milestone "${saved.slug}".` };
    }

    if (intent === 'delete-roadmap-milestone') {
      const slug = String(formData.get('slug') ?? '').trim();
      const deleted = await deleteRoadmapMilestone(db, slug);
      return deleted
        ? { ok: true, message: `Deleted roadmap milestone "${slug}".` }
        : { ok: false, message: `Milestone "${slug}" not found.` };
    }

    if (intent === 'upsert-agensi-skill') {
      const saved = await upsertAgensiSkill(db, {
        slug: String(formData.get('slug') ?? ''),
        name: String(formData.get('name') ?? ''),
        summary: String(formData.get('summary') ?? ''),
        tags: splitTags(formData.get('tags')),
        url: String(formData.get('url') ?? ''),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      });
      return { ok: true, message: `Saved Agensi skill "${saved.name}".` };
    }

    if (intent === 'delete-agensi-skill') {
      const slug = String(formData.get('slug') ?? '').trim();
      const deleted = await deleteAgensiSkill(db, slug);
      return deleted
        ? { ok: true, message: `Deleted Agensi skill "${slug}".` }
        : { ok: false, message: `Agensi skill "${slug}" not found.` };
    }

    if (intent === 'upsert-cadence-preset') {
      const saved = await upsertCadencePreset(db, {
        slug: String(formData.get('slug') ?? ''),
        title: String(formData.get('title') ?? ''),
        starterPrompt: String(formData.get('starterPrompt') ?? ''),
        expectedKind: String(formData.get('expectedKind') ?? 'html'),
        starterArtifactHtml: String(formData.get('starterArtifactHtml') ?? ''),
        sortOrder: Number(formData.get('sortOrder') ?? 0),
      });
      return { ok: true, message: `Saved CADENCE preset "${saved.title}".` };
    }

    if (intent === 'delete-cadence-preset') {
      const slug = String(formData.get('slug') ?? '').trim();
      const deleted = await deleteCadencePreset(db, slug);
      return deleted
        ? { ok: true, message: `Deleted CADENCE preset "${slug}".` }
        : { ok: false, message: `CADENCE preset "${slug}" not found.` };
    }

    return { ok: false, message: `Unsupported CMS action: ${intent}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'CMS update failed validation.',
    };
  }
}

export function meta({ matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Postgres 19 CMS // admin.andrew-k.us',
    description:
      'Manage site_content, live maintenance mode, menu registry, terminal commands, roadmap, Agensi skills, and CADENCE presets.',
  });
}

export default function AdminCmsRoute() {
  const { cms, qdrant } = useLoaderData() as CmsRouteLoaderData;
  const actionData = useActionData() as AdminCmsActionData | undefined;
  return <AdminCmsPage data={cms} qdrant={qdrant} actionData={actionData ?? null} />;
}
