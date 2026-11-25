import {
  AgensiCatalogMetaSchema,
  AgensiRemoteResponseSchema,
  AgensiRemoteSkillItemSchema,
  AgensiSkillSchema,
  AnalyticsBatchSchema,
  AskPortfolioRequestSchema,
  AskResponseSchema,
  AskServiceStatusSchema,
  AskTurnStateSchema,
  AskTurnStatusSchema,
  CadenceRunLifecycleStatusSchema,
  CadenceRunModeSchema,
  CadenceRunRequestSchema,
  CadenceRunResultSchema,
  CadenceStreamCompleteEventSchema,
  CadenceStreamErrorEventSchema,
  CadenceStreamPhaseEventSchema,
  collectFormFields,
  CONTACT_FORM_DEFINITION,
  CONTACT_MAX_FILE_BYTES,
  ContactFormSubmissionSchema,
  createCadenceRunStreamStore,
  createPublicAppError,
  FormDefinitionSchema,
  formatTerminalDirectoryListing,
  GroundingTierSchema,
  JdMatchEvaluationSchema,
  JdMatchRequestSchema,
  MenuItemSchema,
  Osc7501StatusSchema,
  parseCadenceSseEvent,
  ADMIN_ROUTE_PATHS,
  PORTAL_NAVIGABLE_ROUTE_PATHS,
  PORTAL_ROUTE_PATHS,
  type PortalAgensiLoaderData,
  PortalAskContentSchema,
  PortalChromeContentSchema,
  resolveAllowedMimeType,
  RuntimeServiceHealthSnapshotSchema,
  sanitizeFilename,
  TerminalDirectoryEntryUpsertSchema,
  TerminalProfileDataSchema,
  validateFormValues,
} from '../src/index.ts';

describe('@aklapper/core (contracts)', () => {
  it('validates a data-driven menu item', () => {
    const parsed = MenuItemSchema.parse({
      slug: 'cadence',
      keyShortcut: '1',
      title: 'CADENCE Builder',
      description: 'Interactive spec-to-artifact sandbox on Cloud Run',
      adminOnly: false,
      sortOrder: 1,
      enabled: true,
    });

    expect(parsed.slug).toBe('cadence');
    expect(parsed.adminOnly).toBe(false);
    expect('targetK8sDeploy' in parsed).toBe(false);
    expect('namespace' in parsed).toBe(false);
  });

  it('validates RuntimeServiceHealthSnapshot and OSC 7501 events and route path parity', () => {
    const now = new Date().toISOString();
    const snapshot = RuntimeServiceHealthSnapshotSchema.parse({
      runtime: 'cloud-run',
      services: [
        {
          service: 'portal',
          runtime: 'cloud-run',
          status: 'healthy',
          latencyMs: 12,
          checkedAt: now,
        },
        {
          service: 'ai-ask',
          runtime: 'cloud-run',
          status: 'healthy',
          latencyMs: 34,
          checkedAt: now,
        },
      ],
      summaryLabel: 'Cloud Run · 2/2 healthy',
      checkedAt: now,
      cached: true,
    });
    const status = Osc7501StatusSchema.parse({
      source: 'cadence-demo',
      state: 'running',
      label: 'Running on Cloud Run',
      progress: 35,
      timestamp: now,
    });

    expect(snapshot.cached).toBe(true);
    expect(status.state).toBe('running');
    expect(PORTAL_ROUTE_PATHS).toContain('/api/runtime/status');
    expect(PORTAL_ROUTE_PATHS).not.toContain('/api/cluster/stream');
    expect(ADMIN_ROUTE_PATHS).toContain('/api/ops/runtime/status');
    expect(ADMIN_ROUTE_PATHS).not.toContain('/api/ops/cluster/stream');
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
      bannerTitle: 'Solar Forge Terminal // tty1',
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
          command: 'ls',
          output: formatTerminalDirectoryListing([
            { name: 'menu', description: 'Site menu' },
            { name: 'changes-in-progress', description: 'Maintenance preview' },
          ]),
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
    expect(profile.initialEntries[0]?.output).toBe(
      ['menu                  # Site menu', 'changes-in-progress   # Maintenance preview'].join(
        '\n',
      ),
    );
    expect(formatTerminalDirectoryListing([])).toBe('');
    expect(
      TerminalDirectoryEntryUpsertSchema.parse({
        profileSlug: 'portal-home',
        name: 'contact',
        description: 'Connect with me',
        sortOrder: 6,
      }),
    ).toMatchObject({ name: 'contact', enabled: true });
    expect(() =>
      TerminalDirectoryEntryUpsertSchema.parse({
        profileSlug: 'portal-home',
        name: 'menu/',
        description: 'Site menu',
        sortOrder: 1,
      }),
    ).toThrow(/Invalid/i);

    const chrome = PortalChromeContentSchema.parse({
      pageTitle: 'andrew-k.us // Solar Forge Terminal',
      brandLabel: 'andrew-k.us',
      statusBadge: { source: 'gke-autopilot', state: 'idle', label: '0 pods (scale-to-0)' },
      footerText: 'Solar Forge // Fastify 5 + React Router 8 SSR',
      footerLinkLabel: 'agensi.io/creators/aklapper',
      footerLinkUrl: 'https://agensi.io/creators/aklapper',
      maintenanceModeDefault: false,
    });
    expect(chrome.maintenanceModeDefault).toBe(false);
  });

  it('parses recursive Zod contact form schema and enforces required vs optional fields', () => {
    const parsedDef = FormDefinitionSchema.parse(CONTACT_FORM_DEFINITION);
    const fields = collectFormFields(parsedDef.nodes);
    expect(fields.map(f => [f.name, f.required])).toEqual([
      ['name', true],
      ['email', true],
      ['phone', false],
      ['message', true],
      ['file', false],
    ]);

    const emptyOutcome = validateFormValues(parsedDef, {});
    expect(emptyOutcome.valid).toBe(false);
    expect(Object.keys(emptyOutcome.fieldErrors).toSorted()).toEqual(['email', 'message', 'name']);

    const validMinimal = validateFormValues(parsedDef, {
      name: 'Ada Lovelace',
      email: 'ada@analytical-engine.org',
      message: 'Let us discuss building a Solar Forge system.',
    });
    expect(validMinimal.valid).toBe(true);
    expect(validMinimal.fieldErrors).toEqual({});

    const badOptional = validateFormValues(parsedDef, {
      name: 'Ada Lovelace',
      email: 'ada@analytical-engine.org',
      phone: '123',
      message: 'Valid long enough message body.',
      file: {
        name: 'payload.exe',
        size: CONTACT_MAX_FILE_BYTES + 1,
        type: 'application/x-msdownload',
      },
    });
    expect(badOptional.valid).toBe(false);
    expect(badOptional.fieldErrors['phone']).toBeTruthy();
    expect(badOptional.fieldErrors['file']).toHaveLength(2);

    expect(sanitizeFilename('../../etc/spec.txt')).toBe('spec.txt');
    expect(resolveAllowedMimeType('notes.md', 'application/octet-stream')).toBe('text/markdown');
    expect(resolveAllowedMimeType('evil.sh', 'text/plain')).toBeNull();
    expect(resolveAllowedMimeType('evil.pdf', 'text/plain')).toBeNull();

    const submission = ContactFormSubmissionSchema.parse({
      name: '  Ada Lovelace  ',
      phone: '   ',
      email: '  ADA@EXAMPLE.COM ',
      message: 'Testing validated server submission schema.',
      attachment: null,
    });
    expect(submission.name).toBe('Ada Lovelace');
    expect(submission.phone).toBeNull();
    expect(submission.email).toBe('ada@example.com');
  });

  it('validates deeply nested fieldsets, regex patterns, length bounds, and attachment edge cases', async () => {
    const { ContactAttachmentSchema, PortalContactContentSchema } = await import('../src/index.ts');

    const nestedForm = FormDefinitionSchema.parse({
      id: 'deep-form',
      slug: 'deep-form',
      title: 'Deep Recursive Form',
      description: 'Validates recursive traversal to depth 3.',
      cliCommand: 'deep',
      submitLabel: 'Send',
      resetLabel: 'Reset',
      nodes: [
        {
          kind: 'fieldset',
          id: 'level-1',
          legend: 'Level 1',
          children: [
            {
              kind: 'fieldset',
              id: 'level-2',
              legend: 'Level 2',
              children: [
                {
                  kind: 'fieldset',
                  id: 'level-3',
                  legend: 'Level 3',
                  children: [
                    {
                      kind: 'field',
                      id: 'deep-code',
                      name: 'code',
                      label: 'Access Code',
                      fieldType: 'text',
                      required: true,
                      minLength: 4,
                      maxLength: 8,
                      pattern: '^[A-Z0-9]+$',
                      patternMessage: 'Use uppercase alphanumeric characters only',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(collectFormFields(nestedForm.nodes).map(f => f.name)).toEqual(['code']);
    expect(validateFormValues(nestedForm, { code: 'ab' }).fieldErrors['code']).toEqual([
      'Access Code must be at least 4 characters',
      'Use uppercase alphanumeric characters only',
    ]);
    expect(validateFormValues(nestedForm, { code: 'ABCDEFGHIJ' }).fieldErrors['code']).toEqual([
      'Access Code must be 8 characters or fewer',
    ]);
    expect(validateFormValues(nestedForm, { code: 'SF2026' }).valid).toBe(true);

    // 0-byte empty file rejected by form validator
    const emptyFileOutcome = validateFormValues(CONTACT_FORM_DEFINITION, {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      message: 'Testing empty file rejection in form validator.',
      file: { name: 'empty.txt', size: 0, type: 'text/plain' },
    });
    expect(emptyFileOutcome.valid).toBe(false);
    expect(emptyFileOutcome.fieldErrors['file']).toContain('Attached file cannot be empty');

    // Path traversal rejected by ContactAttachmentSchema
    expect(() =>
      ContactAttachmentSchema.parse({
        filename: '../secret.txt',
        mimeType: 'text/plain',
        sizeBytes: 10,
        sha256: 'a'.repeat(64),
        contentBase64: 'aGVsbG8=',
      }),
    ).toThrow(/disallowed path segments/i);

    const contactContent = PortalContactContentSchema.parse({
      windowTitle: 'tui :: contact',
      statusBadge: { source: 'contact-form', state: 'ready', label: 'zod + pg19' },
      description: 'Send a direct message.',
      form: CONTACT_FORM_DEFINITION,
    });
    expect(contactContent.form.id).toBe('contact-form');
  });

  it('flattens recursive form steps with fieldset headers and parses hybrid CLI invocations', async () => {
    const { flattenFormSteps, formatCliFormHelp, parseCliFormInvocation, tokenizeCliCommand } =
      await import('../src/index.ts');

    const steps = flattenFormSteps(CONTACT_FORM_DEFINITION);
    expect(steps).toHaveLength(5);
    expect(steps[0]?.enteredFieldsets.map(h => [h.depth, h.legend])).toEqual([
      [0, '01 // Sender Identity'],
    ]);
    expect(steps[2]?.field.name).toBe('phone');
    expect(steps[2]?.enteredFieldsets.map(h => [h.depth, h.legend])).toEqual([
      [1, '01.1 // Optional Callback Channel'],
    ]);
    expect(steps[3]?.field.name).toBe('message');
    expect(steps[3]?.enteredFieldsets.map(h => [h.depth, h.legend])).toEqual([
      [0, '02 // Message & Attachment'],
    ]);

    expect(
      tokenizeCliCommand(
        'contact --name "Ada Lovelace" --email=\'ada@example.com\' --message="Hi"',
      ),
    ).toEqual(['contact', '--name', 'Ada Lovelace', '--email=ada@example.com', '--message=Hi']);

    expect(parseCliFormInvocation(CONTACT_FORM_DEFINITION, 'contact --help').help).toBe(true);
    expect(parseCliFormInvocation(CONTACT_FORM_DEFINITION, 'contact -h').help).toBe(true);
    expect(parseCliFormInvocation(CONTACT_FORM_DEFINITION, 'contact --tui').openTui).toBe(true);

    const parsedFlags = parseCliFormInvocation(
      CONTACT_FORM_DEFINITION,
      'contact --name "Ada Lovelace" --email=ada@example.com --message "Multi word message" --file',
    );
    expect(parsedFlags.providedFields).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      message: 'Multi word message',
    });
    expect(parsedFlags.requestedFilePicker).toBe(true);
    expect(parsedFlags.unknownTokens).toEqual([]);

    const badFlags = parseCliFormInvocation(CONTACT_FORM_DEFINITION, 'contact --bogus foo');
    expect(badFlags.unknownTokens).toEqual(['--bogus', 'foo']);

    const helpText = formatCliFormHelp(CONTACT_FORM_DEFINITION);
    expect(helpText).toContain('Usage: contact [options]');
    expect(helpText).toContain('--tui');
    expect(helpText).toContain('--name <name>');
    expect(helpText).toContain('--email <email>');
    expect(helpText).toContain('--phone <phone>');
    expect(helpText).toContain('--message <message>');
    expect(helpText).toContain('--file');
  });

  it('validates unified 8000-char Ask/JD bounds, attemptId, AskTurnStateSchema, JdMatchEvaluationSchema, and AskServiceStatusSchema', () => {
    const attemptId = '11111111-1111-4111-8111-111111111111';

    const qaReq = AskPortfolioRequestSchema.parse({
      mode: 'qa',
      question: 'How does the Go backend index Qdrant?',
      attemptId,
      sessionId: 'guest_sess-01',
    });
    expect(qaReq.attemptId).toBe(attemptId);
    expect(() =>
      AskPortfolioRequestSchema.parse({
        mode: 'qa',
        question: 'Valid length question',
        attemptId: 'not-a-uuid',
      }),
    ).toThrow(/Invalid UUID/i);

    const minJd = JdMatchRequestSchema.parse({
      mode: 'jd_match',
      jobDescription: 'x'.repeat(20),
    });
    expect(minJd.jobDescription).toHaveLength(20);

    const legacy6k = JdMatchRequestSchema.parse({
      mode: 'jd_match',
      jobDescription: 'a'.repeat(6000),
    });
    expect(legacy6k.jobDescription).toHaveLength(6000);

    const boundary7500 = JdMatchRequestSchema.parse({
      mode: 'jd_match',
      jobDescription: 'b'.repeat(7500),
      attemptId,
    });
    expect(boundary7500.jobDescription).toHaveLength(7500);

    const max8000 = JdMatchRequestSchema.parse({
      mode: 'jd_match',
      jobDescription: 'c'.repeat(8000),
    });
    expect(max8000.jobDescription).toHaveLength(8000);

    expect(() =>
      JdMatchRequestSchema.parse({
        mode: 'jd_match',
        jobDescription: 'd'.repeat(8001),
      }),
    ).toThrow(/8000/);

    expect(AskTurnStatusSchema.options).toEqual([
      'pending',
      'running',
      'completed',
      'abstained',
      'failed',
      'expired',
    ]);

    const jdEval = JdMatchEvaluationSchema.parse({
      matchScore: 84,
      strengths: ['Go microservices on GKE Autopilot'],
      gaps: ['Terraform provider authoring not indexed'],
    });
    expect(jdEval.matchScore).toBe(84);
    expect(() =>
      JdMatchEvaluationSchema.parse({
        matchScore: 84.5,
        strengths: [],
        gaps: [],
      }),
    ).toThrow(/expected int/i);
    expect(() =>
      JdMatchEvaluationSchema.parse({
        matchScore: 101,
        strengths: [],
        gaps: [],
      }),
    ).toThrow(/<=100/);

    const response = AskResponseSchema.parse({
      attemptId,
      grounded: true,
      abstained: false,
      mode: 'jd_match',
      answer: 'Strong distributed architecture fit.',
      sources: [
        {
          id: 'curated-stack',
          title: 'Core Architecture',
          snippet: 'Go + React SSR + PostgreSQL 19.',
          score: 0.92,
          category: 'dossier',
        },
      ],
      matchScore: jdEval.matchScore,
      strengths: jdEval.strengths,
      gaps: jdEval.gaps,
      provider: 'local-llama-swap',
      model: 'inference',
      tokensUsed: 410,
      latencyMs: 1200,
      correlationId: 'corr-ask-1',
    });
    expect(response.abstained).toBe(false);

    const runningState = AskTurnStateSchema.parse({
      attemptId,
      status: 'running',
      mode: 'qa',
      correlationId: 'corr-ask-run',
      leaseExpiresAt: '2026-11-24T22:01:00.000Z',
      expiresAt: '2026-11-24T22:15:00.000Z',
    });
    expect(runningState.status).toBe('running');

    const failedState = AskTurnStateSchema.parse({
      attemptId,
      status: 'failed',
      mode: 'qa',
      correlationId: 'corr-ask-fail',
      leaseExpiresAt: '2026-11-24T22:01:00.000Z',
      expiresAt: '2026-11-24T22:15:00.000Z',
      error: createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 503,
        message: 'Upstream service unreachable.',
        action: 'Retry shortly or go home.',
        correlationId: 'corr-ask-fail',
      }),
    });
    expect(failedState.error?.code).toBe('ERR_UPSTREAM_UNAVAILABLE');

    const status = AskServiceStatusSchema.parse({
      status: 'ready',
      provider: 'local-llama-swap',
      pointsCount: 18,
    });
    expect(status.pointsCount).toBe(18);
  });

  it('validates Agensi catalog contracts, live creator-profile responses, and optional loader metadata', () => {
    const legacySkill = AgensiSkillSchema.parse({
      slug: 'cadence-governed-agentic-sdlc-framework',
      name: 'CADENCE: Governed Agentic SDLC Framework',
      summary: 'Governed multi-phase agentic delivery framework.',
      tags: ['sdlc', 'agents'],
      url: 'https://agensi.io/skills/cadence-governed-agentic-sdlc-framework',
      sortOrder: 1,
    });
    expect(legacySkill.creatorHandle).toBeUndefined();
    expect(legacySkill.source).toBeUndefined();

    const extendedSkill = AgensiSkillSchema.parse({
      ...legacySkill,
      creatorHandle: 'aklapper',
      isPublished: true,
      syncedAt: '2026-11-24T12:00:00.000Z',
      source: 'agensi_api',
    });
    expect(extendedSkill.creatorHandle).toBe('aklapper');
    expect(extendedSkill.source).toBe('agensi_api');

    const remoteItem = AgensiRemoteSkillItemSchema.parse({
      slug: 'cadence-triage-risk-classifier',
      name: 'CADENCE Triage & Risk Classifier',
      summary: 'Classifies engineering tasks across 4 axes.',
      tags: ['triage', 'agents-orchestration'],
      url: 'https://agensi.io/skills/cadence-triage-risk-classifier',
      install_count: 0,
      vote_count: 1,
      rating: null,
    });
    expect(remoteItem.slug).toBe('cadence-triage-risk-classifier');

    const creatorEnvelope = AgensiRemoteResponseSchema.parse({
      name: 'Andrew Klapper',
      slug: 'aklapper',
      verified: true,
      skill_count: 1,
      url: 'https://agensi.io/creators/aklapper',
      skills: [remoteItem],
    });
    expect(creatorEnvelope.slug).toBe('aklapper');
    expect(creatorEnvelope.skills).toHaveLength(1);

    const paginatedEnvelope = AgensiRemoteResponseSchema.parse({
      items: [
        {
          slug: 'local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
          title: 'Local GPU Coprocessor Offload for Coding Agents (FastMCP)',
          description: 'Read-only local GPU FastMCP server.',
          tags: ['mcp', 'local-llm'],
          url: 'https://agensi.io/skills/local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
          creatorHandle: 'aklapper',
          isPublished: true,
          sortOrder: 3,
        },
      ],
      nextCursor: 'page-2',
    });
    expect(paginatedEnvelope.items).toHaveLength(1);
    expect(paginatedEnvelope.nextCursor).toBe('page-2');

    const catalogMeta = AgensiCatalogMetaSchema.parse({
      mode: 'cached_fallback',
      creatorHandle: 'aklapper',
      syncedAt: '2026-11-24T12:00:00.000Z',
    });
    const loaderPayload: PortalAgensiLoaderData = {
      content: {
        windowTitle: 'tui :: agensi',
        statusBadge: {
          source: 'agensi-catalog',
          state: 'idle',
          label: 'catalog · cached fallback',
        },
        description: 'Creator skills.',
        searchPlaceholder: 'Filter...',
        emptyStateLabel: 'No skills.',
        outboundCtaLabel: 'Open on Agensi ->',
      },
      skills: [extendedSkill],
      catalogMeta,
    };
    expect(loaderPayload.catalogMeta?.mode).toBe('cached_fallback');
  });

  it('validates fast/llm run modes, lifecycle statuses, and SSE stream schemas', () => {
    expect(CadenceRunModeSchema.parse('fast')).toBe('fast');
    expect(CadenceRunModeSchema.parse('llm')).toBe('llm');
    expect(() => CadenceRunModeSchema.parse('turbo')).toThrow(/Invalid/i);

    expect(CadenceRunLifecycleStatusSchema.parse('pending')).toBe('pending');
    expect(CadenceRunLifecycleStatusSchema.parse('running')).toBe('running');
    expect(CadenceRunLifecycleStatusSchema.parse('ready')).toBe('ready');
    expect(CadenceRunLifecycleStatusSchema.parse('failed')).toBe('failed');

    const initReq = CadenceRunRequestSchema.parse({
      prompt: 'Monitor pipeline phase latency and replica readiness',
      presetSlug: 'chord-pipeline-monitor',
      mode: 'fast',
      deferExecution: true,
    });
    expect(initReq.mode).toBe('fast');
    expect(initReq.deferExecution).toBe(true);

    const run = CadenceRunResultSchema.parse({
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Monitor pipeline phase latency',
      presetSlug: 'chord-pipeline-monitor',
      runStatus: 'pending',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [],
      artifactHtml: '',
    });
    expect(run.runStatus).toBe('pending');
    expect(run.mode).toBe('fast');

    const phaseEvent = CadenceStreamPhaseEventSchema.parse({
      runId: run.runId,
      runStatus: 'running',
      progress: 50,
      turn: {
        phase: 'spec',
        agentName: 'chord-spec',
        status: 'completed',
        summary: 'Spec drafted',
        latencyMs: 3,
      },
    });
    expect(phaseEvent.turn.phase).toBe('spec');

    const completeEvent = CadenceStreamCompleteEventSchema.parse({
      run: { ...run, runStatus: 'ready', artifactHtml: '<html></html>' },
    });
    expect(completeEvent.run.runStatus).toBe('ready');

    const errorEvent = CadenceStreamErrorEventSchema.parse({
      runId: run.runId,
      error: 'Pipeline aborted cleanly',
      code: 'ERR_CADENCE_STREAM',
    });
    expect(errorEvent.code).toBe('ERR_CADENCE_STREAM');
  });

  it('parses SSE events and updates external stream store through phase -> complete without reconnect loops', () => {
    const parsedPhase = parseCadenceSseEvent(
      'phase',
      JSON.stringify({
        runId: '11111111-1111-4111-8111-111111111111',
        runStatus: 'running',
        turn: {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Triaged prompt',
          latencyMs: 2,
        },
      }),
    );
    expect(parsedPhase?.type).toBe('phase');
    expect(parseCadenceSseEvent('phase', 'not-json')).toBeNull();

    const listeners = new Map<string, Array<(ev: unknown) => void>>();
    let closed = false;
    const mockSource = {
      addEventListener: (type: string, cb: (ev: unknown) => void) => {
        const list = listeners.get(type) ?? [];
        list.push(cb);
        listeners.set(type, list);
      },
      close: () => {
        closed = true;
      },
      onerror: null as ((ev: unknown) => void) | null,
    } as unknown as EventSource;

    const initialRun = CadenceRunResultSchema.parse({
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Stream test prompt',
      presetSlug: 'k8s-pod-telemetry',
      runStatus: 'pending',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    });

    const store = createCadenceRunStreamStore({
      runId: initialRun.runId,
      initialRun,
      eventSourceFactory: () => mockSource,
    });

    let notifications = 0;
    const unsub = store.subscribe(() => {
      notifications += 1;
    });

    const phaseHandlers = listeners.get('phase') ?? [];
    for (const fn of phaseHandlers) {
      fn({
        data: JSON.stringify({
          runId: initialRun.runId,
          runStatus: 'running',
          turn: {
            phase: 'triage',
            agentName: 'chord-triage',
            status: 'completed',
            summary: 'Triaged fast',
            latencyMs: 3,
          },
        }),
      });
    }
    expect(store.getSnapshot().run.runStatus).toBe('running');
    expect(store.getSnapshot().run.turns[0]?.status).toBe('completed');
    expect(notifications).toBeGreaterThan(0);

    const completeHandlers = listeners.get('complete') ?? [];
    for (const fn of completeHandlers) {
      fn({
        data: JSON.stringify({
          run: {
            ...initialRun,
            runStatus: 'ready',
            artifactHtml: '<html><body>Tailored</body></html>',
          },
          quota: { role: 'guest', turnsUsed: 1, maxTurns: 5, tokensUsed: 800, maxTokens: 20000 },
        }),
      });
    }
    expect(store.getSnapshot().run.runStatus).toBe('ready');
    expect(store.getSnapshot().quota?.turnsUsed).toBe(1);
    expect(closed).toBe(true);
    unsub();
  });

  it('supports general grounding tier, canonical /chat route paths, and Chat with Andrew defaults', () => {
    expect(GroundingTierSchema.parse('general')).toBe('general');
    expect(PORTAL_NAVIGABLE_ROUTE_PATHS).toContain('/chat');
    expect(PORTAL_NAVIGABLE_ROUTE_PATHS).not.toContain('/ask');
    expect(PORTAL_ROUTE_PATHS).toContain('/chat');
    expect(PORTAL_ROUTE_PATHS).not.toContain('/ask');

    const parsed = PortalAskContentSchema.parse({
      windowTitle: 'Chat with Andrew — AI Chat & Role Fit',
      statusBadge: { source: 'svc-ai-ask', state: 'idle', label: 'Ready' },
      description: "Chat with Andrew's AI about his work or anything else.",
      starterQuestions: ['Who is Andrew Klapper?'],
      jdPlaceholder: 'Paste a job description...',
      abstentionNotice: 'Confidential boundaries remain enforced.',
    });
    expect(parsed.qaTabLabel).toContain('Chat with Andrew');
    expect(parsed.submitQaLabel).toMatch(/Send|Chat/i);
  });
});
