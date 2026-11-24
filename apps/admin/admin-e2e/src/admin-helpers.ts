import { createHash, createHmac } from 'node:crypto';

import { createDb, createDbPool, seedAdminUserFromEnv } from '@aklapper/db';
import type { CDPSession, Page } from '@playwright/test';

export const HAS_DATABASE_URL = Boolean(process.env['DATABASE_URL']?.trim());

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PROJECT_IP_OCTET: Readonly<Record<string, number>> = {
  chromium: 10,
  firefox: 20,
  webkit: 30,
  'mobile-chrome': 40,
};

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function generateSixDigitTotp(base32Secret: string): string {
  const normalized = base32Secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let acc = 0;
  let bits = 0;
  const keyBytes: number[] = [];
  for (const ch of normalized) {
    acc = (acc << 5) | RFC4648_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      keyBytes.push((acc >>> bits) & 0xff);
    }
  }
  const step = Math.floor(Date.now() / 30_000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', Buffer.from(keyBytes)).update(msg).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binCode =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  return String(binCode % 1_000_000).padStart(6, '0');
}

export function buildIsolatedTestIp(projectName: string, offset: number): string {
  const base = PROJECT_IP_OCTET[projectName] ?? 50;
  return `198.51.100.${base + offset}`;
}

export async function seedIsolatedAdmin(handle: string, password: string): Promise<void> {
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedAdminUserFromEnv(db, {
      ADMIN_HANDLE: handle,
      ADMIN_PASSWORD: password,
    });
  } finally {
    await pool.end();
  }
}

export async function cleanupIsolatedAuthState(
  handles: string[],
  scopeKeys: string[],
): Promise<void> {
  if (!HAS_DATABASE_URL) return;
  const pool = createDbPool();
  try {
    const allScopeKeys = [...scopeKeys];
    if (handles.length > 0) {
      const userResult = await pool.query<{ id: string }>(
        'SELECT id::text AS id FROM users WHERE handle = ANY($1::text[])',
        [handles],
      );
      for (const row of userResult.rows) {
        allScopeKeys.push(`auth:totp:user:${row.id}`);
      }
      await pool.query('DELETE FROM users WHERE handle = ANY($1::text[])', [handles]);
    }
    if (allScopeKeys.length > 0) {
      await pool.query('DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[])', [
        allScopeKeys,
      ]);
    }
  } finally {
    await pool.end();
  }
}

export async function attachVirtualAuthenticator(page: Page): Promise<{
  cdp: CDPSession;
  authenticatorId: string;
}> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}
