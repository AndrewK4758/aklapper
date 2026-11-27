import type { DeviceType, ReferrerCategory } from '@aklapper/core';
import { isbot } from 'isbot';

export {
  buildDailyAnalyticsSalt,
  buildPreviousUtcDayAnalyticsSalt,
  hashVisitorIdentity,
  hashVisitorIp,
  isWithinUtcMidnightGraceWindow,
} from './auth.ts';

export type BotClassificationBranch = 'human' | 'bot_isbot' | 'bot_headless_or_missing_ua';

export interface BotClassificationResult {
  readonly isBot: boolean;
  readonly branch: BotClassificationBranch;
}

export interface UserAgentProfile {
  readonly deviceType: DeviceType;
  readonly osName: string | null;
  readonly browserName: string | null;
}

export interface NormalizedReferrer {
  readonly referrer: string | null;
  readonly referrerHost: string | null;
  readonly referrerCategory: ReferrerCategory;
}

export interface CampaignParams {
  readonly landingPath: string;
  readonly refParam: string | null;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
}

const HEADLESS_OR_SCRAPER_RE =
  /headlesschrome|playwright|puppeteer|phantomjs|curl\/|wget\/|python-requests|go-http-client|scrapy|httpx\/|libwww-perl|axios\/|node-fetch|undici/i;

const CAMPAIGN_VALUE_MAX_LEN = 120;
const PATH_MAX_LEN = 512;
const REFERRER_MAX_LEN = 512;

const SEARCH_HOSTS = new Set([
  'bing.com',
  'duckduckgo.com',
  'search.yahoo.com',
  'yahoo.com',
  'ecosia.org',
  'kagi.com',
  'search.brave.com',
  'baidu.com',
  'perplexity.ai',
  'chatgpt.com',
]);

const SOCIAL_HOSTS = new Set([
  'linkedin.com',
  'lnkd.in',
  'x.com',
  'twitter.com',
  't.co',
  'bsky.app',
  'mastodon.social',
  'threads.net',
  'reddit.com',
  'old.reddit.com',
  'facebook.com',
  'm.facebook.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
]);

const DEVELOPER_HOSTS = new Set([
  'github.com',
  'gist.github.com',
  'gitlab.com',
  'news.ycombinator.com',
  'lobste.rs',
  'dev.to',
  'stackoverflow.com',
  'npmjs.com',
  'agensi.dev',
  'agensi.ai',
  'hashnode.com',
  'medium.com',
]);

export function classifyBotUserAgent(
  userAgent: string | null | undefined,
): BotClassificationResult {
  const trimmed = userAgent?.trim() ?? '';
  if (!trimmed || HEADLESS_OR_SCRAPER_RE.test(trimmed)) {
    return { isBot: true, branch: 'bot_headless_or_missing_ua' };
  }
  if (isbot(trimmed)) {
    return { isBot: true, branch: 'bot_isbot' };
  }
  return { isBot: false, branch: 'human' };
}

function detectOsName(ua: string): string | null {
  if (/iphone|ipad|ipod|cpu os|cpu iphone os/i.test(ua)) return 'iOS';
  if (/android/i.test(ua)) return 'Android';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/windows nt|win64|wow64/i.test(ua)) return 'Windows';
  if (/mac os x|macintosh/i.test(ua)) return 'macOS';
  if (/linux|x11/i.test(ua)) return 'Linux';
  return null;
}

function detectBrowserName(ua: string): string | null {
  if (/edg\/|edga\/|edgios\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/firefox\/|fxios\//i.test(ua)) return 'Firefox';
  if (/chrome\/|crios\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua)) return 'Safari';
  return null;
}

export function parseUserAgentProfile(userAgent: string | null | undefined): UserAgentProfile {
  const trimmed = userAgent?.trim() ?? '';
  if (!trimmed || classifyBotUserAgent(trimmed).isBot) {
    return { deviceType: 'bot', osName: null, browserName: null };
  }

  let deviceType: DeviceType = 'unknown';
  if (
    /ipad|tablet|playbook|silk/i.test(trimmed) ||
    (/android/i.test(trimmed) && !/mobile/i.test(trimmed))
  ) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/i.test(trimmed)) {
    deviceType = 'mobile';
  } else if (/windows|macintosh|mac os x|linux|cros|x11|mozilla\//i.test(trimmed)) {
    deviceType = 'desktop';
  }

  return {
    deviceType,
    osName: detectOsName(trimmed),
    browserName: detectBrowserName(trimmed),
  };
}

function normalizeHostToken(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return null;
    }
  }
  const withoutPort = trimmed.replace(/:\d+$/, '');
  return withoutPort.replace(/^www\./, '') || null;
}

function classifyReferrerCategory(host: string): ReferrerCategory {
  if (
    SEARCH_HOSTS.has(host) ||
    host === 'google.com' ||
    host.startsWith('google.') ||
    host.endsWith('.google.com') ||
    host.startsWith('yandex.')
  ) {
    return 'search';
  }
  if (SOCIAL_HOSTS.has(host) || host.endsWith('.linkedin.com') || host.endsWith('.reddit.com')) {
    return 'social';
  }
  if (DEVELOPER_HOSTS.has(host) || host.endsWith('.github.io')) {
    return 'developer';
  }
  return 'referral';
}

export function normalizeReferrer(
  rawReferrer: string | null | undefined,
  ownHosts: readonly string[] = [],
): NormalizedReferrer {
  const trimmed = rawReferrer?.trim() ?? '';
  if (!trimmed) {
    return { referrer: null, referrerHost: null, referrerCategory: 'direct' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { referrer: null, referrerHost: null, referrerCategory: 'direct' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { referrer: null, referrerHost: null, referrerCategory: 'direct' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (!host) {
    return { referrer: null, referrerHost: null, referrerCategory: 'direct' };
  }

  const ownSet = new Set<string>(['andrew-k.us']);
  for (const rawOwn of ownHosts) {
    const normalizedOwn = normalizeHostToken(rawOwn);
    if (normalizedOwn) ownSet.add(normalizedOwn);
  }

  if (ownSet.has(host)) {
    return { referrer: null, referrerHost: null, referrerCategory: 'direct' };
  }

  const cleanOrigin = `${parsed.protocol}//${parsed.host}`;
  const cleanReferrer = `${cleanOrigin}${parsed.pathname}`.slice(0, REFERRER_MAX_LEN);
  return {
    referrer: cleanReferrer,
    referrerHost: host,
    referrerCategory: classifyReferrerCategory(host),
  };
}

export function sanitizeCampaignValue(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = '';
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code > 0x1f && code !== 0x7f) {
      cleaned += raw[i];
    }
  }
  const trimmed = cleaned.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, CAMPAIGN_VALUE_MAX_LEN);
}

export function normalizeLandingPath(rawPath: string | null | undefined): string {
  const trimmed = rawPath?.trim() ?? '';
  if (!trimmed) return '/';
  try {
    const parsed = new URL(trimmed, 'https://andrew-k.us');
    const pathname = parsed.pathname || '/';
    return pathname.slice(0, PATH_MAX_LEN);
  } catch {
    const stripped = trimmed.split(/[?#]/, 1)[0]?.trim() || '/';
    return (stripped.startsWith('/') ? stripped : `/${stripped}`).slice(0, PATH_MAX_LEN);
  }
}

export function extractCampaignParams(rawUrl: string): CampaignParams {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'https://andrew-k.us');
  } catch {
    return {
      landingPath: normalizeLandingPath(rawUrl),
      refParam: null,
      utmSource: null,
      utmMedium: null,
      utmCampaign: null,
      utmContent: null,
    };
  }

  return {
    landingPath: (parsed.pathname || '/').slice(0, PATH_MAX_LEN),
    refParam: sanitizeCampaignValue(parsed.searchParams.get('ref')),
    utmSource: sanitizeCampaignValue(parsed.searchParams.get('utm_source')),
    utmMedium: sanitizeCampaignValue(parsed.searchParams.get('utm_medium')),
    utmCampaign: sanitizeCampaignValue(parsed.searchParams.get('utm_campaign')),
    utmContent: sanitizeCampaignValue(parsed.searchParams.get('utm_content')),
  };
}
