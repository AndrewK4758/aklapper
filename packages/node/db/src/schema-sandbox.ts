import type { CadenceExecutionMode, CadenceGateAudit, CadenceSpecArtifact } from '@aklapper/core';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const sandboxRuns = pgTable(
  'sandbox_runs',
  {
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
    isGolden: boolean('is_golden').notNull().default(false),
    promptHash: text('prompt_hash'),
    executionMode: text('execution_mode').$type<CadenceExecutionMode>().notNull().default('fast'),
    specJson: jsonb('spec_json').$type<CadenceSpecArtifact | null>(),
    gateAuditJson: jsonb('gate_audit_json').$type<CadenceGateAudit | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    check(
      'sandbox_runs_execution_mode_check',
      sql`${table.executionMode} IN ('golden', 'cached', 'live', 'fast', 'fallback')`,
    ),
    check(
      'sandbox_runs_golden_immutable_check',
      sql`NOT ${table.isGolden} OR (${table.status} = 'ready' AND ${table.gateVerdict} = 'approved' AND ${table.executionMode} = 'golden')`,
    ),
    index('sandbox_runs_golden_created_idx')
      .on(table.isGolden, table.createdAt)
      .where(sql`${table.isGolden} = true`),
    index('sandbox_runs_prompt_hash_ready_idx')
      .on(table.promptHash, table.isGolden, table.createdAt)
      .where(
        sql`${table.status} = 'ready' AND ${table.promptHash} IS NOT NULL AND ${table.executionMode} IN ('live', 'fast', 'golden')`,
      ),
    index('sandbox_runs_session_prompt_hash_idx')
      .on(table.sessionId, table.promptHash, table.createdAt)
      .where(
        sql`${table.status} = 'ready' AND ${table.promptHash} IS NOT NULL AND ${table.executionMode} IN ('live', 'fast')`,
      ),
  ],
);

export const sandboxTurns = pgTable(
  'sandbox_turns',
  {
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
  },
  table => [uniqueIndex('sandbox_turns_run_phase_uidx').on(table.runId, table.phase)],
);
