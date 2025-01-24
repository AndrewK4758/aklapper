import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';

export type ParsedPrismaError = {
  errorName: string;
  errorMessage: string;
  errorCause: unknown;
  errorMetadata: Record<string, unknown> | undefined;
};

export default class PrismaErrorLogger implements PrismaClientKnownRequestError {
  readonly message: string;
  readonly code: string;
  readonly name: string;
  readonly clientVersion: string;
  readonly batchRequestIdx?: number | undefined;
  readonly cause?: unknown;
  readonly meta?: Record<string, unknown> | undefined;
  readonly stack?: string | undefined;

  constructor(error: PrismaClientKnownRequestError) {
    this.message = error.message;
    this.code = error.code;
    this.name = error.name;
    this.clientVersion = error.clientVersion;
    this.batchRequestIdx = error.batchRequestIdx;
    this.cause = error.cause;
    this.meta = error.meta;
    this.stack = error.stack;
  }

  get [Symbol.toStringTag](): string {
    return Symbol.toString();
  }

  get errorCode(): string {
    return this.code;
  }

  get errorMessage(): string {
    return this.message;
  }

  get errorName(): string {
    return this.name;
  }

  get errorCause(): unknown {
    return this.cause;
  }

  get errorMetadata(): Record<string, unknown> | undefined {
    return this.meta;
  }

  get errorStack(): string | undefined {
    return this.stack;
  }

  get errorClientVersion(): string {
    return this.clientVersion;
  }

  get errorBatchRequestIdx(): number | undefined {
    return this.batchRequestIdx;
  }

  displayError(): ParsedPrismaError {
    return {
      errorName: this.errorName,
      errorMessage: this.errorMessage,
      errorCause: this.errorCause,
      errorMetadata: this.errorMetadata
    };
  }
}
