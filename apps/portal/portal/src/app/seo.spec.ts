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

  it('overrides page meta with synchronous noindex maintenance defaults without awaited DB maintenance data', () => {
    const tags = buildPortalPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: {
            maintenanceMode: true,
          },
        },
      ],
      pathname: '/cadence',
      title: 'CADENCE Builder',
      description: 'Normal description',
    });

    expect(tags).toContainEqual({ title: 'Changes in Progress // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
    expect(tags).toContainEqual({
      name: 'description',
      content:
        'andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI platform.',
    });
    expect(tags).toContainEqual({
      property: 'og:url',
      content: `${DEFAULT_PORTAL_SITE_URL}/cadence`,
    });
  });

  it('ignores legacy DB maintenance fields on root matches and stays strictly synchronous', () => {
    const tags = buildPortalPageMeta({
      matches: [
        {
          id: 'root',
          loaderData: {
            maintenanceMode: true,
            maintenance: {
              content: {
                heading: 'DB Override Should Not Drive Sync Head',
                lead: 'Async DB lead.',
              },
            },
          },
        },
      ],
      pathname: '/menu',
      title: 'Launch Menu',
      description: 'Menu description',
    });

    expect(tags).toContainEqual({ title: 'Changes in Progress // andrew-k.us' });
    expect(tags).toContainEqual({ name: 'robots', content: 'noindex, nofollow' });
  });
});
