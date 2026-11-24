import {
  CONTACT_FORM_DEFINITION,
  introspectSiteContentSchema,
  isKnownSiteContentKey,
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
    actions: [{ label: 'Open Menu', to: '/menu', variant: 'primary' }],
  },
  [SITE_CONTENT_KEYS.portalMenu]: {
    heading: 'Command Menu',
    description: 'Select a workspace destination.',
    localTargetLabel: 'Local Route',
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
    expect(keys).toHaveLength(11);
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
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data['customNote']).toBe('keep-me');
      }
    }
  });

  it('reports field-level validation issues for invalid known payloads and passes unknown keys', () => {
    const invalidChrome = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalChrome, {
      ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalChrome],
      footerLinkUrl: 'not-a-valid-url',
    });
    expect(invalidChrome.ok).toBe(false);
    if (!invalidChrome.ok) {
      expect(invalidChrome.issues.some(issue => issue.pathKey === 'footerLinkUrl')).toBe(true);
    }

    const invalidMaint = validateSiteContentMetadata(SITE_CONTENT_KEYS.portalMaintenance, {
      ...VALID_FIXTURES[SITE_CONTENT_KEYS.portalMaintenance],
      progressPercent: 150,
    });
    expect(invalidMaint.ok).toBe(false);
    if (!invalidMaint.ok) {
      expect(invalidMaint.issues.some(issue => issue.pathKey === 'progressPercent')).toBe(true);
    }

    const unknownResult = validateSiteContentMetadata('custom-banner', { banner: 'hello' });
    expect(unknownResult).toEqual({ ok: true, data: { banner: 'hello' } });
  });
});
