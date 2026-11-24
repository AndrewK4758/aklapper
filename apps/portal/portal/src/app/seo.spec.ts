import { describe, expect, it } from 'vitest';

import { buildPortalPageMeta, DEFAULT_PORTAL_SITE_URL } from './seo';

describe('portal SEO helper', () => {
  it('generates indexable canonical and OpenGraph tags in normal mode', () => {
    const tags = buildPortalPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: {
            maintenanceMode: false,
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

  it('overrides page meta with noindex maintenance metadata when maintenanceMode is active', () => {
    const tags = buildPortalPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: {
            maintenanceMode: true,
            maintenance: {
              content: {
                heading: 'Scheduled Upgrade',
                lead: 'Upgrading Solar Forge infrastructure.',
              },
            },
          },
        },
      ],
      pathname: '/cadence',
      title: 'CADENCE Builder',
      description: 'Normal description',
    });

    expect(tags).toContainEqual({ title: 'Scheduled Upgrade // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
    expect(tags).toContainEqual({
      name: 'description',
      content: 'Upgrading Solar Forge infrastructure.',
    });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: `${DEFAULT_PORTAL_SITE_URL}/cadence`,
    });
  });
});
