import { CONTACT_FORM_DEFINITION, SITE_CONTENT_KEYS, type SiteContentRow } from '@aklapper/core';
import { vi } from 'vitest';

import {
  createInitialSiteContentDraftState,
  evaluateSiteContentDraft,
  type SiteContentEditorDiagnosticEvent,
  siteContentDraftReducer,
  updateValueAtPath,
} from './siteContentDraftState';

function makeRow(
  key: string,
  metadataJson: Record<string, unknown>,
  markdownBody = '# Notes',
): SiteContentRow {
  return {
    key,
    markdownBody,
    metadataJson,
    updatedAt: '2026-11-24T22:00:00.000Z',
  };
}

const PORTAL_HOME_METADATA: Record<string, unknown> = {
  tuiTitle: 'launcher :: home',
  tuiBadge: { source: 'portal', state: 'ready', label: 'Ready' },
  heading: 'Andrew Klapper',
  description: 'Full-stack engineer.',
  actions: [{ label: 'Menu', to: '/menu', variant: 'primary' }],
};

describe('siteContentDraftState pure reducer & validation', () => {
  it('synchronizes Form edits to Raw JSON and Raw JSON edits back to Form while stripping retired keys on known schemas', () => {
    const row = makeRow(SITE_CONTENT_KEYS.portalHome, {
      ...PORTAL_HOME_METADATA,
      maintenanceModeDefault: true,
      customNote: 'strip-me',
    });
    const init = createInitialSiteContentDraftState(row);
    expect(init.state.mode).toBe('form');
    expect(init.schema).not.toBeNull();
    expect('maintenanceModeDefault' in init.state.draftObject).toBe(false);
    expect('customNote' in init.state.draftObject).toBe(false);

    const afterFormEdit = siteContentDraftReducer(init.state, {
      type: 'UPDATE_PATH',
      path: ['heading'],
      value: 'Updated Heading',
    });
    expect(afterFormEdit.draftObject['heading']).toBe('Updated Heading');

    const inJsonMode = siteContentDraftReducer(afterFormEdit, { type: 'SWITCH_TO_JSON' });
    expect(inJsonMode.mode).toBe('json');
    expect(inJsonMode.rawText).toContain('Updated Heading');
    expect(inJsonMode.rawText).not.toContain('strip-me');

    const editedJson = JSON.stringify(
      {
        ...afterFormEdit.draftObject,
        description: 'Edited in Raw JSON.',
        maintenanceModeDefault: true,
      },
      null,
      2,
    );
    const afterJsonEdit = siteContentDraftReducer(inJsonMode, {
      type: 'SET_RAW_TEXT',
      rawText: editedJson,
    });
    const backToForm = siteContentDraftReducer(afterJsonEdit, { type: 'SWITCH_TO_FORM' });
    expect(backToForm.mode).toBe('form');
    expect(backToForm.draftObject['description']).toBe('Edited in Raw JSON.');
    expect('maintenanceModeDefault' in backToForm.draftObject).toBe(false);
  });

  it('blocks switching to Form mode on malformed or non-object JSON without losing rawText', () => {
    const row = makeRow(SITE_CONTENT_KEYS.portalHome, PORTAL_HOME_METADATA);
    const { state } = createInitialSiteContentDraftState(row);
    const jsonState = siteContentDraftReducer(state, { type: 'SWITCH_TO_JSON' });

    const broken = siteContentDraftReducer(jsonState, {
      type: 'SET_RAW_TEXT',
      rawText: '{ invalid json',
    });
    const attempted = siteContentDraftReducer(broken, { type: 'SWITCH_TO_FORM' });
    expect(attempted.mode).toBe('json');
    expect(attempted.rawText).toBe('{ invalid json');
    expect(attempted.jsonParseError).toBeTruthy();

    const arrayJson = siteContentDraftReducer(jsonState, {
      type: 'SET_RAW_TEXT',
      rawText: '[]',
    });
    const attemptedArray = siteContentDraftReducer(arrayJson, { type: 'SWITCH_TO_FORM' });
    expect(attemptedArray.mode).toBe('json');
    expect(attemptedArray.rawText).toBe('[]');
    expect(attemptedArray.jsonParseError).toMatch(/object/i);
  });

  it('deletes optional properties when set to undefined instead of writing empty string or NaN', () => {
    const next = updateValueAtPath(
      { pageTitle: 'Portal', shortcutHint: 'Press m' },
      ['shortcutHint'],
      undefined,
    );
    expect('shortcutHint' in next).toBe(false);
    expect(next['pageTitle']).toBe('Portal');
  });

  it('maps Zod validation issues by path and disables submit until valid', () => {
    const row = makeRow(SITE_CONTENT_KEYS.portalChrome, {
      pageTitle: 'Portal',
      brandLabel: 'andrew-k.us',
      statusBadge: { source: 'portal', state: 'ready', label: 'Ready' },
      footerText: 'Solar Forge',
      footerLinkLabel: 'GitHub',
      footerLinkUrl: 'https://github.com/AndrewK4758',
    });
    const { state } = createInitialSiteContentDraftState(row);
    const invalid = siteContentDraftReducer(state, {
      type: 'UPDATE_PATH',
      path: ['footerLinkUrl'],
      value: 'not-a-url',
    });

    const evalInvalid = evaluateSiteContentDraft(invalid);
    expect(evalInvalid.canSubmit).toBe(false);
    expect(evalInvalid.issuesByPath['footerLinkUrl']?.length).toBeGreaterThan(0);
    expect(evalInvalid.previewObject['footerLinkUrl']).toBe('https://github.com/AndrewK4758');

    const fixed = siteContentDraftReducer(invalid, {
      type: 'UPDATE_PATH',
      path: ['footerLinkUrl'],
      value: 'https://andrew-k.us',
    });
    const evalFixed = evaluateSiteContentDraft(fixed);
    expect(evalFixed.canSubmit).toBe(true);
    expect(evalFixed.issues).toHaveLength(0);
    expect(evalFixed.previewObject['footerLinkUrl']).toBe('https://andrew-k.us');
  });

  it('falls back to Raw JSON mode for unknown keys and emits observability diagnostics on introspection failure', () => {
    const unknownEvents: SiteContentEditorDiagnosticEvent[] = [];
    const unknownRow = makeRow('custom-banner', { text: 'Hello' });
    const unknownInit = createInitialSiteContentDraftState(unknownRow, undefined, evt => {
      unknownEvents.push(evt);
    });
    expect(unknownInit.state.isKnownKey).toBe(false);
    expect(unknownInit.state.mode).toBe('json');
    expect(unknownInit.schema).toBeNull();
    expect(evaluateSiteContentDraft(unknownInit.state).canSubmit).toBe(true);
    expect(unknownEvents).toEqual([
      {
        event: 'admin.cms.site_content_editor_mode_branch',
        seamType: 'RULE_DIVERGENCE',
        key: 'custom-banner',
        branch: 'unknown-key-raw-json',
      },
    ]);

    const faultEvents: SiteContentEditorDiagnosticEvent[] = [];
    const contactRow = makeRow(SITE_CONTENT_KEYS.portalContact, {
      windowTitle: 'Contact',
      statusBadge: { source: 'contact', state: 'ready', label: 'PG19' },
      description: 'Reach out',
      form: CONTACT_FORM_DEFINITION,
    });
    const faultInit = createInitialSiteContentDraftState(
      contactRow,
      () => {
        throw new Error('Synthetic introspection failure');
      },
      evt => {
        faultEvents.push(evt);
      },
    );
    expect(faultInit.state.introspectionFailed).toBe(true);
    expect(faultInit.state.mode).toBe('json');
    expect(faultInit.introspectionError).toContain('Synthetic introspection failure');
    expect(faultEvents).toEqual([
      {
        event: 'admin.cms.site_content_schema_introspect_fallback',
        seamType: 'BOUNDARY_FAULT',
        key: SITE_CONTENT_KEYS.portalContact,
        reason: 'Synthetic introspection failure',
      },
      {
        event: 'admin.cms.site_content_editor_mode_branch',
        seamType: 'RULE_DIVERGENCE',
        key: SITE_CONTENT_KEYS.portalContact,
        branch: 'known-schema-raw-json',
      },
    ]);

    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    try {
      const homeRow = makeRow(SITE_CONTENT_KEYS.portalHome, PORTAL_HOME_METADATA);
      createInitialSiteContentDraftState(homeRow);
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('"event":"admin.cms.site_content_editor_mode_branch"'),
      );
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('hydrates flat portal-cadence .default(...) fields on both initial load and SWITCH_TO_FORM', () => {
    const legacy4FieldRow = makeRow(SITE_CONTENT_KEYS.portalCadence, {
      windowTitle: 'CADENCE Sandbox',
      statusBadge: { source: 'cadence', state: 'idle', label: 'Standby' },
      description: 'Interactive showcase.',
      iframeTitle: 'CADENCE Artifact Preview',
    });

    const init = createInitialSiteContentDraftState(legacy4FieldRow);
    expect(init.state.mode).toBe('form');
    expect(init.state.draftObject['modeBadgeGoldenLabel']).toBe('Golden Showcase');
    expect(init.state.draftObject['tabSpecLabel']).toBe('Spec');
    expect(init.state.draftObject['goldenShowcaseHeading']).toBe('Featured CADENCE Showcases');

    const jsonMode = siteContentDraftReducer(init.state, { type: 'SWITCH_TO_JSON' });
    const strippedTo4Fields = siteContentDraftReducer(jsonMode, {
      type: 'SET_RAW_TEXT',
      rawText: JSON.stringify(legacy4FieldRow.metadataJson, null, 2),
    });
    const backToForm = siteContentDraftReducer(strippedTo4Fields, { type: 'SWITCH_TO_FORM' });
    expect(backToForm.mode).toBe('form');
    expect(backToForm.draftObject['modeBadgeGoldenLabel']).toBe('Golden Showcase');
    expect(backToForm.draftObject['tabGateAuditLabel']).toBe('Gate Audit');
    expect(backToForm.draftObject['recentRunsHeading']).toBe('Recent Session Runs');
  });
});
