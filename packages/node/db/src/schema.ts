import {
  boolean,
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

export const agensiSkills = pgTable('agensi_skills', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  summary: text('summary').notNull(),
  tags: text('tags').array().notNull().default([]),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
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
