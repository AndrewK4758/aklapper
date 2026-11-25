import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  classifyServerError,
  enforcePublicErrorBoundary,
  StreamDeadlineError,
  type BoundaryFaultEvent,
} from '../src/error-classification.ts';
import {
  ADMIN_ROUTE_PATHS,
  AppErrorCodeSchema,
  createPublicAppError,
  extractPrivacySanitizationFindings,
  isPortalNavigableRoutePath,
  isPublicAppError,
  isStreamResult,
  PORTAL_NAVIGABLE_ROUTE_PATHS,
  PORTAL_ROUTE_PATHS,
  PublicAppErrorSchema,
  type ContactActionResult,
  type PublicAppError,
  type StreamResult,
} from '../src/index.ts';

describe('@aklapper/core error contracts and server error classification', () => {
  it('classifies wrapped DrizzleQueryError causes, AggregateError, pg connection messages, timeouts, constraints, and unknown errors accurately', () => {
    const context = { correlationId: 'req-001', source: 'portal.menu.loader' };

    const pgConnFailure = Object.assign(new Error('connection failure'), { code: '08006' });
    const drizzleConnErr = Object.assign(
      new Error('Failed query: select * from menu_items params: []', { cause: pgConnFailure }),
      { name: 'DrizzleQueryError' },
    );

    const connRefused = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    });
    const aggregateErr = new AggregateError([connRefused], 'All connection attempts failed');

    const dbUnavailableCases: readonly unknown[] = [
      drizzleConnErr,
      aggregateErr,
      new Error('Connection terminated'),
      new Error('Connection terminated unexpectedly'),
      new Error('Connection terminated due to connection timeout'),
      new Error('timeout exceeded when trying to connect'),
      new Error('DATABASE_URL is required to initialize PostgreSQL pool'),
    ];

    for (const candidate of dbUnavailableCases) {
      const classified = classifyServerError(candidate, context);
      expect(classified.publicError.code).toBe('ERR_DB_UNAVAILABLE');
      expect(classified.publicError.status).toBe(503);
      expect(classified.publicError.correlationId).toBe('req-001');
      expect(classified.publicError.action.length).toBeGreaterThan(0);
      expect(classified.telemetry).toEqual(
        expect.objectContaining({
          event: 'ssr.error.classification_branch',
          seam_type: 'RULE_DIVERGENCE',
          code: 'ERR_DB_UNAVAILABLE',
        }),
      );
    }

    const pgClassified = classifyServerError(drizzleConnErr, context);
    expect(pgClassified.diagnostic.pgCode).toBe('08006');
    expect(pgClassified.diagnostic.reasoning.length).toBeGreaterThan(0);

    for (const pgCode of ['23502', '23514', '23505']) {
      const pgConstraint = Object.assign(new Error('constraint violated'), { code: pgCode });
      const drizzleConstraint = Object.assign(
        new Error('Failed query: insert', { cause: pgConstraint }),
        {
          name: 'DrizzleQueryError',
        },
      );
      const classified = classifyServerError(drizzleConstraint, context);
      expect(classified.publicError.code).toBe('ERR_CONSTRAINT');
      expect(classified.publicError.status).toBe(422);
      expect(classified.diagnostic.pgCode).toBe(pgCode);
    }

    const deadlineErr = new StreamDeadlineError(4_000, 'portal.menu.loader');
    const timeoutClassified = classifyServerError(deadlineErr, context);
    expect(timeoutClassified.publicError.code).toBe('ERR_STREAM_TIMEOUT');
    expect(timeoutClassified.publicError.status).toBe(504);
    expect(timeoutClassified.telemetry.code).toBe('ERR_STREAM_TIMEOUT');

    const abortErr = new DOMException('Client disconnected', 'AbortError');
    const abortClassified = classifyServerError(abortErr, context);
    expect(abortClassified.publicError.code).toBe('ERR_STREAM_ABORTED');
    expect(abortClassified.publicError.status).toBe(499);
    expect(abortClassified.diagnostic.severity).toBe('WARN');

    const zodResult = z.object({ name: z.string().min(2) }).safeParse({ name: '' });
    expect(zodResult.success).toBe(false);
    const zodError = zodResult.success ? null : zodResult.error;
    const zodClassified = classifyServerError(zodError, context);
    expect(zodClassified.publicError.code).toBe('ERR_VALIDATION');
    expect(zodClassified.publicError.status).toBe(400);

    const routeNotFound = { status: 404, statusText: 'Not Found', data: null, internal: false };
    const notFoundClassified = classifyServerError(routeNotFound, context);
    expect(notFoundClassified.publicError.code).toBe('ERR_NOT_FOUND');
    expect(notFoundClassified.publicError.status).toBe(404);

    const unknownClassified = classifyServerError(new Error('totally unexpected boom'), context);
    expect(unknownClassified.publicError.code).toBe('ERR_INTERNAL');
    expect(unknownClassified.publicError.status).toBe(500);
    expect(unknownClassified.telemetry).toEqual(
      expect.objectContaining({
        event: 'ssr.error.classification_branch',
        code: 'ERR_INTERNAL',
      }),
    );

    const privacyErr = Object.assign(new Error('Content failed privacy sanitization policy.'), {
      name: 'PrivacySanitizationError',
      code: 'ERR_CONSTRAINT',
      status: 422,
      findings: [
        {
          ruleId: 'denylist.term_1',
          category: 'denylist',
          field: 'summaryBody',
          location: 'line:1',
        },
      ],
    });
    const privacyClassified = classifyServerError(privacyErr, context);
    expect(privacyClassified.publicError.code).toBe('ERR_CONSTRAINT');
    expect(privacyClassified.publicError.status).toBe(422);
    expect(extractPrivacySanitizationFindings(privacyErr)).toEqual([
      {
        ruleId: 'denylist.term_1',
        category: 'denylist',
        field: 'summaryBody',
        location: 'line:1',
      },
    ]);
    expect(extractPrivacySanitizationFindings(new Error('plain'))).toBeNull();

    // Cycle-safe cause unwrapping must never hang
    const cyclicA = new Error('cyclic A') as Error & { cause?: unknown };
    const cyclicB = new Error('cyclic B', { cause: cyclicA });
    cyclicA.cause = cyclicB;
    expect(classifyServerError(cyclicA, context).publicError.code).toBe('ERR_INTERNAL');
  });

  it('redacts raw SQL, credentials, stacks, and Drizzle bound PII from both PublicAppError and DiagnosticAppError', () => {
    const context = { correlationId: 'req-redact-1', source: 'portal.contact.action' };

    const pgCause = Object.assign(new Error('connection failure during insert'), {
      code: '08006',
    });
    pgCause.stack = [
      'Error: connection failure during insert',
      '    at Socket.<anonymous> (/app/node_modules/pg/lib/connection.js:120:14)',
      '    at Socket.emit (node:events:519:28)',
    ].join('\n');

    const base64Payload =
      'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVowMTIzNDU2Nzg5QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=';
    const drizzleMessage = `Failed query: INSERT INTO contact_submissions (name, email, phone, attachment) VALUES ($1, $2, $3, $4) params: [Grace Hopper, grace@example.com, +1-555-0100, ${base64Payload}]`;
    const drizzleErr = Object.assign(new Error(drizzleMessage, { cause: pgCause }), {
      name: 'DrizzleQueryError',
    });
    drizzleErr.stack = [
      `DrizzleQueryError: ${drizzleMessage}`,
      '    at NodePgPreparedQuery.queryWithCache (/app/node_modules/drizzle-orm/node-postgres/session.js:88:12)',
    ].join('\n');

    const classifiedDrizzle = classifyServerError(drizzleErr, context);
    expect(PublicAppErrorSchema.safeParse(classifiedDrizzle.publicError).success).toBe(true);
    const publicText = `${classifiedDrizzle.publicError.message} ${classifiedDrizzle.publicError.action}`;
    for (const forbidden of [
      'INSERT',
      'contact_submissions',
      'params:',
      'grace@example.com',
      'Grace Hopper',
      'postgres://',
      '.js:',
      '.ts:',
      'at ',
    ]) {
      expect(publicText).not.toContain(forbidden);
    }

    expect(classifiedDrizzle.diagnostic.causeMessage).toBeDefined();
    expect(classifiedDrizzle.diagnostic.causeMessage!.length).toBeLessThanOrEqual(512);
    expect(classifiedDrizzle.diagnostic.causeMessage).not.toContain('Failed query:');
    expect(classifiedDrizzle.diagnostic.causeMessage).not.toContain('params:');
    expect(classifiedDrizzle.diagnostic.causeMessage).not.toContain('grace@example.com');
    expect(classifiedDrizzle.diagnostic.causeMessage).not.toContain(base64Payload);

    expect(classifiedDrizzle.diagnostic.causeStack).toBeDefined();
    expect(classifiedDrizzle.diagnostic.causeStack!.length).toBeLessThanOrEqual(2048);
    expect(classifiedDrizzle.diagnostic.causeStack).not.toContain('Failed query:');
    expect(classifiedDrizzle.diagnostic.causeStack).not.toContain('params:');
    expect(classifiedDrizzle.diagnostic.causeStack).not.toContain('grace@example.com');
    expect(classifiedDrizzle.diagnostic.causeStack).not.toContain(base64Payload);
    for (const line of classifiedDrizzle.diagnostic.causeStack!.split('\n')) {
      expect(line).toMatch(/^\s+at\s+/);
    }

    const credErr = new Error(
      `Failed connecting to postgres://user:pass@host/db with extra context ${'x'.repeat(700)}`,
    );
    credErr.stack = [
      'Error: Failed connecting to postgres://user:pass@host/db',
      '    at connectPool (/app/packages/node/db/src/client.ts:24:11)',
      '    at getSharedDb (/app/packages/node/db/src/client.ts:36:18)',
    ].join('\n');

    const classifiedCred = classifyServerError(credErr, context);
    expect(
      `${classifiedCred.publicError.message} ${classifiedCred.publicError.action}`,
    ).not.toContain('postgres://');
    expect(classifiedCred.diagnostic.causeMessage!.length).toBeLessThanOrEqual(512);
    expect(classifiedCred.diagnostic.causeMessage).not.toContain('postgres://user:pass');
    expect(classifiedCred.diagnostic.causeStack).toBeDefined();
    expect(classifiedCred.diagnostic.causeStack!.length).toBeLessThanOrEqual(2048);
    expect(classifiedCred.diagnostic.causeStack).not.toContain('postgres://user:pass');
    for (const line of classifiedCred.diagnostic.causeStack!.split('\n')) {
      expect(line).toMatch(/^\s+at\s+/);
    }
  });

  it('triggers BOUNDARY_FAULT critical event and substitutes ERR_INTERNAL when a malformed public error leaks SQL or fails schema validation', () => {
    const violations: BoundaryFaultEvent[] = [];
    const onViolation = vi.fn<(fault: BoundaryFaultEvent) => void>(fault => violations.push(fault));

    const sqlLeakCandidate: PublicAppError = {
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Failed query: SELECT * FROM contact_submissions WHERE id = 1',
      action: 'Retry shortly.',
      correlationId: 'corr-boundary-1',
    };

    const guardedSql = enforcePublicErrorBoundary(sqlLeakCandidate, {
      correlationId: 'corr-boundary-1',
      source: 'portal.contact.action',
      onViolation,
    });

    expect(guardedSql.violation).not.toBeNull();
    expect(guardedSql.violation?.seam_type).toBe('BOUNDARY_FAULT');
    expect(guardedSql.violation?.event).toBe('ssr.error.public_redaction_violation');
    expect(guardedSql.violation?.severity).toBe('CRITICAL');
    expect(guardedSql.publicError.code).toBe('ERR_INTERNAL');
    expect(guardedSql.publicError.status).toBe(500);
    expect(guardedSql.publicError.correlationId).toBe('corr-boundary-1');
    expect(guardedSql.publicError.message).not.toContain('SELECT');

    const schemaInvalidCandidate = {
      code: 'ERR_NOT_A_REAL_CODE',
      status: 200,
      message: '',
      action: '',
    };
    const guardedSchema = enforcePublicErrorBoundary(schemaInvalidCandidate, {
      correlationId: 'corr-boundary-2',
      source: 'portal.root.loader',
      onViolation,
    });

    expect(guardedSchema.violation?.seam_type).toBe('BOUNDARY_FAULT');
    expect(guardedSchema.violation?.event).toBe('ssr.error.public_redaction_violation');
    expect(guardedSchema.publicError.code).toBe('ERR_INTERNAL');
    expect(guardedSchema.publicError.status).toBe(500);
    expect(violations).toHaveLength(2);
  });

  it('distinguishes valid StreamResult envelopes, PublicAppError values, and arbitrary payloads', () => {
    const validErr = createPublicAppError({
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'The backing database is temporarily unavailable.',
      action: 'Retry in a few seconds.',
      correlationId: 'corr-123',
    });

    expect(AppErrorCodeSchema.safeParse(validErr.code).success).toBe(true);
    expect(Object.keys(validErr).toSorted()).toEqual([
      'action',
      'code',
      'correlationId',
      'message',
      'status',
    ]);
    expect(isPublicAppError(validErr)).toBe(true);
    expect(isPublicAppError({ code: 'ERR_INTERNAL', status: 500 })).toBe(false);
    expect(isPublicAppError(null)).toBe(false);

    const okEnvelope: StreamResult<{ count: number }> = { ok: true, data: { count: 4 } };
    const errEnvelope: StreamResult<{ count: number }> = { ok: false, error: validErr };

    expect(isStreamResult(okEnvelope)).toBe(true);
    expect(isStreamResult(errEnvelope)).toBe(true);
    expect(isStreamResult({ ok: false, error: { code: 'ERR_INTERNAL' } })).toBe(false);
    expect(isStreamResult({ ok: true })).toBe(false);
    expect(isStreamResult({ random: true })).toBe(false);
    expect(isStreamResult('plain-string')).toBe(false);
  });

  it('preserves ContactActionResult compatibility, exports all route paths, and keeps @aklapper/core free of node:* imports', () => {
    const legacyFail: ContactActionResult = {
      ok: false,
      source: 'server',
      formError: 'Validation failed',
      fieldErrors: { email: ['Invalid email'] },
    };
    const enrichedFail: ContactActionResult = {
      ok: false,
      source: 'database',
      formError: 'The backing database is temporarily unavailable.',
      fieldErrors: {},
      code: 'ERR_DB_UNAVAILABLE',
      action: 'Retry shortly.',
      correlationId: 'corr-contact-503',
    };
    expect(legacyFail.ok).toBe(false);
    expect(enrichedFail.ok).toBe(false);
    expect(enrichedFail.code).toBe('ERR_DB_UNAVAILABLE');

    expect(PORTAL_NAVIGABLE_ROUTE_PATHS).toEqual([
      '/',
      '/menu',
      '/cadence',
      '/ask',
      '/agensi',
      '/contact',
    ]);
    expect(isPortalNavigableRoutePath('/contact')).toBe(true);
    expect(isPortalNavigableRoutePath('/api/contact')).toBe(false);
    expect(isPortalNavigableRoutePath('https://evil.example')).toBe(false);

    expect(PORTAL_ROUTE_PATHS).toEqual([
      '/',
      '/menu',
      '/cadence',
      '/ask',
      '/agensi',
      '/contact',
      '/api/contact',
      '/api/ask/stream',
      '/api/ask/turns/:attemptId',
      '/api/analytics/ingest',
      '/api/cluster/stream',
      '/api/cadence/runs/:runId/stream',
      '/changes-in-progress',
    ]);
    expect(ADMIN_ROUTE_PATHS).toEqual([
      '/',
      '/login',
      '/analytics',
      '/cms',
      '/inbox',
      '/inbox/:id/attachment',
      '/quotas',
      '/ops',
      '/api/analytics/ingest',
      '/api/ops/cluster/stream',
    ]);

    const srcDir = join(import.meta.dirname, '..', 'src');
    const sourceFiles = readdirSync(srcDir).filter(file => file.endsWith('.ts'));
    expect(sourceFiles.length).toBeGreaterThan(0);
    for (const file of sourceFiles) {
      const content = readFileSync(join(srcDir, file), 'utf8');
      expect(content).not.toMatch(/from\s+['"]node:/);
    }
  });
});
