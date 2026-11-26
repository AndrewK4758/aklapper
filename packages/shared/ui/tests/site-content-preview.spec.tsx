import {
  type CareerDossier,
  CONTACT_FORM_DEFINITION,
  SITE_CONTENT_KEYS,
  type SiteContentKey,
} from '@aklapper/core';
import { render, screen } from '@testing-library/react';

import * as uiExports from '../src/index';
import { SF_LAYOUT_TOKENS, SiteContentPreviewCanvas, TuiHeroCard } from '../src/index';

const PORTAL_ABOUT_PREVIEW_FIXTURE: Record<string, unknown> = {
  windowTitle: 'About Andrew Klapper // Resume & Services',
  statusBadge: { source: 'portal-about', state: 'ready', label: 'Sanitized' },
  description: 'Public-safe resume and interactive platform services guide.',
  identity: {
    fullName: 'Andrew Klapper',
    roleHeadline: 'Senior Full-Stack & Systems Engineer',
    location: 'Marietta, GA',
    githubLabel: 'github.com/AndrewK4758',
    githubUrl: 'https://github.com/AndrewK4758',
    websiteLabel: 'andrew-k.us',
    websiteUrl: 'https://andrew-k.us',
  },
  portrait: {
    alt: 'Andrew Klapper greyscale portrait',
    caption: 'Andrew Klapper · Marietta, GA',
    ttyLabel: 'portrait // greyscale',
  },
  skillGroups: [{ category: 'Languages', skills: ['C# (.NET 10)', 'Go (1.26+)', 'TypeScript'] }],
  education: [
    {
      institution: 'Kennesaw State University',
      location: 'Kennesaw, GA',
      program: 'Professional Sales (29 credits completed)',
    },
  ],
  servicesIntro: 'Explore live workspace services.',
  services: [
    {
      id: 'chat',
      title: 'Chat with Andrew',
      to: '/chat',
      badge: 'AI + JD Match',
      summary: 'Ask grounded questions against published dossiers.',
      ctaLabel: 'Open Chat',
    },
  ],
};

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
  [SITE_CONTENT_KEYS.portalAbout]: PORTAL_ABOUT_PREVIEW_FIXTURE,
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

  it('renders all 10 known site_content keys across desktop and mobile viewports without nested forms or iframes', () => {
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

  it('renders portal-about preview with published+verified dossiers only and excludes draft or unverified dossiers', () => {
    const dossiers: CareerDossier[] = [
      {
        slug: 'published-profile',
        kind: 'profile_core',
        title: 'Published Core Profile',
        domainLabel: 'Systems Engineering',
        roleTitle: 'Senior Full-Stack & Systems Engineer',
        timeframe: 'Present',
        skills: ['Go', 'TypeScript'],
        summaryBody: 'Verified published engineering summary.',
        sections: [],
        publishStatus: 'published',
        sanitizationVerifiedAt: '2026-11-26T00:00:00.000Z',
        denylistHash: 'a'.repeat(64),
        sortOrder: 0,
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
      {
        slug: 'unpublished-draft-role',
        kind: 'experience',
        title: 'Secret Draft Role Title',
        domainLabel: 'Draft Domain',
        roleTitle: 'Draft Engineer',
        timeframe: 'Draft',
        skills: ['HiddenSkill'],
        summaryBody: 'Unpublished draft body must never leak into live preview.',
        sections: [],
        publishStatus: 'draft',
        sanitizationVerifiedAt: '2026-11-26T00:00:00.000Z',
        denylistHash: 'a'.repeat(64),
        sortOrder: 10,
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
      {
        slug: 'unverified-published-role',
        kind: 'project',
        title: 'Unverified Project Title',
        domainLabel: 'Unverified Domain',
        roleTitle: 'Author',
        timeframe: '2026',
        skills: ['Unverified'],
        summaryBody: 'Unverified dossier must also be excluded.',
        sections: [],
        publishStatus: 'published',
        sanitizationVerifiedAt: null,
        denylistHash: null,
        sortOrder: 20,
        updatedAt: '2026-11-26T00:00:00.000Z',
      },
    ];

    const { container, rerender } = render(
      <SiteContentPreviewCanvas
        contentKey={SITE_CONTENT_KEYS.portalAbout}
        metadata={PORTAL_ABOUT_PREVIEW_FIXTURE}
        viewport='desktop'
        careerDossiers={dossiers}
        brandContactEmail='andrew@andrew-k.us'
      />,
    );

    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByText('andrew@andrew-k.us')).toBeTruthy();
    expect(screen.getByText('Verified published engineering summary.')).toBeTruthy();
    expect(screen.queryByText('Secret Draft Role Title')).toBeNull();
    expect(screen.queryByText(/Unpublished draft body/)).toBeNull();
    expect(screen.queryByText('Unverified Project Title')).toBeNull();

    // Empty published dossiers renders explicit notice
    rerender(
      <SiteContentPreviewCanvas
        contentKey={SITE_CONTENT_KEYS.portalAbout}
        metadata={PORTAL_ABOUT_PREVIEW_FIXTURE}
        viewport='mobile'
        careerDossiers={[dossiers[1]!]}
        brandContactEmail='andrew@andrew-k.us'
      />,
    );
    expect(screen.getByTestId('about-preview-dossiers-empty')).toBeTruthy();
    expect(screen.queryByText('Secret Draft Role Title')).toBeNull();
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

  it('renders portal-home terminal greeting portrait and resume summary above launcher with zero forms across desktop and mobile', () => {
    for (const viewport of ['desktop', 'mobile'] as const) {
      const { container, unmount } = render(
        <SiteContentPreviewCanvas
          contentKey={SITE_CONTENT_KEYS.portalHome}
          metadata={PREVIEW_FIXTURES[SITE_CONTENT_KEYS.portalHome]}
          viewport={viewport}
        />,
      );
      expect(container.querySelector('form')).toBeNull();
      expect(container.querySelector('iframe')).toBeNull();
      expect(container.querySelector('[data-portal-home-intro="true"]')).not.toBeNull();
      expect(container.querySelector('[data-terminal-portrait="true"]')).not.toBeNull();
      expect(screen.getByText('Senior Full-Stack & Systems Engineer · Marietta, GA')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Andrew Klapper' })).toBeTruthy();
      unmount();
    }
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
