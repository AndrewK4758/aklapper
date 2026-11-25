import {
  CareerDossierUpsertSchema,
  extractPrivacySanitizationFindings,
  type AppErrorCode,
  type CareerDossierSection,
} from '@aklapper/core';
import {
  deleteCareerDossier,
  getSharedDb,
  publishCareerDossier,
  unpublishCareerDossier,
  upsertCareerDossier,
} from '@aklapper/db';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

import { type AdminCmsActionData, parseCareerDossierMarkdown } from '#pages/cms';

export const MAX_DOSSIER_MD_FILE_BYTES = 256 * 1024;
export const MAX_DOSSIER_MD_BATCH_FILES = 10;

export interface DossierIntentContext {
  readonly correlationId: string;
  readonly logger: SsrStructuredLogger;
  readonly adminActor: string;
}

export interface DossierActionOutcome {
  readonly status: number;
  readonly payload: AdminCmsActionData;
}

const DOSSIER_INTENTS = new Set([
  'upsert-career-dossier',
  'import-career-dossier-files',
  'publish-career-dossier',
  'unpublish-career-dossier',
  'delete-career-dossier',
]);

export function isCareerDossierIntent(intent: string): boolean {
  return DOSSIER_INTENTS.has(intent);
}

function ok(message: string): DossierActionOutcome {
  return { status: 200, payload: { ok: true, message } };
}

function fail(
  status: number,
  message: string,
  code: AppErrorCode,
  action: string,
  correlationId: string,
  extra?: Partial<Pick<AdminCmsActionData, 'sanitizationFindings'>>,
): DossierActionOutcome {
  return {
    status,
    payload: {
      ok: false,
      message,
      code,
      action,
      correlationId,
      ...(extra?.sanitizationFindings ? { sanitizationFindings: extra.sanitizationFindings } : {}),
    },
  };
}

function parseSkillsCsv(raw: FormDataEntryValue | null): string[] {
  return String(raw ?? '')
    .split(',')
    .map(skill => skill.trim())
    .filter(Boolean);
}

function parseSectionsJson(raw: FormDataEntryValue | null): CareerDossierSection[] | null {
  const text = String(raw ?? '[]').trim();
  if (!text) return [];
  try {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return null;
    const out: CareerDossierSection[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const heading = String(rec['heading'] ?? '').trim();
      const body = String(rec['body'] ?? '').trim();
      if (heading || body) {
        out.push({ heading, body });
      }
    }
    return out;
  } catch {
    return null;
  }
}

function emitDossierAuditLog(
  ctx: DossierIntentContext,
  slug: string,
  publishStatus: string,
  chunkCount: number,
): void {
  ctx.logger.info(
    {
      event: 'admin.cms.dossier_mutation_committed',
      seam_type: 'DELTA_AUDIT_GAP',
      slug,
      publishStatus,
      chunkCount,
      adminActor: ctx.adminActor,
      correlationId: ctx.correlationId,
    },
    'Committed career dossier mutation.',
  );
}

function mapPrivacyFailure(error: unknown, correlationId: string): DossierActionOutcome | null {
  const findings = extractPrivacySanitizationFindings(error);
  if (!findings) {
    return null;
  }
  return fail(
    422,
    'Career dossier failed privacy sanitization policy. Review blocked fields in ValidationGatePreview.',
    'ERR_CONSTRAINT',
    'Remove sensitive or denylisted terms and retry.',
    correlationId,
    { sanitizationFindings: findings },
  );
}

function decodeStrictUtf8(bytes: Uint8Array): string | null {
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0) {
      return null;
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export async function handleCareerDossierIntent(
  intent: string,
  formData: FormData,
  ctx: DossierIntentContext,
): Promise<DossierActionOutcome> {
  if (intent === 'upsert-career-dossier') {
    const sections = parseSectionsJson(formData.get('sectionsJson'));
    if (sections === null) {
      return fail(
        400,
        'Invalid sections JSON in career dossier submission.',
        'ERR_VALIDATION',
        'Review section entries and retry.',
        ctx.correlationId,
      );
    }

    const parsed = CareerDossierUpsertSchema.safeParse({
      slug: String(formData.get('slug') ?? ''),
      kind: String(formData.get('kind') ?? 'experience'),
      title: String(formData.get('title') ?? ''),
      domainLabel: String(formData.get('domainLabel') ?? ''),
      roleTitle: String(formData.get('roleTitle') ?? ''),
      timeframe: String(formData.get('timeframe') ?? ''),
      skills: parseSkillsCsv(formData.get('skills')),
      summaryBody: String(formData.get('summaryBody') ?? ''),
      sections,
      sortOrder: Number(formData.get('sortOrder') ?? 0),
    });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(
        400,
        first
          ? `Invalid career dossier field (${first.path.join('.')}): ${first.message}`
          : 'Invalid career dossier input.',
        'ERR_VALIDATION',
        'Correct highlighted dossier fields and retry.',
        ctx.correlationId,
      );
    }

    try {
      const saved = await upsertCareerDossier(getSharedDb(), parsed.data, {
        correlationId: ctx.correlationId,
      });
      emitDossierAuditLog(ctx, saved.slug, saved.publishStatus, 1 + saved.sections.length);
      return ok(
        `Saved draft career dossier "${saved.slug}" (${1 + saved.sections.length} chunks).`,
      );
    } catch (error) {
      const mapped = mapPrivacyFailure(error, ctx.correlationId);
      if (mapped) return mapped;
      throw error;
    }
  }

  if (intent === 'import-career-dossier-files') {
    const rawEntries = formData.getAll('markdownFiles');
    const files = rawEntries.filter(
      (entry): entry is File =>
        typeof File !== 'undefined' && entry instanceof File && entry.size > 0,
    );
    if (files.length === 0) {
      return fail(
        400,
        'Select at least one non-empty .md file to import.',
        'ERR_VALIDATION',
        'Choose 1 to 10 UTF-8 markdown files (<= 256 KB each) and retry.',
        ctx.correlationId,
      );
    }
    if (files.length > MAX_DOSSIER_MD_BATCH_FILES) {
      return fail(
        400,
        `Too many markdown files in batch (${files.length} > ${MAX_DOSSIER_MD_BATCH_FILES}).`,
        'ERR_VALIDATION',
        `Upload at most ${MAX_DOSSIER_MD_BATCH_FILES} markdown files per batch.`,
        ctx.correlationId,
      );
    }

    const decodedPayloads: Array<ReturnType<typeof parseCareerDossierMarkdown>> = [];
    for (const file of files) {
      if (file.size > MAX_DOSSIER_MD_FILE_BYTES) {
        return fail(
          400,
          `Markdown file exceeds maximum size of ${MAX_DOSSIER_MD_FILE_BYTES} bytes.`,
          'ERR_VALIDATION',
          'Split oversized files under 256 KB before uploading.',
          ctx.correlationId,
        );
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const utf8Text = decodeStrictUtf8(bytes);
      if (utf8Text === null || !utf8Text.trim()) {
        return fail(
          400,
          'Uploaded markdown file must be valid non-binary UTF-8 text.',
          'ERR_VALIDATION',
          'Export plain UTF-8 markdown files and retry.',
          ctx.correlationId,
        );
      }
      decodedPayloads.push(parseCareerDossierMarkdown(utf8Text, file.name));
    }

    const savedSlugs: string[] = [];
    for (const payload of decodedPayloads) {
      try {
        const saved = await upsertCareerDossier(
          getSharedDb(),
          {
            slug: payload.slug,
            kind: payload.kind,
            title: payload.title,
            domainLabel: payload.domainLabel,
            roleTitle: payload.roleTitle,
            timeframe: payload.timeframe,
            skills: [...payload.skills],
            summaryBody: payload.summaryBody,
            sections: [...payload.sections],
            sortOrder: 0,
          },
          { correlationId: ctx.correlationId },
        );
        emitDossierAuditLog(ctx, saved.slug, saved.publishStatus, 1 + saved.sections.length);
        savedSlugs.push(saved.slug);
      } catch (error) {
        const mapped = mapPrivacyFailure(error, ctx.correlationId);
        if (mapped) return mapped;
        throw error;
      }
    }

    return ok(`Imported ${savedSlugs.length} draft career dossier(s): ${savedSlugs.join(', ')}.`);
  }

  if (intent === 'publish-career-dossier') {
    const slug = String(formData.get('slug') ?? '').trim();
    try {
      const published = await publishCareerDossier(getSharedDb(), slug, {
        correlationId: ctx.correlationId,
      });
      if (!published) {
        return fail(
          404,
          `Career dossier "${slug}" not found.`,
          'ERR_NOT_FOUND',
          'Refresh the CMS view and verify the dossier slug.',
          ctx.correlationId,
        );
      }
      emitDossierAuditLog(
        ctx,
        published.slug,
        published.publishStatus,
        1 + published.sections.length,
      );
      return ok(
        `Published career dossier "${published.slug}". Run Re-Index Qdrant Corpus to sync vectors.`,
      );
    } catch (error) {
      const mapped = mapPrivacyFailure(error, ctx.correlationId);
      if (mapped) return mapped;
      throw error;
    }
  }

  if (intent === 'unpublish-career-dossier') {
    const slug = String(formData.get('slug') ?? '').trim();
    const updated = await unpublishCareerDossier(getSharedDb(), slug);
    if (!updated) {
      return fail(
        404,
        `Career dossier "${slug}" not found.`,
        'ERR_NOT_FOUND',
        'Refresh the CMS view and verify the dossier slug.',
        ctx.correlationId,
      );
    }
    emitDossierAuditLog(ctx, updated.slug, updated.publishStatus, 1 + updated.sections.length);
    return ok(
      `Unpublished career dossier "${updated.slug}" to draft. Run Re-Index Qdrant Corpus to prune vectors.`,
    );
  }

  const slug = String(formData.get('slug') ?? '').trim();
  const deleted = await deleteCareerDossier(getSharedDb(), slug);
  if (!deleted) {
    return fail(
      404,
      `Career dossier "${slug}" not found.`,
      'ERR_NOT_FOUND',
      'Refresh the CMS view and verify the dossier slug.',
      ctx.correlationId,
    );
  }
  emitDossierAuditLog(ctx, slug, 'deleted', 0);
  return ok(`Deleted career dossier "${slug}".`);
}
