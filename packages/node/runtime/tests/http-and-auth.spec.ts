import { describe, expect, it } from 'vitest';

import {
  ADMIN_SESSION_COOKIE_NAME,
  GUEST_SESSION_COOKIE_NAME,
  parseCookieHeader,
} from '../src/auth.ts';
import { joinUpstreamUrl } from '../src/http.ts';

describe('@aklapper/node-runtime/http & auth', () => {
  it('joins upstream base URLs and paths without duplicate slashes', () => {
    expect(joinUpstreamUrl('http://127.0.0.1:8081/', '/v1/pods')).toBe(
      'http://127.0.0.1:8081/v1/pods',
    );
    expect(joinUpstreamUrl('http://127.0.0.1:8081', 'v1/pods')).toBe(
      'http://127.0.0.1:8081/v1/pods',
    );
  });

  it('parses cookie headers and handles malformed percent-encoding gracefully', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(
      parseCookieHeader(
        `${ADMIN_SESSION_COOKIE_NAME}=tok%201; ${GUEST_SESSION_COOKIE_NAME}=guest-2; bad=%E0%A4%A; empty`,
      ),
    ).toEqual({
      [ADMIN_SESSION_COOKIE_NAME]: 'tok 1',
      [GUEST_SESSION_COOKIE_NAME]: 'guest-2',
      bad: '%E0%A4%A',
    });
  });
});
