import { argon2 as argon2Callback, randomBytes, timingSafeEqual } from 'node:crypto';

export const ARGON2ID_DEFAULTS = Object.freeze({
  memory: 19456,
  passes: 2,
  parallelism: 1,
  saltLength: 16,
  tagLength: 32,
} as const);

export const AUTH_LOG_REDACT_PATHS: readonly string[] = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-internal-auth"]',
  'req.headers["x-bootstrap-token"]',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'passwordHashArgon2',
  'secret',
  'totpKey',
  'apiKey',
  'agensiApiKey',
  '*.password',
  '*.passwordHashArgon2',
  '*.secret',
  '*.totpKey',
  '*.apiKey',
  '*.agensiApiKey',
];

const MIN_MEMORY_KIB = 4096;
const MAX_MEMORY_KIB = 65536;
const MIN_PASSES = 1;
const MAX_PASSES = 16;
const MIN_PARALLELISM = 1;
const MAX_PARALLELISM = 4;
const MIN_SALT_BYTES = 16;
const MAX_SALT_BYTES = 64;
const MIN_HASH_BYTES = 16;
const MAX_HASH_BYTES = 64;
const MAX_PASSWORD_LENGTH = 1024;
const MAX_CONCURRENT_ARGON2 = 2;

const UNPADDED_BASE64_PATTERN = /^[A-Za-z0-9+/]+$/;
const PHC_PARAMS_PATTERN = /^m=(\d+),t=(\d+),p=(\d+)$/;
const DUMMY_SALT = Buffer.alloc(ARGON2ID_DEFAULTS.saltLength, 0x5a);
const DUMMY_PASSWORD = 'aklapper-constant-time-dummy-argon2id-check';

let activeArgon2Derivations = 0;

export class Argon2ConcurrencyError extends Error {
  constructor(message = 'Password verification service is busy; retry shortly') {
    super(message);
    this.name = 'Argon2ConcurrencyError';
  }
}

export interface Argon2HashOptions {
  memory?: number;
  passes?: number;
  parallelism?: number;
}

export interface ParsedArgon2idPhc {
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  hash: Buffer;
}

function decodeStrictUnpaddedBase64(segment: string): Buffer | null {
  if (!segment || !UNPADDED_BASE64_PATTERN.test(segment) || segment.length % 4 === 1) {
    return null;
  }
  const decoded = Buffer.from(segment, 'base64');
  const reencoded = decoded.toString('base64').replace(/=+$/, '');
  if (reencoded !== segment) {
    return null;
  }
  return decoded;
}

function encodeUnpaddedBase64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

function validateBoundedInt(value: number, min: number, max: number, label: string): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Argon2id ${label} must be an integer between ${min} and ${max}`);
  }
  return value;
}

async function deriveArgon2id(parameters: {
  message: string;
  nonce: Buffer;
  memory: number;
  passes: number;
  parallelism: number;
  tagLength: number;
}): Promise<Buffer> {
  if (activeArgon2Derivations >= MAX_CONCURRENT_ARGON2) {
    throw new Argon2ConcurrencyError();
  }
  activeArgon2Derivations += 1;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      argon2Callback('argon2id', parameters, (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      });
    });
  } finally {
    activeArgon2Derivations -= 1;
  }
}

export function parseArgon2idPhc(phc: string): ParsedArgon2idPhc | null {
  if (typeof phc !== 'string' || phc.length === 0 || phc.length > 512) {
    return null;
  }
  const parts = phc.split('$');
  if (parts.length !== 6 || parts[0] !== '' || parts[1] !== 'argon2id' || parts[2] !== 'v=19') {
    return null;
  }

  const paramMatch = PHC_PARAMS_PATTERN.exec(parts[3] ?? '');
  if (!paramMatch) {
    return null;
  }

  const memory = Number(paramMatch[1]);
  const passes = Number(paramMatch[2]);
  const parallelism = Number(paramMatch[3]);
  if (
    !Number.isSafeInteger(memory) ||
    memory < MIN_MEMORY_KIB ||
    memory > MAX_MEMORY_KIB ||
    !Number.isSafeInteger(passes) ||
    passes < MIN_PASSES ||
    passes > MAX_PASSES ||
    !Number.isSafeInteger(parallelism) ||
    parallelism < MIN_PARALLELISM ||
    parallelism > MAX_PARALLELISM
  ) {
    return null;
  }

  const salt = decodeStrictUnpaddedBase64(parts[4] ?? '');
  const hash = decodeStrictUnpaddedBase64(parts[5] ?? '');
  if (
    !salt ||
    !hash ||
    salt.length < MIN_SALT_BYTES ||
    salt.length > MAX_SALT_BYTES ||
    hash.length < MIN_HASH_BYTES ||
    hash.length > MAX_HASH_BYTES
  ) {
    return null;
  }

  return {
    memory,
    passes,
    parallelism,
    salt,
    hash,
  };
}

export async function hashPasswordArgon2id(
  password: string,
  options: Argon2HashOptions = {},
): Promise<string> {
  if (
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    throw new Error(`Password must be between 1 and ${MAX_PASSWORD_LENGTH} characters`);
  }

  const memory = validateBoundedInt(
    options.memory ?? ARGON2ID_DEFAULTS.memory,
    MIN_MEMORY_KIB,
    MAX_MEMORY_KIB,
    'memory',
  );
  const passes = validateBoundedInt(
    options.passes ?? ARGON2ID_DEFAULTS.passes,
    MIN_PASSES,
    MAX_PASSES,
    'passes',
  );
  const parallelism = validateBoundedInt(
    options.parallelism ?? ARGON2ID_DEFAULTS.parallelism,
    MIN_PARALLELISM,
    MAX_PARALLELISM,
    'parallelism',
  );

  const salt = randomBytes(ARGON2ID_DEFAULTS.saltLength);
  const derivedKey = await deriveArgon2id({
    message: password,
    nonce: salt,
    memory,
    passes,
    parallelism,
    tagLength: ARGON2ID_DEFAULTS.tagLength,
  });

  return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${encodeUnpaddedBase64(salt)}$${encodeUnpaddedBase64(derivedKey)}`;
}

export async function verifyPasswordArgon2id(
  password: string,
  encodedPhc: string | null | undefined,
): Promise<boolean> {
  const validPasswordInput =
    typeof password === 'string' && password.length > 0 && password.length <= MAX_PASSWORD_LENGTH;
  const parsed = typeof encodedPhc === 'string' ? parseArgon2idPhc(encodedPhc) : null;

  if (!validPasswordInput || !parsed) {
    await deriveArgon2id({
      message: DUMMY_PASSWORD,
      nonce: DUMMY_SALT,
      memory: ARGON2ID_DEFAULTS.memory,
      passes: ARGON2ID_DEFAULTS.passes,
      parallelism: ARGON2ID_DEFAULTS.parallelism,
      tagLength: ARGON2ID_DEFAULTS.tagLength,
    });
    return false;
  }

  const derived = await deriveArgon2id({
    message: password,
    nonce: parsed.salt,
    memory: parsed.memory,
    passes: parsed.passes,
    parallelism: parsed.parallelism,
    tagLength: parsed.hash.length,
  });

  return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
}
