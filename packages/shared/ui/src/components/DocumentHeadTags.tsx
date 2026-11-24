import type { DocumentSeoRuntimeConfig } from '@aklapper/core';

const SAFE_GA4_ID = /^G-[A-Z0-9]+$/i;
const SAFE_GTM_ID = /^GTM-[A-Z0-9]+$/i;

export interface DocumentHeadTagsProps {
  applicationName: string;
  author?: string;
  canonicalUrl: string;
  robots: string;
  analyticsApp: 'portal' | 'admin';
  runtimeSeo?: DocumentSeoRuntimeConfig;
  jsonLd?: Record<string, unknown>;
}

export interface DocumentBodyAnalyticsProps {
  gtmId?: string;
}

function getSafeAnalyticsOrigin(endpoint: string | undefined): string | undefined {
  if (!endpoint || endpoint.startsWith('/')) return undefined;
  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

function buildGtagInitScript(measurementId: string): string {
  return [
    'window.dataLayer = window.dataLayer || [];',
    'function gtag(){dataLayer.push(arguments);}',
    "if (!(navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true)) {",
    "  gtag('js', new Date());",
    `  gtag('config', '${measurementId}', { anonymize_ip: true, send_page_view: true });`,
    '}',
  ].join('\n');
}

function buildGtmInitScript(gtmId: string): string {
  return [
    "if (!(navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true)) {",
    "(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});",
    "var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';",
    "j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;",
    `f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
    '}',
  ].join('\n');
}

export function DocumentHeadTags({
  applicationName,
  author = 'Andrew Klapper',
  canonicalUrl,
  robots,
  analyticsApp,
  runtimeSeo,
  jsonLd,
}: DocumentHeadTagsProps) {
  const gaMeasurementId =
    runtimeSeo?.gaMeasurementId && SAFE_GA4_ID.test(runtimeSeo.gaMeasurementId)
      ? runtimeSeo.gaMeasurementId
      : undefined;
  const gtmId =
    runtimeSeo?.gtmId && SAFE_GTM_ID.test(runtimeSeo.gtmId) ? runtimeSeo.gtmId : undefined;
  const analyticsEndpoint = runtimeSeo?.analyticsEndpoint?.trim() || undefined;
  const analyticsOrigin = getSafeAnalyticsOrigin(analyticsEndpoint);
  const gscVerification = runtimeSeo?.gscVerification?.trim() || undefined;

  return (
    <>
      <meta charSet='utf-8' />
      <meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover' />
      <meta name='color-scheme' content='dark' />
      <meta name='theme-color' content='#121110' />
      <meta name='referrer' content='strict-origin-when-cross-origin' />
      <meta name='application-name' content={applicationName} />
      <meta name='author' content={author} />
      <meta name='googlebot' content={robots} />
      {gscVerification ? <meta name='google-site-verification' content={gscVerification} /> : null}
      <meta name='aklapper-analytics-app' content={analyticsApp} />
      {analyticsEndpoint ? (
        <meta name='aklapper-analytics-endpoint' content={analyticsEndpoint} />
      ) : null}
      <link rel='canonical' href={canonicalUrl} />
      <link rel='icon' href='/favicon.ico' sizes='any' />
      <link rel='icon' href='/favicon.svg' type='image/svg+xml' />
      <link rel='apple-touch-icon' href='/favicon.svg' />
      <link rel='manifest' href='/site.webmanifest' />
      {analyticsOrigin ? (
        <link rel='preconnect' href={analyticsOrigin} crossOrigin='anonymous' />
      ) : null}
      {gaMeasurementId || gtmId ? (
        <link rel='preconnect' href='https://www.googletagmanager.com' />
      ) : null}
      {jsonLd ? (
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replaceAll('<', '\\u003c'),
          }}
        />
      ) : null}
      {gaMeasurementId ? (
        <>
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`}
          />
          <script
            id='aklapper-ga4-init'
            dangerouslySetInnerHTML={{ __html: buildGtagInitScript(gaMeasurementId) }}
          />
        </>
      ) : null}
      {gtmId ? (
        <script
          id='aklapper-gtm-init'
          dangerouslySetInnerHTML={{ __html: buildGtmInitScript(gtmId) }}
        />
      ) : null}
    </>
  );
}

export function DocumentBodyAnalytics({ gtmId }: DocumentBodyAnalyticsProps) {
  if (!gtmId || !SAFE_GTM_ID.test(gtmId)) return null;

  return (
    <noscript>
      <iframe
        title='Google Tag Manager'
        src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmId)}`}
        height={0}
        width={0}
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
