import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { DocumentBodyAnalytics, DocumentHeadTags } from '../src';

function parseHtml(markup: string): Document {
  return new DOMParser().parseFromString(markup, 'text/html');
}

describe('DocumentHeadTags & DocumentBodyAnalytics', () => {
  it('renders canonical, SEO, JSON-LD, first-party analytics, GA4, and GTM tags when configured', () => {
    const html = renderToStaticMarkup(
      <html lang='en'>
        <head>
          <title>Portal SEO Probe</title>
          <DocumentHeadTags
            applicationName='andrew-k.us // Solar Forge'
            canonicalUrl='https://andrew-k.us/'
            robots='index, follow'
            analyticsApp='portal'
            runtimeSeo={{
              siteUrl: 'https://andrew-k.us',
              analyticsEndpoint: 'https://analytics.andrew-k.us/v1/analytics/ingest',
              gaMeasurementId: 'G-TEST123456',
              gtmId: 'GTM-TEST999',
              gscVerification: 'gsc-token-123',
            }}
            jsonLd={{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'andrew-k.us' }}
          />
        </head>
        <body>
          <DocumentBodyAnalytics gtmId='GTM-TEST999' />
        </body>
      </html>,
    );

    const doc = parseHtml(html);

    expect(doc.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://andrew-k.us/',
    );
    const iconLinks = doc.head.querySelectorAll('link[rel="icon"]');
    expect(iconLinks).toHaveLength(1);
    expect(iconLinks[0]?.getAttribute('href')).toBe('/favicon.svg');
    expect(doc.head.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe(
      '/site.webmanifest',
    );
    expect(doc.head.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe(
      'index, follow',
    );
    expect(
      doc.head.querySelector('meta[name="google-site-verification"]')?.getAttribute('content'),
    ).toBe('gsc-token-123');
    expect(
      doc.head.querySelector('meta[name="aklapper-analytics-endpoint"]')?.getAttribute('content'),
    ).toBe('https://analytics.andrew-k.us/v1/analytics/ingest');
    expect(
      doc.head
        .querySelector('script[src="https://www.googletagmanager.com/gtag/js?id=G-TEST123456"]')
        ?.hasAttribute('async'),
    ).toBe(true);
    expect(doc.head.querySelector('script#aklapper-ga4-init')?.textContent).toContain(
      'G-TEST123456',
    );
    expect(doc.head.querySelector('script#aklapper-gtm-init')?.textContent).toContain(
      'GTM-TEST999',
    );
    expect(doc.head.querySelector('script[type="application/ld+json"]')?.textContent).toContain(
      'https://schema.org',
    );
    expect(doc.body.querySelector('noscript')?.innerHTML).toContain('GTM-TEST999');
  });

  it('omits third-party analytics scripts when unconfigured or invalid', () => {
    const html = renderToStaticMarkup(
      <html lang='en'>
        <head>
          <title>Admin SEO Probe</title>
          <DocumentHeadTags
            applicationName='admin.andrew-k.us // Solar Forge Ops'
            canonicalUrl='https://admin.andrew-k.us/'
            robots='noindex, nofollow, noarchive'
            analyticsApp='admin'
            runtimeSeo={{
              siteUrl: 'https://admin.andrew-k.us',
              gaMeasurementId: 'INVALID_ID',
              gtmId: 'INVALID_GTM',
            }}
          />
        </head>
        <body>
          <DocumentBodyAnalytics gtmId='INVALID_GTM' />
        </body>
      </html>,
    );

    const doc = parseHtml(html);

    expect(doc.head.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe(
      'noindex, nofollow, noarchive',
    );
    expect(doc.head.querySelector('script#aklapper-ga4-init')).toBeNull();
    expect(doc.head.querySelector('script#aklapper-gtm-init')).toBeNull();
    expect(doc.body.querySelector('noscript')).toBeNull();
  });
});
