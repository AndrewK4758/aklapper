import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const analyticsSessions = pgTable(
  'analytics_sessions',
  {
    sessionId: text('session_id').primaryKey(),
    ipHash: text('ip_hash').notNull(),
    referrer: text('referrer'),
    country: text('country'),
    region: text('region'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    app: text('app').$type<'portal' | 'admin'>().notNull().default('portal'),
    isBot: boolean('is_bot').notNull().default(false),
    visitorHash: text('visitor_hash'),
    guestSessionId: text('guest_session_id'),
    city: text('city'),
    timezone: text('timezone'),
    asn: integer('asn'),
    asnOrg: text('asn_org'),
    referrerHost: text('referrer_host'),
    referrerCategory: text('referrer_category').$type<
      'direct' | 'search' | 'social' | 'developer' | 'referral'
    >(),
    landingPath: text('landing_path'),
    refParam: text('ref_param'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    deviceType: text('device_type').$type<'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown'>(),
    osName: text('os_name'),
    browserName: text('browser_name'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  table => [
    index('analytics_sessions_app_bot_started_idx').on(
      table.app,
      table.isBot,
      table.startedAt.desc(),
    ),
    index('analytics_sessions_visitor_hash_started_idx')
      .on(table.app, table.visitorHash, table.startedAt.desc())
      .where(sql`${table.visitorHash} IS NOT NULL`),
    index('analytics_sessions_guest_session_idx')
      .on(table.guestSessionId, table.startedAt.desc())
      .where(sql`${table.guestSessionId} IS NOT NULL`),
    index('analytics_sessions_referrer_host_started_idx')
      .on(table.referrerHost, table.startedAt.desc())
      .where(sql`${table.referrerHost} IS NOT NULL`),
    index('analytics_sessions_geo_started_idx')
      .on(table.country, table.region, table.startedAt.desc())
      .where(sql`${table.country} IS NOT NULL`),
  ],
);

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: serial('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => analyticsSessions.sessionId, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    name: text('name').notNull(),
    path: text('path').notNull(),
    value: real('value'),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('analytics_events_session_created_idx').on(table.sessionId, table.createdAt),
    index('analytics_events_type_created_path_idx').on(
      table.type,
      table.createdAt.desc(),
      table.path,
    ),
  ],
);
