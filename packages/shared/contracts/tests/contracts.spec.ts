import {
  AnalyticsBatchSchema,
  CadenceRunRequestSchema,
  K8sPodEventSchema,
  MenuItemSchema,
  Osc7501StatusSchema,
  PortalChromeContentSchema,
  TerminalProfileDataSchema,
} from '../src/index.ts';

describe('@aklapper/contracts', () => {
  it('validates a data-driven menu item', () => {
    const parsed = MenuItemSchema.parse({
      slug: 'cadence',
      keyShortcut: '1',
      title: 'CADENCE Builder',
      description: 'Interactive spec-to-artifact sandbox on live GKE pods',
      targetK8sDeploy: 'svc-cadence-demo',
      namespace: 'portfolio-public',
      adminOnly: false,
      sortOrder: 1,
      enabled: true,
    });

    expect(parsed.slug).toBe('cadence');
    expect(parsed.adminOnly).toBe(false);
  });

  it('validates K8s Watch and OSC 7501 events', () => {
    const now = new Date().toISOString();
    const podEvent = K8sPodEventSchema.parse({
      eventId: 'evt-1',
      namespace: 'portfolio-public',
      deployment: 'svc-cadence-demo',
      podName: 'svc-cadence-demo-abc12',
      phase: 'TriggeredScaleUp',
      ready: false,
      message: 'Scaled replicas 0 -> 1',
      timestamp: now,
    });
    const status = Osc7501StatusSchema.parse({
      source: 'svc-cadence-demo',
      state: 'scaling',
      label: 'Waking GKE pod 0 -> 1',
      progress: 35,
      timestamp: now,
    });

    expect(podEvent.phase).toBe('TriggeredScaleUp');
    expect(status.state).toBe('scaling');
  });

  it('enforces CADENCE prompt bounds and analytics batches', () => {
    expect(() => CadenceRunRequestSchema.parse({ prompt: 'hi' })).toThrow(/4/);

    const batch = AnalyticsBatchSchema.parse({
      sessionId: 'sess-123',
      events: [
        {
          type: 'page_view',
          name: 'menu_open',
          path: '/menu',
          timestamp: new Date().toISOString(),
        },
      ],
    });
    expect(batch.events).toHaveLength(1);
  });

  it('validates DB-backed terminal profiles and portal chrome content', () => {
    const profile = TerminalProfileDataSchema.parse({
      slug: 'portal-home',
      bannerTitle: 'zsh 5.9 :: powerlevel10k // Solar Forge tty1',
      bannerMeta: 'local dev · type commands or use TUI below',
      osLabel: '⚡',
      directory: '~/projects/aklapper',
      vcsBranch: 'portfolio_v2',
      vcsState: 'clean',
      contextLabel: 'guest@andrew-k.us',
      placeholder: 'type a command',
      quickCommands: ['help', 'ls'],
      initialEntries: [
        {
          command: 'ls -la',
          output: 'menu/',
          status: 'ok',
          durationLabel: '6ms',
          timestamp: '00:00:00',
          sortOrder: 0,
        },
      ],
      commands: [
        {
          name: 'whoami',
          description: 'display active terminal session',
          kind: 'static',
          output: 'guest@andrew-k.us (tty1)',
          targetRoute: null,
          allowedRoutes: [],
          errorTemplate: null,
          sortOrder: 0,
        },
      ],
    });
    expect(profile.initialEntries).toHaveLength(1);

    const chrome = PortalChromeContentSchema.parse({
      pageTitle: 'andrew-k.us // Solar Forge Terminal',
      brandLabel: 'andrew-k.us :: tty1',
      statusBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods (scale-to-0)' },
      footerText: 'Solar Forge // Fastify 5 + React Router 8 SSR',
      footerLinkLabel: 'agensi.io/creators/aklapper',
      footerLinkUrl: 'https://agensi.io/creators/aklapper',
      maintenanceModeDefault: false,
    });
    expect(chrome.maintenanceModeDefault).toBe(false);
  });
});
