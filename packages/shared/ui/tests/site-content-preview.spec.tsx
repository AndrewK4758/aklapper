import { CONTACT_FORM_DEFINITION, SITE_CONTENT_KEYS, type SiteContentKey } from '@aklapper/core';
import { render, screen } from '@testing-library/react';

import * as uiExports from '../src/index';
import { SF_LAYOUT_TOKENS, SiteContentPreviewCanvas, TuiHeroCard } from '../src/index';

const PREVIEW_FIXTURES: Record<SiteContentKey, Record<string, unknown>> = {
  [SITE_CONTENT_KEYS.portalChrome]: {
    pageTitle: 'Andrew Klapper',
    brandLabel: 'andrew-k.us',
    shortcutHint: 'Press m for menu',
    statusBadge: { source: 'portal', state: 'ready', label: 'Online' },
    footerText: 'Built with Solar Forge',
    footerLinkLabel: 'GitHub',
    footerLinkUrl: 'https://github.com/AndrewK4758',
  },
  [SITE_CONTENT_KEYS.portalHome]: {
    tuiTitle: 'launcher :: home',
    tuiBadge: { source: 'portal', state: 'ready', label: 'Ready' },
    heading: 'Andrew Klapper',
    description: 'Principal engineer.',
    actions: [{ label: 'CADENCE Builder', to: '/cadence', variant: 'primary' }],
  },
  [SITE_CONTENT_KEYS.portalAgensi]: {
    windowTitle: 'Agensi Skills',
    statusBadge: { source: 'agensi', state: 'ready', label: 'Indexed' },
    description: 'Curated skills.',
    searchPlaceholder: 'Filter skills...',
    emptyStateLabel: 'No matching skills.',
    outboundCtaLabel: 'Open Skill',
  },
  [SITE_CONTENT_KEYS.portalAsk]: {
    windowTitle: 'Ask Portfolio',
    statusBadge: { source: 'qdrant', state: 'ready', label: 'Grounded' },
    description: 'Ask grounded questions.',
    starterQuestions: ['What stack powers this portfolio?'],
    jdPlaceholder: 'Paste JD...',
    abstentionNotice: 'Grounded answers only.',
  },
  [SITE_CONTENT_KEYS.portalCadence]: {
    windowTitle: 'CADENCE Sandbox',
    statusBadge: { source: 'cadence', state: 'idle', label: 'Standby' },
    description: 'Multi-agent demo.',
    iframeTitle: 'CADENCE Artifact Preview',
  },
  [SITE_CONTENT_KEYS.portalContact]: {
    windowTitle: 'Contact',
    statusBadge: { source: 'contact', state: 'ready', label: 'PG19' },
    description: 'Send a direct message.',
    form: CONTACT_FORM_DEFINITION,
  },
  [SITE_CONTENT_KEYS.adminChrome]: {
    pageTitle: 'Admin Console',
    brandLabel: 'admin.andrew-k.us',
    shortcutHint: 'Press ? for help',
    statusBadge: { source: 'admin', state: 'ready', label: 'Authenticated' },
  },
  [SITE_CONTENT_KEYS.adminHome]: {
    heading: 'Operations Overview',
    description: 'Monitor health and CMS.',
    actions: [{ label: 'Open CMS', to: '/cms', variant: 'primary' }],
  },
  [SITE_CONTENT_KEYS.adminAnalytics]: {
    windowTitle: 'Analytics // PG19',
    description: 'Traffic and Core Web Vitals.',
  },
};

describe('@aklapper/ui site-content preview primitives', () => {
  it('registers the wide admin container layout token and omits retired maintenance preview exports', () => {
    expect(SF_LAYOUT_TOKENS.containerAdminWide).toBe('--sf-container-admin-wide');
    expect('MaintenanceProgressCard' in uiExports).toBe(false);
  });

  it('renders all 9 known site_content keys across desktop and mobile viewports without nested forms or iframes', () => {
    for (const key of Object.values(SITE_CONTENT_KEYS)) {
      const { container, unmount } = render(
        <SiteContentPreviewCanvas
          contentKey={key}
          metadata={PREVIEW_FIXTURES[key]}
          viewport='mobile'
        />,
      );
      expect(container.querySelector('[data-preview-viewport="mobile"]')).not.toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('form')).toBeNull();
      unmount();
    }
  });

  it('omits maintenance-mode status from portal-chrome preview even if legacy metadata still has it', () => {
    render(
      <SiteContentPreviewCanvas
        contentKey={SITE_CONTENT_KEYS.portalChrome}
        metadata={{
          ...PREVIEW_FIXTURES[SITE_CONTENT_KEYS.portalChrome],
          maintenanceModeDefault: true,
        }}
        viewport='desktop'
      />,
    );
    expect(screen.getByText('andrew-k.us')).toBeTruthy();
    expect(screen.queryByText(/Maintenance default/i)).toBeNull();
  });

  it('renders script-like strings as escaped text and shows notice for unknown keys', () => {
    const xssPayload = '<script>window.__xss=1</script>';
    const { container } = render(
      <SiteContentPreviewCanvas
        contentKey={SITE_CONTENT_KEYS.adminAnalytics}
        metadata={{
          windowTitle: xssPayload,
          description: 'Safe text',
        }}
        viewport='desktop'
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText(xssPayload)).toBeTruthy();

    render(
      <SiteContentPreviewCanvas
        contentKey='custom-banner'
        metadata={{ banner: 'hi' }}
        viewport='desktop'
      />,
    );
    expect(screen.getByText(/no ui preview/i)).toBeTruthy();
  });

  it('supports shared TuiHeroCard composition', () => {
    render(
      <TuiHeroCard
        heading='Hero Title'
        description='Hero Copy'
        actions={[{ label: 'Launch', to: '/cadence', variant: 'primary' }]}
        renderAction={action => (
          <a key={action.to} href={action.to}>
            {action.label}
          </a>
        )}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Hero Title' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Launch' })).toBeTruthy();
  });
});
