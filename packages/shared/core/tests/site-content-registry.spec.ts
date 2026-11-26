import {
  AdminCmsLoaderDataSchema,
  CONTACT_FORM_DEFINITION,
  DEFAULT_PORTAL_HOME_PORTRAIT,
  DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
  introspectSiteContentSchema,
  isKnownSiteContentKey,
  PortalAboutContentSchema,
  PortalAskContentSchema,
  PortalHomeContentSchema,
  SITE_CONTENT_KEYS,
  SITE_CONTENT_METADATA,
  SITE_CONTENT_SCHEMA_BY_KEY,
  type SiteContentKey,
  validateSiteContentMetadata,
} from '../src/index.ts';

const VALID_PORTAL_ABOUT_FIXTURE: Record<string, unknown> = {
  windowTitle: 'About Andrew Klapper // Resume & Services',
  statusBadge: { source: 'portal-about', state: 'ready', label: 'Sanitized Profile' },
  description: 'Public-safe engineering resume and interactive platform services guide.',
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
    alt: 'Andrew Klapper greyscale terminal portrait',
    caption: 'Andrew Klapper · Marietta, GA',
    ttyLabel: 'portrait // greyscale',
  },
  skillGroups: [
    { category: 'Languages', skills: ['C# (.NET 10)', 'Go (1.26+)', 'TypeScript'] },
    { category: 'Cloud & DevOps', skills: ['Docker', 'Kubernetes (AKS)', 'GCP'] },
  ],
  education: [
    {
      institution: 'Kennesaw State University',
      location: 'Kennesaw, GA',
      program: 'Professional Sales (29 credits completed)',
    },
  ],
  servicesIntro: 'Explore interactive tools and services available directly in this workspace.',
  services: [
    {
      id: 'chat',
      title: 'Chat with Andrew',
      to: '/chat',
      badge: 'AI + JD Match',
      summary: 'Ask grounded questions or evaluate role fit against published career dossiers.',
      ctaLabel: 'Open Chat →',
    },
    {
      id: 'agensi',
      title: 'Agensi Storefront',
      to: '/agensi',
      badge: 'Skills Catalog',
      summary: 'Browse published commercial AI agent skills and operational workflows.',
      ctaLabel: 'Open Agensi →',
    },
    {
      id: 'cadence',
      title: 'CADENCE Builder',
      to: '/cadence',
      badge: 'Interactive Demo',
      summary: 'Run deterministic or live spec-driven artifact synthesis workflows.',
      ctaLabel: 'Open CADENCE →',
    },
  ],
};

const VALID_FIXTURES: Record<SiteContentKey, Record<string, unknown>> = {
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
    description: 'Principal full-stack and platform engineer.',
    actions: [{ label: 'CADENCE Builder', to: '/cadence', variant: 'primary' }],
  },
  [SITE_CONTENT_KEYS.portalAbout]: VALID_PORTAL_ABOUT_FIXTURE,
  [SITE_CONTENT_KEYS.portalAgensi]: {
    windowTitle: 'Agensi Skills',
    statusBadge: { source: 'agensi', state: 'ready', label: 'Indexed' },
    description: 'Curated agent skills.',
    searchPlaceholder: 'Filter skills...',
    emptyStateLabel: 'No matching skills.',
    outboundCtaLabel: 'Open Skill',
  },
  [SITE_CONTENT_KEYS.portalAsk]: {
    windowTitle: 'Ask Portfolio',
    statusBadge: { source: 'qdrant', state: 'ready', label: 'Grounded' },
    description: 'Ask grounded questions.',
    starterQuestions: ['What stack powers this portfolio?'],
    jdPlaceholder: 'Paste job description...',
    abstentionNotice: 'Answers are grounded strictly in indexed documents.',
  },
  [SITE_CONTENT_KEYS.portalCadence]: {
    windowTitle: 'CADENCE Sandbox',
    statusBadge: { source: 'cadence', state: 'idle', label: 'Standby' },
    description: 'Interactive multi-agent demo.',
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
    shortcutHint: 'Press ? for shortcuts',
    statusBadge: { source: 'admin', state: 'ready', label: 'Authenticated' },
  },
  [SITE_CONTENT_KEYS.adminHome]: {
    heading: 'Operations Overview',
    description: 'Monitor health, traffic, and content.',
    actions: [{ label: 'Open CMS', to: '/cms', variant: 'primary' }],
  },
  [SITE_CONTENT_KEYS.adminAnalytics]: {
    windowTitle: 'Analytics // PG19',
    description: 'First-party traffic and Core Web Vitals.',
  },
};

describe('@aklapper/core site_content registry', () => {
  it('registers all 10 active site_content keys including portal-about without portal-maintenance', () => {
    const keys = Object.values(SITE_CONTENT_KEYS);
    expect(keys).toHaveLength(10);
    expect(keys).toContain('portal-about');
    expect(SITE_CONTENT_METADATA[SITE_CONTENT_KEYS.portalAbout].surface).toBe('portal');
    expect(keys).not.toContain('portal-maintenance');
    expect(isKnownSiteContentKey('portal-maintenance')).toBe(false);
    for (const key of keys) {
      expect(isKnownSiteContentKey(key)).toBe(true);
      expect(SITE_CONTENT_SCHEMA_BY_KEY[key]).toBeDefined();
      expect(SITE_CONTENT_METADATA[key].label.length).toBeGreaterThan(0);
      expect(SITE_CONTENT_METADATA[key].description.length).toBeGreaterThan(0);
    }
    expect(isKnownSiteContentKey('custom-banner')).toBe(false);
  });

  it('introspects all 10 schemas cleanly via z.toJSONSchema with cycle refs and memoization', () => {
    for (const key of Object.values(SITE_CONTENT_KEYS)) {
      const schema = introspectSiteContentSchema(key);
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(introspectSiteContentSchema(key)).toBe(schema);
    }
    const contactSchema = introspectSiteContentSchema(SITE_CONTENT_KEYS.portalContact);
    expect(contactSchema.properties?.['form']).toBeDefined();
    const aboutSchema = introspectSiteContentSchema(SITE_CONTENT_KEYS.portalAbout);
    expect(aboutSchema.properties?.['services']).toBeDefined();
  });

  it('validates all 10 fixtures and strips unknown or retired keys on registered site_content rows', () => {
    for (const key of Object.values(SITE_CONTENT_KEYS)) {
      const candidate = {
        ...VALID_FIXTURES[key],
        maintenanceModeDefault: true,
        customNote: 'strip-me',
      };
      const result = validateSiteContentMetadata(key, candidate);
      expect(result.ok).toBe(true);
      const data = result.ok ? result.data : {};
      expect('maintenanceModeDefault' in data).toBe(false);
      expect('customNote' in data).toBe(false);
    }
  });

  it('reports field-level validation issues for invalid known payloads and passes unknown keys verbatim', () => {
    const invalidChrome = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalChrome, {
      ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalChrome],
      footerLinkUrl: 'not-a-valid-url',
    });
    expect(invalidChrome).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([expect.objectContaining({ pathKey: 'footerLinkUrl' })]),
      }),
    );

    const unknownResult = validateSiteContentMetadata('custom-banner', { banner: 'hello' });
    expect(unknownResult).toEqual({ ok: true, data: { banner: 'hello' } });
  });

  it('hydrates defaults cleanly for legacy 6-field portal-ask rows and rejects disallowed contactCtaHref routes', () => {
    const legacyParsed = PortalAskContentSchema.parse(VALID_FIXTURES[SITE_CONTENT_KEYS.portalAsk]);
    expect(legacyParsed.visitorLenses.length).toBeGreaterThanOrEqual(3);
    expect(legacyParsed.qaTabLabel).toBe('Chat with Andrew');
    expect(legacyParsed.jdTabLabel).toBe('JD Match');
    expect(legacyParsed.contactCtaHref).toBe('/contact');

    const invalidCta = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalAsk, {
      ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalAsk],
      contactCtaHref: 'https://evil.example/phish',
    });
    expect(invalidCta).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([expect.objectContaining({ pathKey: 'contactCtaHref' })]),
      }),
    );

    const cmsLoader = AdminCmsLoaderDataSchema.parse({
      siteContents: [],
      menuItems: [],
      terminalProfiles: [],
      terminalCommands: [],
      terminalInitialEntries: [],
      agensiSkills: [],
      cadencePresets: [],
    });
    expect(cmsLoader.careerDossiers).toEqual([]);
  });

  it('hydrates default portrait and sanitized resumeSummary for legacy 5-field portal-home rows with isolated clones', () => {
    const first = PortalHomeContentSchema.parse(VALID_FIXTURES[SITE_CONTENT_KEYS.portalHome]);
    expect(first.portrait).toEqual(DEFAULT_PORTAL_HOME_PORTRAIT);
    expect(first.portrait.src).toBe('/images/andrew-klapper-portrait.webp');
    expect(first.portrait.width).toBe(440);
    expect(first.portrait.height).toBe(520);
    expect(first.resumeSummary).toEqual(DEFAULT_PORTAL_HOME_RESUME_SUMMARY);
    expect(first.resumeSummary.publicEmail).toBe('andrew@andrew-k.us');
    expect(first.resumeSummary.githubUrl).toBe('https://github.com/AndrewK4758');
    expect(first.resumeSummary.services.map(s => s.command)).toEqual([
      'cadence',
      'chat',
      'agensi',
      'about',
      'contact',
    ]);

    const serializedDefault = JSON.stringify(first.resumeSummary);
    expect(serializedDefault).not.toMatch(/References|\bzsh\b|p10k|powerlevel10k/i);
    expect(serializedDefault).not.toMatch(/\bGA\s+\d{5}\b/);
    expect(serializedDefault).not.toMatch(/\(\d{3}\)\s*\d{3}-\d{4}/);

    // Mutating returned arrays/objects must not leak into subsequent parses
    first.resumeSummary.highlights.push('Mutated highlight');
    first.resumeSummary.services[0]!.summary = 'Mutated service';
    const second = PortalHomeContentSchema.parse(VALID_FIXTURES[SITE_CONTENT_KEYS.portalHome]);
    expect(second.resumeSummary.highlights).not.toContain('Mutated highlight');
    expect(second.resumeSummary.services[0]?.summary).not.toBe('Mutated service');

    const homeJsonSchema = introspectSiteContentSchema(SITE_CONTENT_KEYS.portalHome);
    expect(homeJsonSchema.properties?.['portrait']).toBeDefined();
    expect(homeJsonSchema.properties?.['resumeSummary']).toBeDefined();
  });

  it('rejects non-root-relative portrait.src paths and non-HTTPS githubUrl values on portal-home', () => {
    for (const badSrc of [
      'https://cdn.example.invalid/photo.webp',
      'http://cdn.example.invalid/photo.webp',
      '//cdn.example.invalid/photo.webp',
      '/\\cdn.example.invalid/photo.webp',
      '/images\\photo.webp',
      '/images/../secret.webp',
      '/\t/attacker.example/pixel.webp',
      '/\n/attacker.example/pixel.webp',
      '/\r/attacker.example/pixel.webp',
      '/images/.\t./secret.webp',
      '/%2e%2e/secret.webp',
      '/images/a\u0000b.webp',
      '/images/a?b=1',
      '/images/a#frag',
      'javascript:alert(1)',
      'data:image/webp;base64,AAAA',
      'images/relative-no-leading-slash.webp',
    ]) {
      const result = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalHome, {
        ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalHome],
        portrait: {
          ...DEFAULT_PORTAL_HOME_PORTRAIT,
          src: badSrc,
        },
      });
      expect(result, `expected rejection for portrait.src=${badSrc}`).toEqual(
        expect.objectContaining({
          ok: false,
          issues: expect.arrayContaining([expect.objectContaining({ pathKey: 'portrait.src' })]),
        }),
      );
    }

    for (const badGithubUrl of [
      'javascript:alert(1)',
      'data:text/html,hi',
      'http://github.com/AndrewK4758',
      'ftp://github.com/AndrewK4758',
      'https://user:pass@github.com/AndrewK4758',
      'https://github.com/AndrewK4758\t/evil',
    ]) {
      const result = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalHome, {
        ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalHome],
        resumeSummary: {
          ...DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
          githubUrl: badGithubUrl,
        },
      });
      expect(result, `expected rejection for githubUrl=${badGithubUrl}`).toEqual(
        expect.objectContaining({
          ok: false,
          issues: expect.arrayContaining([
            expect.objectContaining({ pathKey: 'resumeSummary.githubUrl' }),
          ]),
        }),
      );
    }
  });

  it('validates portal-about defaults and rejects disallowed service routes, postal ZIP locations, and empty required framing fields', () => {
    const parsedAbout = PortalAboutContentSchema.parse(VALID_PORTAL_ABOUT_FIXTURE);
    expect(parsedAbout.skillsHeading).toBe('Technical Skills');
    expect(parsedAbout.contactCtaHref).toBe('/contact');

    const invalidServiceAndZip = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalAbout, {
      ...VALID_PORTAL_ABOUT_FIXTURE,
      identity: {
        ...(VALID_PORTAL_ABOUT_FIXTURE['identity'] as Record<string, unknown>),
        location: 'Marietta, GA 30062',
      },
      services: [
        {
          id: 'phish',
          title: 'Untrusted',
          to: 'https://untrusted.example/phish',
          badge: 'External',
          summary: 'External link must be blocked.',
          ctaLabel: 'Open',
        },
      ],
    });
    expect(invalidServiceAndZip).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ pathKey: 'identity.location' }),
          expect.objectContaining({ pathKey: 'services.0.to' }),
        ]),
      }),
    );

    const missingRequired = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalAbout, {
      ...VALID_PORTAL_ABOUT_FIXTURE,
      windowTitle: '   ',
      skillGroups: [],
    });
    expect(missingRequired).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ pathKey: 'windowTitle' }),
          expect.objectContaining({ pathKey: 'skillGroups' }),
        ]),
      }),
    );
  });
});
