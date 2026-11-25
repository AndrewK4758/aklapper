import { createHash } from 'node:crypto';

import {
  CONTACT_MAX_FILE_BYTES,
  type ContactActionResult,
  type ContactAttachment,
  ContactFormSubmissionSchema,
  type FormFieldErrorMap,
  resolveAllowedMimeType,
  sanitizeFilename,
  validateFormValues,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  ContactDbConstraintError,
  consumeRateLimit,
  getSharedDb,
  insertContactSubmission,
  loadPortalContactData,
} from '@aklapper/db';
import { extractRightmostForwardedIp } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  logDiagnosticError,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

export function resetContactRateLimiterForTest(): void {
  // Rate limiting is persisted in PostgreSQL rate_limit_buckets; retained as a no-op for test compatibility.
}

export function resolveClientKey(request: Request): string {
  const headers = request.headers;
  if (!headers || typeof headers.get !== 'function') {
    return 'local-client';
  }
  const forwardedIp = extractRightmostForwardedIp(headers.get('x-forwarded-for'));
  if (forwardedIp) {
    return forwardedIp;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'local-client';
}

function buildContactRateLimitScopeKey(clientKey: string): string {
  const digest = createHash('sha256').update(clientKey).digest('hex').slice(0, 32);
  return `contact:ip:${digest}`;
}

function addFieldError(map: FormFieldErrorMap, field: string, message: string): void {
  const existing = map[field];
  if (existing) {
    if (!existing.includes(message)) {
      existing.push(message);
    }
  } else {
    map[field] = [message];
  }
}

function emitOutcomeAuditGap(correlationId: string, reason: string, detail?: unknown): void {
  const record = {
    severity: 'CRITICAL',
    seam_type: 'DELTA_AUDIT_GAP',
    event: 'portal.contact.submission_outcome_mismatch',
    correlationId,
    reason,
    ...(detail !== undefined
      ? { detail: detail instanceof Error ? detail.message : String(detail) }
      : {}),
  };
  try {
    process.stderr.write(`${JSON.stringify(record)}\n`);
  } catch {
    // Stderr unavailable
  }
}

function buildClassifiedContactFailure(
  error: unknown,
  correlationId: string,
  source: string,
  logger: SsrStructuredLogger,
): ContactSubmissionHttpResult {
  const { publicError, diagnostic } = classifyServerError(error, {
    correlationId,
    source,
  });
  try {
    logDiagnosticError(logger, diagnostic);
  } catch (logError) {
    emitOutcomeAuditGap(correlationId, 'Diagnostic logger threw during contact failure', logError);
  }

  return {
    status: publicError.status,
    correlationId: publicError.correlationId,
    payload: {
      ok: false,
      source: publicError.code === 'ERR_DB_UNAVAILABLE' ? 'database' : 'server',
      formError: publicError.message,
      fieldErrors: {},
      code: publicError.code,
      action: publicError.action,
      correlationId: publicError.correlationId,
    },
  };
}

export interface ContactSubmissionContext {
  readonly correlationId?: string;
  readonly logger?: SsrStructuredLogger;
}

export interface ContactSubmissionHttpResult {
  readonly payload: ContactActionResult;
  readonly status: number;
  readonly correlationId: string;
  readonly retryAfterSeconds?: number;
}

export async function processContactSubmission(
  request: Request,
  context: ContactSubmissionContext = {},
): Promise<ContactSubmissionHttpResult> {
  const correlationId = context.correlationId ?? getOrCreateCorrelationId(request);
  const logger = context.logger ?? createFallbackLogger('portal-contact');

  let db: ReturnType<typeof getSharedDb>;
  try {
    db = getSharedDb();
    const clientKey = resolveClientKey(request);
    const rateLimit = await consumeRateLimit(db, buildContactRateLimitScopeKey(clientKey), {
      maxAttempts: RATE_LIMIT_MAX_REQUESTS,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rateLimit.allowed) {
      return {
        status: 429,
        correlationId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        payload: {
          ok: false,
          source: 'server',
          formError:
            'Too many contact submissions from this address. Please wait a minute and retry.',
          fieldErrors: {},
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
        },
      };
    }
  } catch (error) {
    return buildClassifiedContactFailure(error, correlationId, 'portal.contact.rate_limit', logger);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return {
      status: 400,
      correlationId,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Malformed form submission payload. Expected multipart/form-data.',
        fieldErrors: {},
        code: 'ERR_VALIDATION',
        action: 'Review highlighted fields and retry.',
        correlationId,
      },
    };
  }

  // Reject automated bots that populate the hidden honeypot field.
  const honeypotValue = String(formData.get('website') ?? '').trim();
  if (honeypotValue.length > 0) {
    return {
      status: 400,
      correlationId,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Submission rejected by automated spam filter.',
        fieldErrors: {},
        code: 'ERR_VALIDATION',
        action: 'Review highlighted fields and retry.',
        correlationId,
      },
    };
  }

  let content: Awaited<ReturnType<typeof loadPortalContactData>>['content'];
  try {
    ({ content } = await loadPortalContactData(db));
  } catch (error) {
    return buildClassifiedContactFailure(error, correlationId, 'portal.contact.load', logger);
  }

  const rawName = String(formData.get('name') ?? '');
  const rawPhone = String(formData.get('phone') ?? '');
  const rawEmail = String(formData.get('email') ?? '');
  const rawMessage = String(formData.get('message') ?? '');
  const rawFileEntry = formData.get('file');
  const uploadedFile =
    rawFileEntry instanceof File && (rawFileEntry.name.length > 0 || rawFileEntry.size > 0)
      ? rawFileEntry
      : null;

  const definitionValidation = validateFormValues(content.form, {
    name: rawName,
    phone: rawPhone,
    email: rawEmail,
    message: rawMessage,
    file: uploadedFile
      ? {
          name: uploadedFile.name,
          size: uploadedFile.size,
          type: uploadedFile.type,
        }
      : null,
  });

  if (!definitionValidation.valid) {
    return {
      status: 400,
      correlationId,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Server validation rejected the transmission. Fix the highlighted fields.',
        fieldErrors: definitionValidation.fieldErrors,
        code: 'ERR_VALIDATION',
        action: 'Review highlighted fields and retry.',
        correlationId,
      },
    };
  }

  let attachment: ContactAttachment | null = null;
  if (uploadedFile) {
    const cleanName = sanitizeFilename(uploadedFile.name);
    const resolvedMime = resolveAllowedMimeType(cleanName, uploadedFile.type);
    const bytes = Buffer.from(await uploadedFile.arrayBuffer());

    const fileErrors: FormFieldErrorMap = {};
    if (!cleanName || cleanName.length > 255) {
      addFieldError(fileErrors, 'file', 'Attachment filename is invalid or exceeds 255 characters');
    }
    if (bytes.byteLength <= 0) {
      addFieldError(fileErrors, 'file', 'Attached file cannot be empty');
    }
    if (bytes.byteLength > CONTACT_MAX_FILE_BYTES) {
      addFieldError(fileErrors, 'file', 'Attachment exceeds the 5 MiB limit');
    }
    if (!resolvedMime) {
      addFieldError(fileErrors, 'file', 'Unsupported attachment file type');
    }

    if (Object.keys(fileErrors).length > 0 || !resolvedMime) {
      return {
        status: 400,
        correlationId,
        payload: {
          ok: false,
          source: 'server',
          formError: 'Server attachment validation failed.',
          fieldErrors: fileErrors,
          code: 'ERR_VALIDATION',
          action: 'Review highlighted fields and retry.',
          correlationId,
        },
      };
    }

    attachment = {
      filename: cleanName,
      mimeType: resolvedMime,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contentBase64: bytes.toString('base64'),
    };
  }

  const parsed = ContactFormSubmissionSchema.safeParse({
    name: rawName,
    phone: rawPhone,
    email: rawEmail,
    message: rawMessage,
    attachment,
  });

  if (!parsed.success) {
    const fieldErrors: FormFieldErrorMap = {};
    for (const issue of parsed.error.issues) {
      const rootKey = String(issue.path[0] ?? 'form');
      const targetField = rootKey === 'attachment' ? 'file' : rootKey;
      addFieldError(fieldErrors, targetField, issue.message);
    }
    return {
      status: 400,
      correlationId,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Server schema validation failed. Review the fields below.',
        fieldErrors,
        code: 'ERR_VALIDATION',
        action: 'Review highlighted fields and retry.',
        correlationId,
      },
    };
  }

  try {
    const submission = await insertContactSubmission(db, parsed.data);
    if (!submission?.id) {
      emitOutcomeAuditGap(correlationId, 'insertContactSubmission resolved without submission.id');
      return buildClassifiedContactFailure(
        new Error('Contact submission receipt missing identifier'),
        correlationId,
        'portal.contact.insert',
        logger,
      );
    }

    return {
      status: 201,
      correlationId,
      payload: { ok: true, submission },
    };
  } catch (error) {
    if (error instanceof ContactDbConstraintError) {
      return {
        status: 422,
        correlationId,
        payload: {
          ok: false,
          source: 'database',
          formError: error.message,
          fieldErrors: error.fieldErrors,
          code: 'ERR_CONSTRAINT',
          action: 'Check highlighted fields and retry.',
          correlationId,
        },
      };
    }
    return buildClassifiedContactFailure(error, correlationId, 'portal.contact.insert', logger);
  }
}
