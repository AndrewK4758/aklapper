import type { AgensiCatalogSource, AgensiSyncStatus } from '@aklapper/core';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const menuItems = pgTable('menu_items', {
  slug: text('slug').primaryKey(),
  keyShortcut: text('key_shortcut').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  targetK8sDeploy: text('target_k8s_deploy'),
  namespace: text('namespace'),
  adminOnly: boolean('admin_only').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
});

export const siteContent = pgTable('site_content', {
  key: text('key').primaryKey(),
  markdownBody: text('markdown_body').notNull(),
  metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agensiSkills = pgTable(
  'agensi_skills',
  {
    slug: text('slug').primaryKey(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    tags: text('tags').array().notNull().default([]),
    url: text('url').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    creatorHandle: text('creator_handle'),
    isPublished: boolean('is_published').notNull().default(false),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    source: text('source').$type<AgensiCatalogSource>().notNull().default('seed'),
  },
  table => [
    index('agensi_skills_creator_published_sort_idx').on(
      table.creatorHandle,
      table.isPublished,
      table.sortOrder,
      table.slug,
    ),
  ],
);

export const agensiSyncState = pgTable('agensi_sync_state', {
  creatorHandle: text('creator_handle').primaryKey(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
  lastStatus: text('last_status').$type<AgensiSyncStatus>().notNull().default('idle'),
  lastError: text('last_error'),
  itemCount: integer('item_count').notNull().default(0),
  etag: text('etag'),
});

export const cadencePresets = pgTable('cadence_presets', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  starterPrompt: text('starter_prompt').notNull(),
  expectedKind: text('expected_kind').notNull(),
  starterArtifactHtml: text('starter_artifact_html').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const terminalProfiles = pgTable('terminal_profiles', {
  slug: text('slug').primaryKey(),
  bannerTitle: text('banner_title').notNull(),
  bannerMeta: text('banner_meta').notNull(),
  osLabel: text('os_label').notNull().default('⚡'),
  directory: text('directory').notNull(),
  vcsBranch: text('vcs_branch').notNull(),
  vcsState: text('vcs_state')
    .$type<'clean' | 'modified' | 'untracked'>()
    .notNull()
    .default('clean'),
  contextLabel: text('context_label').notNull(),
  placeholder: text('placeholder').notNull(),
  quickCommands: text('quick_commands').array().notNull().default([]),
});

export const terminalInitialEntries = pgTable(
  'terminal_initial_entries',
  {
    id: serial('id').primaryKey(),
    profileSlug: text('profile_slug')
      .notNull()
      .references(() => terminalProfiles.slug, { onDelete: 'cascade' }),
    command: text('command').notNull(),
    output: text('output').notNull(),
    status: text('status').$type<'ok' | 'error'>().notNull().default('ok'),
    durationLabel: text('duration_label').notNull(),
    timestampLabel: text('timestamp_label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  table => [
    uniqueIndex('terminal_initial_entries_profile_sort_idx').on(table.profileSlug, table.sortOrder),
  ],
);

export const terminalCommands = pgTable(
  'terminal_commands',
  {
    id: serial('id').primaryKey(),
    profileSlug: text('profile_slug')
      .notNull()
      .references(() => terminalProfiles.slug, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    kind: text('kind')
      .$type<'static' | 'navigate' | 'cd' | 'tui' | 'roadmap' | 'uptime' | 'clear'>()
      .notNull()
      .default('static'),
    output: text('output').notNull().default(''),
    targetRoute: text('target_route'),
    allowedRoutes: text('allowed_routes').array().notNull().default([]),
    errorTemplate: text('error_template'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  table => [uniqueIndex('terminal_commands_profile_name_idx').on(table.profileSlug, table.name)],
);

export const terminalDirectoryEntries = pgTable(
  'terminal_directory_entries',
  {
    id: serial('id').primaryKey(),
    profileSlug: text('profile_slug')
      .notNull()
      .references(() => terminalProfiles.slug, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
  },
  table => [
    uniqueIndex('terminal_directory_entries_profile_name_idx').on(table.profileSlug, table.name),
  ],
);

export const roadmapMilestones = pgTable('roadmap_milestones', {
  slug: text('slug').primaryKey(),
  status: text('status').$type<'done' | 'active' | 'queued'>().notNull(),
  label: text('label').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  enabled: boolean('enabled').notNull().default(true),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  handle: text('handle').notNull().unique(),
  role: text('role').$type<'guest' | 'admin'>().notNull().default('guest'),
  passwordHashArgon2: text('password_hash_argon2'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webauthnCredentials = pgTable('webauthn_credentials', {
  credentialId: text('credential_id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(),
  counter: integer('counter').notNull().default(0),
  transports: text('transports').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const totpSecrets = pgTable('totp_secrets', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  encryptedSecret: text('encrypted_secret').notNull(),
  enabled: boolean('enabled').notNull().default(false),
  backupCodesHash: text('backup_codes_hash').array().notNull().default([]),
});

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').$type<'guest' | 'admin'>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const webauthnChallenges = pgTable('webauthn_challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  challenge: text('challenge').notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind').$type<'register' | 'login'>().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quotaPolicies = pgTable('quota_policies', {
  role: text('role').$type<'guest' | 'admin'>().primaryKey(),
  maxTurnsPerSession: integer('max_turns_per_session').notNull(),
  maxTokensPerRun: integer('max_tokens_per_run').notNull(),
  maxDailyGlobalTokens: integer('max_daily_global_tokens').notNull(),
});

export const rateLimitBuckets = pgTable('rate_limit_buckets', {
  scopeKey: text('scope_key').primaryKey(),
  windowStart: timestamp('window_start', { withTimezone: true }).notNull().defaultNow(),
  turnsUsed: integer('turns_used').notNull().default(0),
  tokensUsed: integer('tokens_used').notNull().default(0),
});

export const askTurns = pgTable(
  'ask_turns',
  {
    attemptId: text('attempt_id').primaryKey(),
    sessionId: text('session_id').notNull(),
    role: text('role').$type<'guest' | 'admin'>().notNull(),
    mode: text('mode').$type<'qa' | 'jd_match'>().notNull(),
    promptHash: text('prompt_hash').notNull(),
    status: text('status')
      .$type<'pending' | 'running' | 'completed' | 'abstained' | 'failed' | 'expired'>()
      .notNull(),
    tokensReserved: integer('tokens_reserved').notNull().default(0),
    tokensUsed: integer('tokens_used').notNull().default(0),
    resultJson: jsonb('result_json').$type<Record<string, unknown> | null>(),
    errorCode: text('error_code'),
    correlationId: text('correlation_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  table => [
    index('ask_turns_session_expires_idx').on(table.sessionId, table.expiresAt),
    index('ask_turns_status_lease_idx').on(table.status, table.leaseExpiresAt),
  ],
);

export const sandboxRuns = pgTable('sandbox_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  ipHash: text('ip_hash').notNull(),
  menuSlug: text('menu_slug').notNull(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull(),
  gateVerdict: text('gate_verdict').notNull().default('pending'),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  artifactHtml: text('artifact_html'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sandboxTurns = pgTable('sandbox_turns', {
  id: serial('id').primaryKey(),
  runId: uuid('run_id')
    .notNull()
    .references(() => sandboxRuns.id, { onDelete: 'cascade' }),
  phase: text('phase').notNull(),
  agentName: text('agent_name').notNull(),
  status: text('status').notNull(),
  payloadJson: jsonb('payload_json').$type<Record<string, unknown>>().notNull().default({}),
  latencyMs: integer('latency_ms').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsSessions = pgTable('analytics_sessions', {
  sessionId: text('session_id').primaryKey(),
  ipHash: text('ip_hash').notNull(),
  referrer: text('referrer'),
  country: text('country'),
  region: text('region'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsEvents = pgTable('analytics_events', {
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
});

export const contactSubmissions = pgTable(
  'contact_submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email').notNull(),
    message: text('message').notNull(),
    attachmentName: text('attachment_name'),
    attachmentMimeType: text('attachment_mime_type'),
    attachmentSizeBytes: integer('attachment_size_bytes'),
    attachmentSha256: text('attachment_sha256'),
    attachmentContentBase64: text('attachment_content_base64'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    check(
      'contact_name_length_check',
      sql`char_length(btrim(${table.name})) >= 2 AND char_length(btrim(${table.name})) <= 120`,
    ),
    check(
      'contact_phone_format_check',
      sql`${table.phone} IS NULL OR (char_length(btrim(${table.phone})) >= 7 AND char_length(btrim(${table.phone})) <= 32 AND ${table.phone} ~ '^[0-9+(). -]+$')`,
    ),
    check(
      'contact_email_format_check',
      sql`char_length(btrim(${table.email})) <= 254 AND ${table.email} ~* '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'`,
    ),
    check(
      'contact_message_length_check',
      sql`char_length(btrim(${table.message})) >= 10 AND char_length(btrim(${table.message})) <= 4000`,
    ),
    check(
      'contact_attachment_consistency_check',
      sql`(
        ${table.attachmentName} IS NULL
        AND ${table.attachmentMimeType} IS NULL
        AND ${table.attachmentSizeBytes} IS NULL
        AND ${table.attachmentSha256} IS NULL
        AND ${table.attachmentContentBase64} IS NULL
      ) OR (
        ${table.attachmentName} IS NOT NULL
        AND char_length(btrim(${table.attachmentName})) >= 1
        AND char_length(btrim(${table.attachmentName})) <= 255
        AND ${table.attachmentMimeType} IN (
          'application/pdf',
          'text/plain',
          'text/markdown',
          'image/png',
          'image/jpeg',
          'image/webp',
          'application/json',
          'text/csv'
        )
        AND ${table.attachmentSizeBytes} IS NOT NULL
        AND ${table.attachmentSizeBytes} >= 1
        AND ${table.attachmentSizeBytes} <= 5242880
        AND ${table.attachmentSha256} IS NOT NULL
        AND ${table.attachmentSha256} ~ '^[a-fA-F0-9]{64}$'
        AND ${table.attachmentContentBase64} IS NOT NULL
        AND char_length(${table.attachmentContentBase64}) >= 1
      )`,
    ),
  ],
);
