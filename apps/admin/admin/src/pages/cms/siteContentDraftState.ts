import {
  introspectSiteContentSchema,
  isKnownSiteContentKey,
  type JsonSchemaObject,
  type SiteContentKey,
  type SiteContentRow,
  type SiteContentValidationIssue,
  validateSiteContentMetadata,
} from '@aklapper/core';

export type SiteContentEditorMode = 'form' | 'json';

export interface SiteContentDraftState {
  readonly key: string;
  readonly isKnownKey: boolean;
  readonly mode: SiteContentEditorMode;
  readonly markdownBody: string;
  readonly draftObject: Record<string, unknown>;
  readonly rawText: string;
  readonly jsonParseError: string | null;
  readonly lastValidPreviewObject: Record<string, unknown>;
  readonly introspectionFailed: boolean;
}

export type SiteContentDraftAction =
  | { readonly type: 'SET_MARKDOWN'; readonly markdownBody: string }
  | {
      readonly type: 'UPDATE_PATH';
      readonly path: readonly (string | number)[];
      readonly value: unknown;
    }
  | { readonly type: 'SET_RAW_TEXT'; readonly rawText: string }
  | { readonly type: 'SWITCH_TO_JSON' }
  | { readonly type: 'SWITCH_TO_FORM' };

export interface InitialSiteContentDraftResult {
  readonly state: SiteContentDraftState;
  readonly schema: JsonSchemaObject | null;
  readonly introspectionError: string | null;
}

export interface EvaluatedSiteContentDraft {
  readonly canSubmit: boolean;
  readonly jsonParseError: string | null;
  readonly issues: readonly SiteContentValidationIssue[];
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly activeObject: Record<string, unknown> | null;
  readonly previewObject: Record<string, unknown>;
  readonly serializedMetadataJson: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function parsePlainJsonObject(
  rawText: string,
):
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly ok: false; readonly error: string } {
  try {
    const parsed: unknown = JSON.parse(rawText);
    if (!isPlainRecord(parsed)) {
      return {
        ok: false,
        error: 'Metadata JSON must be a plain JSON object (for example { "heading": "..." }).',
      };
    }
    return { ok: true, value: parsed };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Invalid JSON syntax.';
    return { ok: false, error: `Invalid JSON: ${detail}` };
  }
}

function updateNodeImmutable(
  current: unknown,
  path: readonly (string | number)[],
  index: number,
  value: unknown,
): unknown {
  if (index >= path.length) {
    return value;
  }

  const segment = path[index];
  if (typeof segment === 'number') {
    const list = Array.isArray(current) ? [...current] : [];
    list[segment] = updateNodeImmutable(list[segment], path, index + 1, value);
    return list;
  }

  const record = isPlainRecord(current) ? { ...current } : {};
  if (index === path.length - 1 && value === undefined) {
    delete record[String(segment)];
    return record;
  }

  record[String(segment)] = updateNodeImmutable(record[String(segment)], path, index + 1, value);
  return record;
}

export function updateValueAtPath(
  root: Record<string, unknown>,
  path: readonly (string | number)[],
  value: unknown,
): Record<string, unknown> {
  if (path.length === 0) {
    return isPlainRecord(value) ? { ...value } : { ...root };
  }
  const updated = updateNodeImmutable(root, path, 0, value);
  return isPlainRecord(updated) ? updated : { ...root };
}

export function createInitialSiteContentDraftState(
  row: SiteContentRow,
  introspect: (key: SiteContentKey) => JsonSchemaObject = introspectSiteContentSchema,
): InitialSiteContentDraftResult {
  const known = isKnownSiteContentKey(row.key);
  const initialObject = isPlainRecord(row.metadataJson) ? { ...row.metadataJson } : {};
  const rawText = JSON.stringify(initialObject, null, 2);

  let schema: JsonSchemaObject | null = null;
  let introspectionError: string | null = null;
  let introspectionFailed = false;

  if (isKnownSiteContentKey(row.key)) {
    try {
      schema = introspect(row.key);
    } catch (error) {
      introspectionFailed = true;
      introspectionError =
        error instanceof Error ? error.message : 'Failed to introspect site_content schema.';
    }
  }

  return {
    schema,
    introspectionError,
    state: {
      key: row.key,
      isKnownKey: known,
      mode: known && !introspectionFailed ? 'form' : 'json',
      markdownBody: row.markdownBody,
      draftObject: initialObject,
      rawText,
      jsonParseError: null,
      lastValidPreviewObject: initialObject,
      introspectionFailed,
    },
  };
}

export function siteContentDraftReducer(
  state: SiteContentDraftState,
  action: SiteContentDraftAction,
): SiteContentDraftState {
  switch (action.type) {
    case 'SET_MARKDOWN':
      return { ...state, markdownBody: action.markdownBody };

    case 'UPDATE_PATH': {
      const nextDraft = updateValueAtPath(state.draftObject, action.path, action.value);
      const validation = validateSiteContentMetadata(state.key, nextDraft);
      return {
        ...state,
        draftObject: nextDraft,
        rawText: JSON.stringify(nextDraft, null, 2),
        jsonParseError: null,
        lastValidPreviewObject: validation.ok ? nextDraft : state.lastValidPreviewObject,
      };
    }

    case 'SET_RAW_TEXT': {
      const parsed = parsePlainJsonObject(action.rawText);
      if (!parsed.ok) {
        return {
          ...state,
          rawText: action.rawText,
          jsonParseError: parsed.error,
        };
      }
      const validation = validateSiteContentMetadata(state.key, parsed.value);
      return {
        ...state,
        rawText: action.rawText,
        draftObject: parsed.value,
        jsonParseError: null,
        lastValidPreviewObject: validation.ok ? parsed.value : state.lastValidPreviewObject,
      };
    }

    case 'SWITCH_TO_JSON':
      return {
        ...state,
        mode: 'json',
        rawText: JSON.stringify(state.draftObject, null, 2),
        jsonParseError: null,
      };

    case 'SWITCH_TO_FORM': {
      if (!state.isKnownKey || state.introspectionFailed) {
        return state;
      }
      const parsed = parsePlainJsonObject(state.rawText);
      if (!parsed.ok) {
        return {
          ...state,
          mode: 'json',
          jsonParseError: parsed.error,
        };
      }
      const validation = validateSiteContentMetadata(state.key, parsed.value);
      return {
        ...state,
        mode: 'form',
        draftObject: parsed.value,
        jsonParseError: null,
        lastValidPreviewObject: validation.ok ? parsed.value : state.lastValidPreviewObject,
      };
    }
  }
}

export function evaluateSiteContentDraft(state: SiteContentDraftState): EvaluatedSiteContentDraft {
  if (state.mode === 'json') {
    const parsed = parsePlainJsonObject(state.rawText);
    if (!parsed.ok) {
      return {
        canSubmit: false,
        jsonParseError: parsed.error,
        issues: [],
        issuesByPath: {},
        activeObject: null,
        previewObject: state.lastValidPreviewObject,
        serializedMetadataJson: state.rawText,
      };
    }
    const validation = validateSiteContentMetadata(state.key, parsed.value);
    if (!validation.ok) {
      return {
        canSubmit: false,
        jsonParseError: null,
        issues: validation.issues,
        issuesByPath: groupIssuesByPath(validation.issues),
        activeObject: parsed.value,
        previewObject: state.lastValidPreviewObject,
        serializedMetadataJson: state.rawText,
      };
    }
    return {
      canSubmit: true,
      jsonParseError: null,
      issues: [],
      issuesByPath: {},
      activeObject: parsed.value,
      previewObject: parsed.value,
      serializedMetadataJson: state.rawText,
    };
  }

  const validation = validateSiteContentMetadata(state.key, state.draftObject);
  const serialized = JSON.stringify(state.draftObject, null, 2);
  if (!validation.ok) {
    return {
      canSubmit: false,
      jsonParseError: null,
      issues: validation.issues,
      issuesByPath: groupIssuesByPath(validation.issues),
      activeObject: state.draftObject,
      previewObject: state.lastValidPreviewObject,
      serializedMetadataJson: serialized,
    };
  }

  return {
    canSubmit: true,
    jsonParseError: null,
    issues: [],
    issuesByPath: {},
    activeObject: state.draftObject,
    previewObject: state.draftObject,
    serializedMetadataJson: serialized,
  };
}

function groupIssuesByPath(
  issues: readonly SiteContentValidationIssue[],
): Readonly<Record<string, readonly string[]>> {
  const grouped: Record<string, string[]> = {};
  for (const issue of issues) {
    const bucket = grouped[issue.pathKey] ?? [];
    bucket.push(issue.message);
    grouped[issue.pathKey] = bucket;
  }
  return grouped;
}
