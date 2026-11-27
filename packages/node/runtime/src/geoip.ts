import { existsSync } from 'node:fs';
import { isIP } from 'node:net';
import { join, resolve } from 'node:path';

import { open, type AsnResponse, type CityResponse, type Reader } from 'maxmind';

import type { SsrStructuredLogger } from './request-context.ts';

export interface GeoIpEnrichment {
  readonly country: string | null;
  readonly region: string | null;
  readonly city: string | null;
  readonly timezone: string | null;
  readonly asn: number | null;
  readonly asnOrg: string | null;
}

export type GeoIpLookupBranch =
  | 'mmdb_hit'
  | 'mmdb_private_or_unmapped'
  | 'mmdb_absent_fallback'
  | 'mmdb_corrupt_degraded';

export interface LookupGeoIpOptions {
  readonly dbDir?: string;
  readonly logger?: SsrStructuredLogger;
}

const MMDB_CACHE_MAX_ENTRIES = 2_048;
const CITY_DB_FILENAME = 'GeoLite2-City.mmdb';
const ASN_DB_FILENAME = 'GeoLite2-ASN.mmdb';

const EMPTY_GEO: GeoIpEnrichment = {
  country: null,
  region: null,
  city: null,
  timezone: null,
  asn: null,
  asnOrg: null,
};

type ReaderSlot<T extends CityResponse | AsnResponse> =
  | { readonly state: 'ready'; readonly reader: Reader<T> }
  | { readonly state: 'absent' }
  | { readonly state: 'corrupt' };

interface DirReaderPair {
  cityPromise: Promise<ReaderSlot<CityResponse>> | null;
  asnPromise: Promise<ReaderSlot<AsnResponse>> | null;
}

const readersByDir = new Map<string, DirReaderPair>();

export function resetGeoIpReadersForTest(): void {
  readersByDir.clear();
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a >= 224) return true;
  return false;
}

export function isPrivateOrNonRoutableIp(ip: string): boolean {
  const normalized = ip.trim();
  const family = isIP(normalized);
  if (family === 0) return true;
  if (family === 4) return isPrivateIpv4(normalized);

  const lower = normalized.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  ) {
    return true;
  }
  if (lower.startsWith('ff')) return true;
  return false;
}

function resolveDbDir(explicitDir?: string): string {
  const raw = explicitDir?.trim() || process.env['GEOLITE2_DB_DIR']?.trim() || 'data/geolite2';
  return resolve(process.cwd(), raw);
}

async function openReaderSlot<T extends CityResponse | AsnResponse>(
  filePath: string,
  database: 'city' | 'asn',
  logger?: SsrStructuredLogger,
): Promise<ReaderSlot<T>> {
  if (!existsSync(filePath)) {
    return { state: 'absent' };
  }
  try {
    const reader = await open<T>(filePath, {
      watchForUpdates: false,
      cache: { max: MMDB_CACHE_MAX_ENTRIES },
    });
    return { state: 'ready', reader };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'mmdb_open_failed';
    const payload = {
      seam_type: 'BOUNDARY_FAULT',
      event: 'analytics.geoip.mmdb_load_failed',
      database,
      detail,
    };
    if (logger) {
      logger.warn(payload, 'Failed to open GeoLite2 MMDB; degrading to null geo/ASN');
    } else {
      console.warn(JSON.stringify(payload));
    }
    return { state: 'corrupt' };
  }
}

function getOrLoadDirPair(dbDir: string, logger?: SsrStructuredLogger): DirReaderPair {
  let pair = readersByDir.get(dbDir);
  if (!pair) {
    pair = { cityPromise: null, asnPromise: null };
    readersByDir.set(dbDir, pair);
  }
  if (!pair.cityPromise) {
    pair.cityPromise = openReaderSlot<CityResponse>(join(dbDir, CITY_DB_FILENAME), 'city', logger);
  }
  if (!pair.asnPromise) {
    pair.asnPromise = openReaderSlot<AsnResponse>(join(dbDir, ASN_DB_FILENAME), 'asn', logger);
  }
  return pair;
}

function emitLookupBranch(branch: GeoIpLookupBranch, logger?: SsrStructuredLogger): void {
  if (!logger) return;
  logger.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'analytics.geoip.lookup_branch',
      branch,
    },
    'GeoIP lookup branch evaluated',
  );
}

export async function lookupGeoIpEnrichment(
  ip: string,
  options: LookupGeoIpOptions = {},
): Promise<GeoIpEnrichment> {
  if (isPrivateOrNonRoutableIp(ip)) {
    emitLookupBranch('mmdb_private_or_unmapped', options.logger);
    return EMPTY_GEO;
  }

  const dbDir = resolveDbDir(options.dbDir);
  const pair = getOrLoadDirPair(dbDir, options.logger);
  const [citySlot, asnSlot] = await Promise.all([
    pair.cityPromise ?? Promise.resolve<ReaderSlot<CityResponse>>({ state: 'absent' }),
    pair.asnPromise ?? Promise.resolve<ReaderSlot<AsnResponse>>({ state: 'absent' }),
  ]);

  if (citySlot.state === 'corrupt' || asnSlot.state === 'corrupt') {
    emitLookupBranch('mmdb_corrupt_degraded', options.logger);
  } else if (citySlot.state === 'absent' && asnSlot.state === 'absent') {
    emitLookupBranch('mmdb_absent_fallback', options.logger);
    return EMPTY_GEO;
  }

  let country: string | null = null;
  let region: string | null = null;
  let city: string | null = null;
  let timezone: string | null = null;
  let asn: number | null = null;
  let asnOrg: string | null = null;

  try {
    if (citySlot.state === 'ready') {
      const cityResult = citySlot.reader.get(ip);
      country =
        cityResult?.country?.iso_code?.trim() ||
        cityResult?.registered_country?.iso_code?.trim() ||
        null;
      region =
        cityResult?.subdivisions?.[0]?.iso_code?.trim() ||
        cityResult?.subdivisions?.[0]?.names?.en?.trim() ||
        null;
      city = cityResult?.city?.names?.en?.trim() || null;
      timezone = cityResult?.location?.time_zone?.trim() || null;
    }
    if (asnSlot.state === 'ready') {
      const asnResult = asnSlot.reader.get(ip);
      asn =
        typeof asnResult?.autonomous_system_number === 'number' &&
        Number.isFinite(asnResult.autonomous_system_number)
          ? asnResult.autonomous_system_number
          : null;
      asnOrg = asnResult?.autonomous_system_organization?.trim() || null;
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'mmdb_lookup_failed';
    const payload = {
      seam_type: 'BOUNDARY_FAULT',
      event: 'analytics.geoip.mmdb_load_failed',
      database: 'lookup',
      detail,
    };
    if (options.logger) {
      options.logger.warn(payload, 'GeoLite2 lookup error; degrading to null geo/ASN');
    } else {
      console.warn(JSON.stringify(payload));
    }
    return EMPTY_GEO;
  }

  const hasMatch = Boolean(country || region || city || timezone || asn !== null || asnOrg);
  if (citySlot.state !== 'corrupt' && asnSlot.state !== 'corrupt') {
    emitLookupBranch(hasMatch ? 'mmdb_hit' : 'mmdb_private_or_unmapped', options.logger);
  }

  return { country, region, city, timezone, asn, asnOrg };
}
