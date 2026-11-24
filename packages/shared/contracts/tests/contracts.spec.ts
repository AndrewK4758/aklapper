import {
  AnalyticsBatchSchema,
  CadenceRunRequestSchema,
  K8sPodEventSchema,
  MenuItemSchema,
  Osc7501StatusSchema,
} from '../src/index.js';

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
});
