import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export const ADMIN_SESSION_COOKIE_NAME = 'ak_admin_session';
export const GUEST_SESSION_COOKIE_NAME = 'ak_guest_session';

/**
 * Explicit development-only fallback key used ONLY when NODE_ENV !== 'production' and
 * TOTP_ENCRYPTION_KEY is unset. Production always fails closed.
 */
export const DEV_FALLBACK_TOTP_ENCRYPTION_KEY =
  'aklapper-dev-totp-encryption-key-do-not-use-in-prod';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_CIPHER_VERSION = 'v1';

export interface SessionCookieOptions {
  maxAgeSeconds?: number;
  expiresAt?: Date;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

export function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function isSecureRequest(
  urlOrProtocol: string | URL,
  forwardedProto?: string | null,
): boolean {
  if (forwardedProto) {
    const primary = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (primary === 'https') return true;
    if (primary === 'http') return false;
  }
  if (urlOrProtocol instanceof URL) {
    return urlOrProtocol.protocol === 'https:';
  }
  return urlOrProtocol.trim().toLowerCase().startsWith('https');
}

export function serializeSessionCookie(
  name: string,
  value: string,
  options: SessionCookieOptions = {},
): string {
  const {
    maxAgeSeconds,
    expiresAt,
    path = '/',
    httpOnly = true,
    secure = false,
    sameSite = 'Lax',
  } = options;

  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (typeof maxAgeSeconds === 'number' && Number.isFinite(maxAgeSeconds)) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }
  if (expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())) {
    parts.push(`Expires=${expiresAt.toUTCString()}`);
  }
  return parts.join('; ');
}

export function clearSessionCookie(
  name: string,
  options: Omit<SessionCookieOptions, 'maxAgeSeconds' | 'expiresAt'> = {},
): string {
  return serializeSessionCookie(name, '', {
    ...options,
    maxAgeSeconds: 0,
    expiresAt: new Date(0),
  });
}

export function isSafeRedirectTarget(target: string | null | undefined): boolean {
  if (!target) return false;
  if (!target.startsWith('/')) return false;
  if (target.startsWith('//') || target.startsWith('/\\')) return false;
  // Reject control chars, whitespace injection, or embedded schemes
  for (let i = 0; i < target.length; i += 1) {
    const code = target.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  return true;
}

export function sanitizeRedirectTarget(target: string | null | undefined, fallback = '/'): string {
  return isSafeRedirectTarget(target) ? (target as string) : fallback;
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[\s=-]+/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${ch}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(numBytes = 20): string {
  return encodeBase32(randomBytes(numBytes));
}

export interface TotpOtpAuthUrlOptions {
  secret: string;
  accountName: string;
  issuer?: string;
  digits?: number;
  periodSeconds?: number;
}

export function buildTotpOtpAuthUrl(options: TotpOtpAuthUrlOptions): string {
  const {
    secret,
    accountName,
    issuer = 'andrew-k.us Admin',
    digits = 6,
    periodSeconds = 30,
  } = options;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(periodSeconds),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function computeTotpCode(
  secretBase32: string,
  timestampMs = Date.now(),
  periodSeconds = 30,
  digits = 6,
): string {
  const key = decodeBase32(secretBase32);
  const counter = BigInt(Math.floor(timestampMs / 1000 / periodSeconds));
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(counter, 0);

  const hmac = createHmac('sha1', key).update(counterBuf).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const binaryCode =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);

  const mod = 10 ** digits;
  return String(binaryCode % mod).padStart(digits, '0');
}

export interface VerifyTotpOptions {
  timestampMs?: number;
  window?: number;
  periodSeconds?: number;
  digits?: number;
}

export function verifyTotpCode(
  secretBase32: string,
  code: string,
  options: VerifyTotpOptions = {},
): boolean {
  const { timestampMs = Date.now(), window = 1, periodSeconds = 30, digits = 6 } = options;
  const normalized = code.replace(/[\s-]+/g, '');
  if (!/^\d+$/.test(normalized) || normalized.length !== digits) {
    return false;
  }

  const candidateBuf = Buffer.from(normalized, 'utf8');
  for (let step = -window; step <= window; step += 1) {
    const expected = computeTotpCode(
      secretBase32,
      timestampMs + step * periodSeconds * 1000,
      periodSeconds,
      digits,
    );
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (candidateBuf.length === expectedBuf.length && timingSafeEqual(candidateBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

function resolveTotpEncryptionKey(explicitKey?: string): Buffer {
  const material =
    explicitKey?.trim() ||
    process.env['TOTP_ENCRYPTION_KEY']?.trim() ||
    (process.env['NODE_ENV'] !== 'production' ? DEV_FALLBACK_TOTP_ENCRYPTION_KEY : '');

  if (!material) {
    throw new Error('TOTP_ENCRYPTION_KEY is required when NODE_ENV=production');
  }
  return createHash('sha256').update(material, 'utf8').digest();
}

export function encryptTotpSecret(plaintextSecret: string, keyMaterial?: string): string {
  const key = resolveTotpEncryptionKey(keyMaterial);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextSecret, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    TOTP_CIPHER_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptTotpSecret(ciphertext: string, keyMaterial?: string): string {
  const key = resolveTotpEncryptionKey(keyMaterial);
  const parts = ciphertext.split('.');
  if (parts.length !== 4 || parts[0] !== TOTP_CIPHER_VERSION) {
    throw new Error('Invalid encrypted TOTP secret format');
  }
  const iv = Buffer.from(parts[1] ?? '', 'base64url');
  const authTag = Buffer.from(parts[2] ?? '', 'base64url');
  const encrypted = Buffer.from(parts[3] ?? '', 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function normalizeBackupCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

export function hashBackupCode(code: string): string {
  return createHash('sha256').update(normalizeBackupCode(code), 'utf8').digest('hex');
}

export function verifyBackupCode(
  code: string,
  hashes: readonly string[],
): { matched: boolean; matchedHash: string | null; remainingHashes: string[] } {
  const normalized = normalizeBackupCode(code);
  if (!normalized) {
    return { matched: false, matchedHash: null, remainingHashes: [...hashes] };
  }
  const candidate = Buffer.from(hashBackupCode(normalized), 'utf8');
  let matchedIndex = -1;
  for (let i = 0; i < hashes.length; i += 1) {
    const stored = Buffer.from(hashes[i] ?? '', 'utf8');
    if (stored.length === candidate.length && timingSafeEqual(stored, candidate)) {
      matchedIndex = i;
    }
  }
  if (matchedIndex === -1) {
    return { matched: false, matchedHash: null, remainingHashes: [...hashes] };
  }
  const matchedHash = hashes[matchedIndex] ?? null;
  const remainingHashes = hashes.filter((_item, idx) => idx !== matchedIndex);
  return { matched: true, matchedHash, remainingHashes };
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function buildDailyAnalyticsSalt(
  baseSalt = process.env['ANALYTICS_DAILY_SALT']?.trim() || 'dev-only',
  date = new Date(),
): string {
  return `${baseSalt}:${date.toISOString().slice(0, 10)}`;
}

export function hashVisitorIp(ip: string, dailySalt = buildDailyAnalyticsSalt()): string {
  return createHash('sha256').update(`${dailySalt}:${ip}`).digest('hex').slice(0, 24);
}
