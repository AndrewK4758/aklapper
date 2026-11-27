import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  classifyBotUserAgent,
  extractCampaignParams,
  hashVisitorIdentity,
  lookupGeoIpEnrichment,
  normalizeReferrer,
  parseUserAgentProfile,
  resetGeoIpReadersForTest,
  sanitizeCampaignValue,
} from '../src/analytics.ts';
import type { SsrStructuredLogger } from '../src/request-context.ts';

function encodeMmdbSize(typeNum: number, size: number): Buffer {
  if (size < 29) {
    return Buffer.from([(typeNum << 5) | size]);
  }
  if (size < 285) {
    return Buffer.from([(typeNum << 5) | 29, size - 29]);
  }
  throw new Error('Test MMDB encoder supports sizes < 285');
}

function encodeMmdbUtf8(value: string): Buffer {
  const bytes = Buffer.from(value, 'utf8');
  return Buffer.concat([encodeMmdbSize(2, bytes.length), bytes]);
}

function encodeMmdbUint(typeNum: number, value: number): Buffer {
  if (value === 0) {
    return Buffer.from([(typeNum << 5) | 0]);
  }
  const bytes: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining = Math.floor(remaining / 256);
  }
  return Buffer.concat([Buffer.from([(typeNum << 5) | bytes.length]), Buffer.from(bytes)]);
}

function encodeMmdbMap(entries: readonly (readonly [string, Buffer])[]): Buffer {
  const chunks: Buffer[] = [encodeMmdbSize(7, entries.length)];
  for (const [key, val] of entries) {
    chunks.push(encodeMmdbUtf8(key), val);
  }
  return Buffer.concat(chunks);
}

function encodeMmdbArray(items: readonly Buffer[]): Buffer {
  const extendedType = 11 - 7; // extended type 4 for array
  const chunks: Buffer[] = [Buffer.from([items.length, extendedType])];
  for (const item of items) {
    chunks.push(item);
  }
  return Buffer.concat(chunks);
}

function buildMinimalMmdb(databaseType: string, payloadMap: Buffer): Buffer {
  // 1-node IPv4 search tree (24-bit records => 6 bytes). Both branches point to data offset 0:
  // pointer value = node_count (1) + 16 (separator) + 0 = 17 (0x000011).
  const searchTree = Buffer.from([0x00, 0x00, 0x11, 0x00, 0x00, 0x11]);
  const separator = Buffer.alloc(16, 0);
  const marker = Buffer.concat([
    Buffer.from([0xab, 0xcd, 0xef]),
    Buffer.from('MaxMind.com', 'ascii'),
  ]);
  const metadata = encodeMmdbMap([
    ['binary_format_major_version', encodeMmdbUint(5, 2)],
    ['binary_format_minor_version', encodeMmdbUint(5, 0)],
    ['build_epoch', encodeMmdbUint(5, 1_700_000_000)],
    ['database_type', encodeMmdbUtf8(databaseType)],
    ['ip_version', encodeMmdbUint(5, 4)],
    ['node_count', encodeMmdbUint(6, 1)],
    ['record_size', encodeMmdbUint(5, 24)],
  ]);
  return Buffer.concat([searchTree, separator, payloadMap, marker, metadata]);
}

function createFixtureMmdbDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aklapper-mmdb-test-'));

  const cityRecord = encodeMmdbMap([
    ['country', encodeMmdbMap([['iso_code', encodeMmdbUtf8('US')]])],
    [
      'subdivisions',
      encodeMmdbArray([
        encodeMmdbMap([
          ['iso_code', encodeMmdbUtf8('GA')],
          ['names', encodeMmdbMap([['en', encodeMmdbUtf8('Georgia')]])],
        ]),
      ]),
    ],
    ['city', encodeMmdbMap([['names', encodeMmdbMap([['en', encodeMmdbUtf8('Atlanta')]])]])],
    ['location', encodeMmdbMap([['time_zone', encodeMmdbUtf8('America/New_York')]])],
  ]);

  const asnRecord = encodeMmdbMap([
    ['autonomous_system_number', encodeMmdbUint(6, 64512)],
    ['autonomous_system_organization', encodeMmdbUtf8('Acme Recruiting Fiber')],
  ]);

  writeFileSync(join(dir, 'GeoLite2-City.mmdb'), buildMinimalMmdb('GeoLite2-City', cityRecord));
  writeFileSync(join(dir, 'GeoLite2-ASN.mmdb'), buildMinimalMmdb('GeoLite2-ASN', asnRecord));
  return dir;
}

describe('@aklapper/node-runtime/analytics', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    resetGeoIpReadersForTest();
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        rmSync(dir, { recursive: true, force: true });
      }
    }
    vi.restoreAllMocks();
  });

  it('resolves City and ASN metadata from real MaxMind MMDB fixtures without logging raw IPs', async () => {
    const dir = createFixtureMmdbDir();
    tempDirs.push(dir);
    const logs: Record<string, unknown>[] = [];
    const logger: SsrStructuredLogger = {
      info: obj => logs.push(obj),
      warn: obj => logs.push(obj),
      error: obj => logs.push(obj),
    };

    const result = await lookupGeoIpEnrichment('198.51.100.42', { dbDir: dir, logger });
    expect(result).toEqual({
      country: 'US',
      region: 'GA',
      city: 'Atlanta',
      timezone: 'America/New_York',
      asn: 64512,
      asnOrg: 'Acme Recruiting Fiber',
    });
    expect(JSON.stringify(logs)).not.toContain('198.51.100.42');
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seam_type: 'RULE_DIVERGENCE',
          event: 'analytics.geoip.lookup_branch',
          branch: 'mmdb_hit',
        }),
      ]),
    );
  });

  it('degrades cleanly to null geo/ASN when MMDB files are absent, corrupt, or IP is private/loopback', async () => {
    const emptyDir = mkdtempSync(join(tmpdir(), 'aklapper-mmdb-empty-'));
    const corruptDir = mkdtempSync(join(tmpdir(), 'aklapper-mmdb-corrupt-'));
    tempDirs.push(emptyDir, corruptDir);
    writeFileSync(join(corruptDir, 'GeoLite2-City.mmdb'), Buffer.from('not-a-valid-mmdb'));

    const warnLogs: Record<string, unknown>[] = [];
    const infoLogs: Record<string, unknown>[] = [];
    const logger: SsrStructuredLogger = {
      info: obj => infoLogs.push(obj),
      warn: obj => warnLogs.push(obj),
      error: obj => warnLogs.push(obj),
    };

    const absent = await lookupGeoIpEnrichment('198.51.100.42', { dbDir: emptyDir, logger });
    expect(absent).toEqual({
      country: null,
      region: null,
      city: null,
      timezone: null,
      asn: null,
      asnOrg: null,
    });

    const loopback = await lookupGeoIpEnrichment('127.0.0.1', { dbDir: emptyDir, logger });
    expect(loopback.country).toBeNull();
    expect(loopback.asn).toBeNull();

    const corrupt = await lookupGeoIpEnrichment('198.51.100.42', { dbDir: corruptDir, logger });
    expect(corrupt).toEqual({
      country: null,
      region: null,
      city: null,
      timezone: null,
      asn: null,
      asnOrg: null,
    });
    expect(warnLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          seam_type: 'BOUNDARY_FAULT',
          event: 'analytics.geoip.mmdb_load_failed',
        }),
      ]),
    );
    expect(JSON.stringify([...warnLogs, ...infoLogs])).not.toContain('198.51.100.42');
    expect(JSON.stringify([...warnLogs, ...infoLogs])).not.toContain('127.0.0.1');
  });

  it('classifies automated crawlers and empty User-Agents as bots while keeping human browsers and Private Relay human', () => {
    expect(classifyBotUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)')).toEqual({
      isBot: true,
      branch: 'bot_isbot',
    });
    expect(classifyBotUserAgent('Mozilla/5.0 HeadlessChrome/128.0.0.0 Safari/537.36')).toEqual({
      isBot: true,
      branch: 'bot_headless_or_missing_ua',
    });
    expect(classifyBotUserAgent('curl/8.7.1')).toEqual({
      isBot: true,
      branch: 'bot_headless_or_missing_ua',
    });
    expect(classifyBotUserAgent('')).toEqual({
      isBot: true,
      branch: 'bot_headless_or_missing_ua',
    });
    expect(classifyBotUserAgent(null)).toEqual({
      isBot: true,
      branch: 'bot_headless_or_missing_ua',
    });

    const safariUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15';
    expect(classifyBotUserAgent(safariUa)).toEqual({
      isBot: false,
      branch: 'human',
    });
    expect(parseUserAgentProfile(safariUa)).toEqual({
      deviceType: 'desktop',
      osName: 'macOS',
      browserName: 'Safari',
    });

    const iphoneChrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgentProfile(iphoneChrome)).toEqual({
      deviceType: 'mobile',
      osName: 'iOS',
      browserName: 'Chrome',
    });
    expect(parseUserAgentProfile('curl/8.7.1')).toEqual({
      deviceType: 'bot',
      osName: null,
      browserName: null,
    });
  });

  it('normalizes external referrers, strips userinfo/query/hash and self-referrals, and bounds allow-listed campaign params', () => {
    expect(
      normalizeReferrer('https://user:secret@www.linkedin.com/feed/update/123?token=abc#frag', [
        'andrew-k.us',
      ]),
    ).toEqual({
      referrer: 'https://www.linkedin.com/feed/update/123',
      referrerHost: 'linkedin.com',
      referrerCategory: 'social',
    });

    expect(normalizeReferrer('https://news.ycombinator.com/item?id=42', ['andrew-k.us'])).toEqual({
      referrer: 'https://news.ycombinator.com/item',
      referrerHost: 'news.ycombinator.com',
      referrerCategory: 'developer',
    });

    expect(normalizeReferrer('https://www.andrew-k.us/about', ['andrew-k.us'])).toEqual({
      referrer: null,
      referrerHost: null,
      referrerCategory: 'direct',
    });
    expect(
      normalizeReferrer('https://preview.example.run.app/', ['preview.example.run.app']),
    ).toEqual({
      referrer: null,
      referrerHost: null,
      referrerCategory: 'direct',
    });
    expect(normalizeReferrer('javascript:alert(1)', ['andrew-k.us'])).toEqual({
      referrer: null,
      referrerHost: null,
      referrerCategory: 'direct',
    });

    const campaign = extractCampaignParams(
      'https://andrew-k.us/about?ref=recruiter&utm_source=linkedin&utm_medium=social&utm_campaign=fall26&utm_content=bio&secret=dropme',
    );
    expect(campaign).toEqual({
      landingPath: '/about',
      refParam: 'recruiter',
      utmSource: 'linkedin',
      utmMedium: 'social',
      utmCampaign: 'fall26',
      utmContent: 'bio',
    });

    const sanitizedLong = sanitizeCampaignValue(`  abc\u0000\u001f${'z'.repeat(200)}  `);
    expect(sanitizedLong).toHaveLength(120);
    expect(sanitizedLong?.startsWith('abcz')).toBe(true);

    // Oversized (>253-char DNS limit) referrer hostname falls back safely to direct
    const hugeHost = `${'sub.'.repeat(70)}example.com`;
    expect(hugeHost.length).toBeGreaterThan(253);
    expect(normalizeReferrer(`https://${hugeHost}/landing`, ['andrew-k.us'])).toEqual({
      referrer: null,
      referrerHost: null,
      referrerCategory: 'direct',
    });

    // Trailing slashes strip consistently while preserving root '/'
    expect(extractCampaignParams('https://andrew-k.us/about/?ref=recruiter').landingPath).toBe(
      '/about',
    );
    expect(extractCampaignParams('https://andrew-k.us///').landingPath).toBe('/');
  });

  it('computes stable 32-hex daily-salted visitor_hash values sensitive to IP, UA, and daily salt', () => {
    const h1 = hashVisitorIdentity('198.51.100.42', 'Mozilla/5.0 Chrome/130', 'salt:2026-11-27');
    const h2 = hashVisitorIdentity('198.51.100.42', 'Mozilla/5.0 Chrome/130', 'salt:2026-11-27');
    const hDiffUa = hashVisitorIdentity(
      '198.51.100.42',
      'Mozilla/5.0 Firefox/131',
      'salt:2026-11-27',
    );
    const hDiffDay = hashVisitorIdentity(
      '198.51.100.42',
      'Mozilla/5.0 Chrome/130',
      'salt:2026-11-28',
    );

    expect(h1).toMatch(/^[a-f0-9]{32}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(hDiffUa);
    expect(h1).not.toBe(hDiffDay);
  });
});
