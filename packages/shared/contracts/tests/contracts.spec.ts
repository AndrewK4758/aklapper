import {
  AnalyticsBatchSchema,
  CadenceRunRequestSchema,
  collectFormFields,
  CONTACT_FORM_DEFINITION,
  CONTACT_MAX_FILE_BYTES,
  ContactFormSubmissionSchema,
  FormDefinitionSchema,
  K8sPodEventSchema,
  MenuItemSchema,
  Osc7501StatusSchema,
  PortalChromeContentSchema,
  resolveAllowedMimeType,
  sanitizeFilename,
  TerminalProfileDataSchema,
  validateFormValues,
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
});
