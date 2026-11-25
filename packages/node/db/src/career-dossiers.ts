import {
  type CareerDossier,
  CareerDossierSchema,
  type CareerDossierUpsertInput,
  CareerDossierUpsertSchema,
} from '@aklapper/core';
import {
  isProductionPrivacyEnv,
  sanitizeCareerDossierPayload,
} from '@aklapper/node-runtime/privacy';
import { and, asc, eq, isNotNull } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import { careerDossiers } from './schema-dossiers.ts';

export interface CareerDossierMutationOptions {
  readonly rawDenylist?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly correlationId?: string;
}

type CareerDossierRow = typeof careerDossiers.$inferSelect;

function mapCareerDossierRow(row: CareerDossierRow): CareerDossier {
  return CareerDossierSchema.parse({
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    domainLabel: row.domainLabel,
    roleTitle: row.roleTitle,
    timeframe: row.timeframe,
    skills: [...row.skills],
    summaryBody: row.summaryBody,
    sections: row.sectionsJson.map(section => ({
      heading: section.heading,
      body: section.body,
    })),
    publishStatus: row.publishStatus,
    sanitizationVerifiedAt: row.sanitizationVerifiedAt
      ? row.sanitizationVerifiedAt.toISOString()
      : null,
    denylistHash: row.denylistHash ?? null,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function listCareerDossiers(db: AppDatabase): Promise<CareerDossier[]> {
  const rows = await db
    .select()
    .from(careerDossiers)
    .orderBy(asc(careerDossiers.sortOrder), asc(careerDossiers.slug));
  return rows.map(mapCareerDossierRow);
}

export async function listPublishedCareerDossiers(db: AppDatabase): Promise<CareerDossier[]> {
  const rows = await db
    .select()
    .from(careerDossiers)
    .where(
      and(
        eq(careerDossiers.publishStatus, 'published'),
        isNotNull(careerDossiers.sanitizationVerifiedAt),
      ),
    )
    .orderBy(asc(careerDossiers.sortOrder), asc(careerDossiers.slug));
  return rows.map(mapCareerDossierRow);
}

export async function getCareerDossierBySlug(
  db: AppDatabase,
  slug: string,
): Promise<CareerDossier | null> {
  const normalized = slug.trim();
  if (!normalized) {
    return null;
  }
  const [row] = await db
    .select()
    .from(careerDossiers)
    .where(eq(careerDossiers.slug, normalized))
    .limit(1);
  return row ? mapCareerDossierRow(row) : null;
}

export async function upsertCareerDossier(
  db: AppDatabase,
  input: CareerDossierUpsertInput,
  options: CareerDossierMutationOptions = {},
): Promise<CareerDossier> {
  const parsed = CareerDossierUpsertSchema.parse(input);
  const { denylistHash, verifiedAt } = sanitizeCareerDossierPayload(parsed, {
    requireConfiguredDenylist: false,
    rawDenylist: options.rawDenylist,
    env: options.env,
    correlationId: options.correlationId,
  });

  const [row] = await db
    .insert(careerDossiers)
    .values({
      slug: parsed.slug,
      kind: parsed.kind,
      title: parsed.title,
      domainLabel: parsed.domainLabel,
      roleTitle: parsed.roleTitle,
      timeframe: parsed.timeframe,
      skills: [...parsed.skills],
      summaryBody: parsed.summaryBody,
      sectionsJson: parsed.sections.map(section => ({
        heading: section.heading,
        body: section.body,
      })),
      publishStatus: 'draft',
      sanitizationVerifiedAt: verifiedAt,
      denylistHash,
      sortOrder: parsed.sortOrder,
      updatedAt: verifiedAt,
    })
    .onConflictDoUpdate({
      target: careerDossiers.slug,
      set: {
        kind: parsed.kind,
        title: parsed.title,
        domainLabel: parsed.domainLabel,
        roleTitle: parsed.roleTitle,
        timeframe: parsed.timeframe,
        skills: [...parsed.skills],
        summaryBody: parsed.summaryBody,
        sectionsJson: parsed.sections.map(section => ({
          heading: section.heading,
          body: section.body,
        })),
        publishStatus: 'draft',
        sanitizationVerifiedAt: verifiedAt,
        denylistHash,
        sortOrder: parsed.sortOrder,
        updatedAt: verifiedAt,
      },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to persist career dossier "${parsed.slug}".`);
  }
  return mapCareerDossierRow(row);
}

export async function publishCareerDossier(
  db: AppDatabase,
  slug: string,
  options: CareerDossierMutationOptions = {},
): Promise<CareerDossier | null> {
  const normalized = slug.trim();
  if (!normalized) {
    return null;
  }

  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(careerDossiers)
      .where(eq(careerDossiers.slug, normalized))
      .limit(1);

    if (!existing) {
      return null;
    }

    const payload = CareerDossierUpsertSchema.parse({
      slug: existing.slug,
      kind: existing.kind,
      title: existing.title,
      domainLabel: existing.domainLabel,
      roleTitle: existing.roleTitle,
      timeframe: existing.timeframe,
      skills: [...existing.skills],
      summaryBody: existing.summaryBody,
      sections: existing.sectionsJson,
      sortOrder: existing.sortOrder,
    });

    const { denylistHash, verifiedAt } = sanitizeCareerDossierPayload(payload, {
      requireConfiguredDenylist: isProductionPrivacyEnv(options.env),
      rawDenylist: options.rawDenylist,
      env: options.env,
      correlationId: options.correlationId,
    });

    const [updated] = await tx
      .update(careerDossiers)
      .set({
        publishStatus: 'published',
        sanitizationVerifiedAt: verifiedAt,
        denylistHash,
        updatedAt: verifiedAt,
      })
      .where(eq(careerDossiers.slug, normalized))
      .returning();

    return updated ? mapCareerDossierRow(updated) : null;
  });
}

export async function unpublishCareerDossier(
  db: AppDatabase,
  slug: string,
): Promise<CareerDossier | null> {
  const normalized = slug.trim();
  if (!normalized) {
    return null;
  }

  const [updated] = await db
    .update(careerDossiers)
    .set({
      publishStatus: 'draft',
      updatedAt: new Date(),
    })
    .where(eq(careerDossiers.slug, normalized))
    .returning();

  return updated ? mapCareerDossierRow(updated) : null;
}

export async function deleteCareerDossier(db: AppDatabase, slug: string): Promise<boolean> {
  const normalized = slug.trim();
  if (!normalized) {
    return false;
  }
  const deleted = await db
    .delete(careerDossiers)
    .where(eq(careerDossiers.slug, normalized))
    .returning({ slug: careerDossiers.slug });
  return deleted.length > 0;
}
