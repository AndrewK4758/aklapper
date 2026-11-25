import type {
  CareerDossierKind,
  CareerDossierPublishStatus,
  CareerDossierSection,
} from '@aklapper/core';
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const careerDossiers = pgTable(
  'career_dossiers',
  {
    slug: text('slug').primaryKey(),
    kind: text('kind').$type<CareerDossierKind>().notNull(),
    title: text('title').notNull(),
    domainLabel: text('domain_label').notNull(),
    roleTitle: text('role_title').notNull(),
    timeframe: text('timeframe').notNull(),
    skills: text('skills').array().notNull().default([]),
    summaryBody: text('summary_body').notNull(),
    sectionsJson: jsonb('sections_json').$type<CareerDossierSection[]>().notNull().default([]),
    publishStatus: text('publish_status')
      .$type<CareerDossierPublishStatus>()
      .notNull()
      .default('draft'),
    sanitizationVerifiedAt: timestamp('sanitization_verified_at', { withTimezone: true }),
    denylistHash: text('denylist_hash'),
    searchTsv: tsvector('search_tsv')
      .notNull()
      .default(sql`''::tsvector`),
    sortOrder: integer('sort_order').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    check(
      'career_dossiers_kind_check',
      sql`${table.kind} IN ('profile_core', 'experience', 'project', 'architecture', 'leadership')`,
    ),
    check(
      'career_dossiers_publish_status_check',
      sql`${table.publishStatus} IN ('draft', 'published')`,
    ),
    check(
      'career_dossiers_published_verified_check',
      sql`${table.publishStatus} = 'draft' OR ${table.sanitizationVerifiedAt} IS NOT NULL`,
    ),
    index('career_dossiers_publish_sort_idx').on(table.publishStatus, table.sortOrder, table.slug),
  ],
);
