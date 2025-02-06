import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError
} from '@prisma/client/runtime/library.js';

export type PrismaClientErrors =
  | PrismaClientKnownRequestError
  | PrismaClientUnknownRequestError
  | PrismaClientInitializationError
  | PrismaClientValidationError;

export type ParsedPrismaError = {
  header: string;
  errorCode: string | null | undefined;
  errorMessage: string | null | undefined;
  errorName: string;
  prismaVersion: string;
  retryable: boolean | null | undefined;
  rawError: PrismaClientErrors;
};

export class PrismaErrorLogger {
  #error: PrismaClientErrors;
  #parsedError: {
    header: string;
    errorName: string;
    errorCode: string | null | undefined;
    errorMessage: string | null | undefined;
    prismaVersion: string;
    retryable: boolean | null | undefined;
    rawError: PrismaClientErrors;
  };
  constructor(error: PrismaClientErrors) {
    this.#error = error;
    this.#parsedError = {
      header:
        'The definition and code can be referenced https://www.prisma.io/docs/orm/reference/error-reference#prisma-pulse',
      errorCode: undefined,
      errorMessage: undefined,
      errorName: `The Error Name to reference is: ${error.name}`,
      prismaVersion: `Prisma Client Version: ${error.clientVersion}`,
      retryable: undefined,
      rawError: error
    };
  }

  parseErrors(): ParsedPrismaError {
    let errorMetadata;
    switch (true) {
      case this.#error instanceof PrismaClientKnownRequestError: {
        if (this.#error.meta instanceof Object) errorMetadata = Object.values(this.#error.meta);
        this.#parsedError.errorCode = `The Prisma Error Code to reference is: ${this.#error.code}\n`;
        this.#parsedError.errorMessage = `The Error Message is ${this.#error.message} | The affected section is ${errorMetadata} | The provided reason for the error ${this.#error.cause}`;
        this.#parsedError.retryable = null;
        return this.#parsedError;
      }

      case this.#error instanceof PrismaClientUnknownRequestError: {
        this.#parsedError.errorCode = null;
        this.#parsedError.errorMessage = null;
        return this.#parsedError;
      }

      case this.#error instanceof PrismaClientInitializationError: {
        this.#parsedError.errorMessage = `The Error Message is: ${this.#error.message}`;
        this.#parsedError.errorCode = `The Prisma Error Code to reference is: ${this.#error.cause}`;
        this.#parsedError.retryable = this.#error.retryable;
        return this.#parsedError;
      }

      case this.#error instanceof PrismaClientValidationError: {
        this.#parsedError.errorCode = null;
        this.#parsedError.errorMessage = null;
        this.#parsedError.retryable = null;
        return this.#parsedError;
      }
      default:
        return this.#parsedError;
    }
  }
}
