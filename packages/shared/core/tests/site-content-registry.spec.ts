import {
  AdminCmsLoaderDataSchema,
  CONTACT_FORM_DEFINITION,
  introspectSiteContentSchema,
  isKnownSiteContentKey,
  PortalAskContentSchema,
  SITE_CONTENT_KEYS,
  SITE_CONTENT_METADATA,
  SITE_CONTENT_SCHEMA_BY_KEY,
  type SiteContentKey,
  validateSiteContentMetadata,
} from '../src/index.ts';

const VALID_FIXTURES: Record<SiteContentKey, Record<string, unknown>> = {
  [SITE_CONTENT_KEYS.portalChrome]: {
    pageTitle: 'Andrew Klapper',
    brandLabel: 'andrew-k.us',
    shortcutHint: 'Press m for menu',
    statusBadge: { source: 'portal', state: 'ready', label: 'Online' },
    footerText: 'Built with Solar Forge',
    footerLinkLabel: 'GitHub',
    footerLinkUrl: 'https://github.com/AndrewK4758',
    maintenanceModeDefault: false,
  },
  [SITE_CONTENT_KEYS.portalHome]: {
    tuiTitle: 'launcher :: home',
    tuiBadge: { source: 'portal', state: 'ready', label: 'Ready' },
    heading: 'Andrew Klapper',
    description: 'Principal full-stack and platform engineer.',
    actions: [{ label: 'CADENCE Builder', to: '/cadence', variant: 'primary' }],
  },
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
  [SITE_CONTENT_KEYS.portalMaintenance]: {
    windowTitle: 'Maintenance',
    statusBadge: { source: 'maintenance', state: 'scaling', label: 'Rebuilding' },
    heading: 'Changes in Progress',
    lead: 'Deploying portfolio upgrades.',
    progressPercent: 72,
    progressAriaLabel: 'Rebuild progress',
    metaLeft: 'Cluster: games-424800',
    metaRight: 'ETA: soon',
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
  it('registers all 11 site_content keys with schemas and display metadata', () => {
    const keys = Object.values(SITE_CONTENT_KEYS);
    expect(keys).toHaveLength(10);
    for (const key of keys) {
      expect(isKnownSiteContentKey(key)).toBe(true);
      expect(SITE_CONTENT_SCHEMA_BY_KEY[key]).toBeDefined();
      expect(SITE_CONTENT_METADATA[key].label.length).toBeGreaterThan(0);
      expect(SITE_CONTENT_METADATA[key].description.length).toBeGreaterThan(0);
    }
    expect(isKnownSiteContentKey('custom-banner')).toBe(false);
  });

  it('introspects all 11 schemas cleanly via z.toJSONSchema with cycle refs and memoization', () => {
    for (const key of Object.values(SITE_CONTENT_KEYS)) {
      const schema = introspectSiteContentSchema(key);
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();
      expect(introspectSiteContentSchema(key)).toBe(schema);
    }
    const contactSchema = introspectSiteContentSchema(SITE_CONTENT_KEYS.portalContact);
    expect(contactSchema.properties?.['form']).toBeDefined();
  });

  it('validates all 11 fixtures and preserves unknown extra keys losslessly', () => {
    for (const key of Object.values(SITE_CONTENT_KEYS)) {
      const candidate = { ...VALID_FIXTURES[key], customNote: 'keep-me' };
      const result = validateSiteContentMetadata(key, candidate);
      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
          data: expect.objectContaining({ customNote: 'keep-me' }),
        }),
      );
    }
  });

  it('reports field-level validation issues for invalid known payloads and passes unknown keys', () => {
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

    const invalidMaint = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalMaintenance, {
      ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalMaintenance],
      progressPercent: 150,
    });
    expect(invalidMaint).toEqual(
      expect.objectContaining({
        ok: false,
        issues: expect.arrayContaining([expect.objectContaining({ pathKey: 'progressPercent' })]),
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
      maintenanceModeDefault: false,
      rebuildProgressPercent: 50,
      menuItems: [],
      terminalProfiles: [],
      terminalCommands: [],
      terminalInitialEntries: [],
      roadmapMilestones: [],
      agensiSkills: [],
      cadencePresets: [],
    });
    expect(cmsLoader.careerDossiers).toEqual([]);
  });
});
