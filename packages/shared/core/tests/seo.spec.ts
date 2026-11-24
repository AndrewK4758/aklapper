import { describe, expect, it } from 'vitest';

import {
  buildCanonicalUrl,
  buildPortalJsonLd,
  buildRouteMetaTags,
  getRootDataFromMatches,
  readSeoRuntimeConfig,
  serializeJsonLd,
} from '../src/seo.ts';

describe('@aklapper/core/seo', () => {
  it('reads and validates runtime SEO and analytics config from environment variables', () => {
    const config = readSeoRuntimeConfig({
      defaultSiteUrl: 'https://andrew-k.us',
      siteUrlEnvKey: 'PUBLIC_PORTAL_URL',
      env: {
        PUBLIC_PORTAL_URL: 'https://staging.andrew-k.us/',
        PUBLIC_ANALYTICS_ENDPOINT: 'https://analytics.andrew-k.us/v1/analytics/ingest',
        PUBLIC_GA_MEASUREMENT_ID: 'G-ABC123XYZ9',
        PUBLIC_GTM_ID: 'GTM-XYZ9876',
        PUBLIC_GSC_VERIFICATION: 'verify-token_123',
      },
    });

    expect(config).toEqual({
      siteUrl: 'https://staging.andrew-k.us',
      analyticsEndpoint: 'https://analytics.andrew-k.us/v1/analytics/ingest',
      gaMeasurementId: 'G-ABC123XYZ9',
      gtmId: 'GTM-XYZ9876',
      gscVerification: 'verify-token_123',
    });
  });

  it('rejects malformed URLs and unsafe analytics identifiers', () => {
    const config = readSeoRuntimeConfig({
      defaultSiteUrl: 'https://andrew-k.us',
      env: {
        PUBLIC_SITE_URL: 'javascript:alert(1)',
        PUBLIC_ANALYTICS_ENDPOINT: 'javascript:alert(1)',
        PUBLIC_GA_MEASUREMENT_ID: 'G-123";alert(1)',
        PUBLIC_GTM_ID: 'GTM-BAD<script>',
        PUBLIC_GSC_VERIFICATION: 'bad token!',
      },
    });

    expect(config).toEqual({
      siteUrl: 'https://andrew-k.us',
    });
  });

  it('defaults analyticsEndpoint to /api/analytics/ingest when PUBLIC_ANALYTICS_ENDPOINT is unset or blank', () => {
    const unsetConfig = readSeoRuntimeConfig({
      defaultSiteUrl: 'https://andrew-k.us',
      env: {},
    });
    expect(unsetConfig.analyticsEndpoint).toBe('/api/analytics/ingest');

    const blankConfig = readSeoRuntimeConfig({
      defaultSiteUrl: 'https://andrew-k.us',
      env: { PUBLIC_ANALYTICS_ENDPOINT: '   ' },
    });
    expect(blankConfig.analyticsEndpoint).toBe('/api/analytics/ingest');
  });

  it('normalizes canonical URLs and builds complete OpenGraph + Twitter route meta tags', () => {
    expect(buildCanonicalUrl('https://andrew-k.us/', '/')).toBe('https://andrew-k.us/');
    expect(buildCanonicalUrl('https://andrew-k.us/', '/menu/')).toBe('https://andrew-k.us/menu');

    const tags = buildRouteMetaTags({
      title: 'Launch Menu // andrew-k.us',
      description: 'Select a Solar Forge module.',
      siteName: 'andrew-k.us',
      siteUrl: 'https://andrew-k.us',
      pathname: '/menu/',
    });

    expect(tags).toContainEqual({ title: 'Launch Menu // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'description', content: 'Select a Solar Forge module.' });
    expect(tags).toContainEqual({ name: 'robots', content: 'index, follow' });
    expect(tags).toContainEqual({ property: 'og:url', content: 'https://andrew-k.us/menu' });
    expect(tags).toContainEqual({ name: 'twitter:card', content: 'summary' });
  });

  it('escapes HTML tag openers when serializing JSON-LD structured data', () => {
    const jsonLd = buildPortalJsonLd('https://andrew-k.us');
    const serialized = serializeJsonLd({ ...jsonLd, probe: '</script><script>' });

    expect(serialized).toContain('https://schema.org');
    expect(serialized).not.toContain('</script>');
    expect(serialized).toContain('\\u003c/script>');
  });

  it('extracts root loaderData with fallback to legacy data from route matches', () => {
    expect(
      getRootDataFromMatches<{ site: string }>([
        undefined,
        { id: 'root', loaderData: { site: 'portal' }, data: { site: 'stale' } },
        { id: 'routes/home', loaderData: { site: 'home' } },
      ]),
    ).toEqual({ site: 'portal' });

    expect(
      getRootDataFromMatches<{ site: string }>([{ id: 'root', data: { site: 'admin' } }]),
    ).toEqual({ site: 'admin' });

    expect(getRootDataFromMatches([{ id: 'routes/home' }])).toBeUndefined();
  });
});
