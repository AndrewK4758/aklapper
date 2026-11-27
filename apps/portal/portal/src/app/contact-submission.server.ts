import {
  CONTACT_FORM_DEFINITION,
  CONTACT_MAX_FILE_BYTES,
  type ContactActionResult,
  type FormFieldErrorMap,
  resolveAllowedMimeType,
  sanitizeFilename,
  validateFormValues,
} from '@aklapper/core';
import { resolveAnalyticsClientIp } from '@aklapper/node-runtime/analytics';
import { classifyGrpcError, submitPortalContact } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';

import { readPassiveGuestSession } from './contact-analytics-link.server';
import { extractClientRequestContext, resolvePortalApiUrl } from './portal-api.server';

const CONTACT_SUBMIT_TIMEOUT_MS = 12_000;

export function resetContactRateLimiterForTest(): void {
  // Rate limiting is enforced atomically in Go portal-api against PostgreSQL rate_limit_buckets.
}

export function resolveClientKey(request: Request): string {
  const headers = request.headers;
  if (!headers || typeof headers.get !== 'function') {
    return '127.0.0.1';
  }
  return resolveAnalyticsClientIp(request);
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

  // Reject automated bots that populate the hidden honeypot field before calling portal-api.
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

  const rawName = String(formData.get('name') ?? '');
  const rawPhone = String(formData.get('phone') ?? '');
  const rawEmail = String(formData.get('email') ?? '');
  const rawMessage = String(formData.get('message') ?? '');
  const rawFileEntry = formData.get('file');
  const uploadedFile =
    rawFileEntry instanceof File && (rawFileEntry.name.length > 0 || rawFileEntry.size > 0)
      ? rawFileEntry
      : null;

  const definitionValidation = validateFormValues(CONTACT_FORM_DEFINITION, {
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

  let attachmentPayload: {
    readonly filename: string;
    readonly mimeType: string;
    readonly content: Uint8Array;
  } | null = null;

  if (uploadedFile) {
    const cleanName = sanitizeFilename(uploadedFile.name);
    const resolvedMime = resolveAllowedMimeType(cleanName, uploadedFile.type);
    const rawBytes = new Uint8Array(await uploadedFile.arrayBuffer());

    const fileErrors: FormFieldErrorMap = {};
    if (!cleanName || cleanName.length > 255) {
      addFieldError(fileErrors, 'file', 'Attachment filename is invalid or exceeds 255 characters');
    }
    if (rawBytes.byteLength <= 0) {
      addFieldError(fileErrors, 'file', 'Attached file cannot be empty');
    }
    if (rawBytes.byteLength > CONTACT_MAX_FILE_BYTES) {
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

    attachmentPayload = {
      filename: cleanName,
      mimeType: resolvedMime,
      content: rawBytes,
    };
  }

  const portalApiUrl = resolvePortalApiUrl();
  if (!portalApiUrl) {
    return {
      status: 503,
      correlationId,
      payload: {
        ok: false,
        source: 'server',
        formError: 'Upstream service unreachable.',
        fieldErrors: {},
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        action: 'Retry shortly or go home.',
        correlationId,
      },
    };
  }

  const rawCandidate = formData.get('analyticsSessionId');
  const candidateAnalyticsSessionId =
    typeof rawCandidate === 'string' && rawCandidate.trim().length > 0 ? rawCandidate.trim() : null;

  try {
    const { clientContext, signedClientIp } = extractClientRequestContext(
      request,
      readPassiveGuestSession(request),
    );
    const submission = await submitPortalContact(
      {
        baseUrl: portalApiUrl,
        internalAuth: { role: 'service', subject: 'portal-contact' },
        signedClientIp,
        correlationId,
        timeoutMs: CONTACT_SUBMIT_TIMEOUT_MS,
        signal: request.signal,
        logger,
      },
      {
        name: rawName,
        phone: rawPhone.trim() || null,
        email: rawEmail,
        message: rawMessage,
        attachment: attachmentPayload,
        candidateAnalyticsSessionId,
        clientContext,
      },
    );

    return {
      status: 201,
      correlationId,
      payload: { ok: true, submission },
    };
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.contact.submit',
      normalizeUnavailableStatus: 503,
      logger,
    });
    const source: 'server' | 'database' =
      failure.publicError.code === 'ERR_CONSTRAINT' ||
      failure.publicError.code === 'ERR_DB_UNAVAILABLE'
        ? 'database'
        : 'server';

    return {
      status: failure.publicError.status,
      correlationId: failure.publicError.correlationId,
      ...(failure.retryAfterSeconds !== undefined
        ? { retryAfterSeconds: failure.retryAfterSeconds }
        : {}),
      payload: {
        ok: false,
        source,
        formError: failure.publicError.message,
        fieldErrors: failure.publicError.fieldErrors ?? {},
        code: failure.publicError.code,
        action: failure.publicError.action,
        correlationId: failure.publicError.correlationId,
      },
    };
  }
}
