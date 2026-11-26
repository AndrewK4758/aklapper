import { describe, expect, it } from 'vitest';

import { buildPortalPageMeta, DEFAULT_PORTAL_SITE_URL } from './seo';

describe('portal SEO helper', () => {
  it('generates indexable canonical and OpenGraph tags by default', () => {
    const tags = buildPortalPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: {
            runtimeSeo: { siteUrl: 'https://preview.andrew-k.us' },
          },
        },
      ],
      pathname: '/contact',
      title: 'Contact // andrew-k.us',
      description: 'Direct contact form.',
    });

    expect(tags).toContainEqual({ title: 'Contact // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'index, follow' });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: 'https://preview.andrew-k.us/contact',
    });
  });

  it('supports explicit noindex, nofollow directives and falls back to DEFAULT_PORTAL_SITE_URL', () => {
    const tags = buildPortalPageMeta({
      matches: [],
      pathname: '/changes-in-progress',
      title: 'Not Found // andrew-k.us',
      description: 'The requested page could not be found on andrew-k.us.',
      robots: 'noindex, nofollow',
    });

    expect(tags).toContainEqual({ title: 'Not Found // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: `${DEFAULT_PORTAL_SITE_URL}/changes-in-progress`,
    });
  });
});
