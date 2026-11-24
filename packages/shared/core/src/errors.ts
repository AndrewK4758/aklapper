import { z } from 'zod';

import type { FormFieldErrorMap } from './forms.ts';

export const APP_ERROR_CODES = [
  'ERR_VALIDATION',
  'ERR_CONSTRAINT',
  'ERR_NOT_FOUND',
  'ERR_UNAUTHORIZED',
  'ERR_FORBIDDEN',
  'ERR_RATE_LIMITED',
  'ERR_DB_UNAVAILABLE',
  'ERR_STREAM_TIMEOUT',
  'ERR_STREAM_ABORTED',
  'ERR_UPSTREAM_UNAVAILABLE',
  'ERR_INTERNAL',
] as const;

export const AppErrorCodeSchema = z.enum(APP_ERROR_CODES);
export type AppErrorCode = z.infer<typeof AppErrorCodeSchema>;

export const PublicAppErrorSchema = z
  .object({
    code: AppErrorCodeSchema,
    status: z.number().int().min(400).max(599),
    message: z.string().min(1).max(300),
    action: z.string().min(1).max(300),
    correlationId: z.string().min(1).max(128),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  })
  .strict();

export interface PublicAppError {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly message: string;
  readonly action: string;
  readonly correlationId: string;
  readonly fieldErrors?: FormFieldErrorMap;
}

export interface ActionErrorMetadata {
  readonly code?: AppErrorCode;
  readonly action?: string;
  readonly correlationId?: string;
}

export type StreamResult<TData> =
  | { readonly ok: true; readonly data: TData }
  | { readonly ok: false; readonly error: PublicAppError };

export function createPublicAppError(input: PublicAppError): PublicAppError {
  const candidate: Record<string, unknown> = {
    code: input.code,
    status: input.status,
    message: input.message,
    action: input.action,
    correlationId: input.correlationId,
  };
  if (input.fieldErrors !== undefined) {
    candidate['fieldErrors'] = input.fieldErrors;
  }
  return PublicAppErrorSchema.parse(candidate);
}

export function isPublicAppError(value: unknown): value is PublicAppError {
  return PublicAppErrorSchema.safeParse(value).success;
}

export function isStreamResult<TData = unknown>(value: unknown): value is StreamResult<TData> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (candidate['ok'] === true) {
    return 'data' in candidate;
  }
  if (candidate['ok'] === false) {
    return 'error' in candidate && isPublicAppError(candidate['error']);
  }
  return false;
}
