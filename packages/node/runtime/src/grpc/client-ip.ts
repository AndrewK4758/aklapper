import { isIP } from 'node:net';

import { signInternalAuthToken } from '../http.ts';

export const INTERNAL_CLIENT_IP_HEADER = 'x-internal-client-ip';
export const CLIENT_IP_SUBJECT_PREFIX = 'client-ip:';

const DEFAULT_CLIENT_IP_TTL_SECONDS = 60;

/**
 * Signs an HMAC-verified `x-internal-client-ip` metadata token carrying `role="service"` and
 * `sub="client-ip:<valid-ip>"`. Fails closed if the IP is empty or syntactically invalid.
 */
export function signInternalClientIpHeader(
  ip: string,
  secret?: string,
  ttlSeconds = DEFAULT_CLIENT_IP_TTL_SECONDS,
): string {
  const normalized = ip.trim();
  if (!normalized || isIP(normalized) === 0) {
    throw new Error('Cannot sign x-internal-client-ip header: invalid IP address');
  }
  return signInternalAuthToken({
    role: 'service',
    subject: `${CLIENT_IP_SUBJECT_PREFIX}${normalized}`,
    ...(secret !== undefined ? { secret } : {}),
    ttlSeconds,
  });
}
