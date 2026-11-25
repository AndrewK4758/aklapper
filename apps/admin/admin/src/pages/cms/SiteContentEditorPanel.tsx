import { isKnownSiteContentKey, SITE_CONTENT_METADATA, type SiteContentRow } from '@aklapper/core';
import {
  Button,
  cx,
  LazyChunkBoundary,
  lazyWithRetry,
  type SiteContentPreviewViewport,
} from '@aklapper/ui';
import { useReducer, useState } from 'react';
import { Form } from 'react-router';

import { reportAdminLazyChunkError } from '../client-telemetry';
import { JsonSchemaFormRenderer } from './JsonSchemaFormRenderer';
import {
  createInitialSiteContentDraftState,
  emitSiteContentDiagnostic,
  evaluateSiteContentDraft,
  parsePlainJsonObject,
  siteContentDraftReducer,
} from './siteContentDraftState';

import styles from './SiteContentEditor.module.css';

const LazySiteContentPreviewPane = lazyWithRetry(() =>
  import('./SiteContentPreviewPane').then(mod => ({ default: mod.SiteContentPreviewPane })),
);

export interface SiteContentEditorPanelProps {
  readonly siteContents: readonly SiteContentRow[];
}

interface SiteContentEditorSessionProps {
  readonly row: SiteContentRow;
  readonly previewOpen: boolean;
  readonly previewViewport: SiteContentPreviewViewport;
  readonly onTogglePreview: () => void;
  readonly onViewportChange: (viewport: SiteContentPreviewViewport) => void;
}

function SiteContentEditorSession({
  row,
  previewOpen,
  previewViewport,
  onTogglePreview,
  onViewportChange,
}: SiteContentEditorSessionProps) {
  const [initialBundle] = useState(() => createInitialSiteContentDraftState(row));
  const [draft, dispatch] = useReducer(siteContentDraftReducer, initialBundle.state);
  const evaluated = evaluateSiteContentDraft(draft);
  const keyMeta = isKnownSiteContentKey(row.key) ? SITE_CONTENT_METADATA[row.key] : null;

  return (
    <div className={cx(styles.editorGrid, previewOpen && styles.editorGridSplit)}>
      <Form method='post' className={styles.formStack}>
        <input type='hidden' name='intent' value='upsert-site-content' />
        <input type='hidden' name='key' value={row.key} />
        <input type='hidden' name='metadataJson' value={evaluated.serializedMetadataJson} />

        <div className={styles.toolbar}>
          <div>
            <strong>{keyMeta?.label ?? row.key}</strong>{' '}
            <span className={styles.helperText}>
              <code>{row.key}</code> · updated {new Date(row.updatedAt).toLocaleString()}
            </span>
          </div>
          <div className={styles.toolbarGroup}>
            {draft.isKnownKey && !draft.introspectionFailed ? (
              <>
                <Button.Root
                  type='button'
                  variant={draft.mode === 'form' ? 'primary' : 'secondary'}
                  size='xs'
                  aria-pressed={draft.mode === 'form'}
                  onClick={() => {
                    if (draft.mode !== 'form' && parsePlainJsonObject(draft.rawText).ok) {
                      emitSiteContentDiagnostic({
                        event: 'admin.cms.site_content_editor_mode_branch',
                        seamType: 'RULE_DIVERGENCE',
                        key: row.key,
                        branch: 'known-schema-form',
                      });
                    }
                    dispatch({ type: 'SWITCH_TO_FORM' });
                  }}
                >
                  <Button.Label>Form</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant={draft.mode === 'json' ? 'primary' : 'secondary'}
                  size='xs'
                  aria-pressed={draft.mode === 'json'}
                  onClick={() => {
                    if (draft.mode !== 'json') {
                      emitSiteContentDiagnostic({
                        event: 'admin.cms.site_content_editor_mode_branch',
                        seamType: 'RULE_DIVERGENCE',
                        key: row.key,
                        branch: 'known-schema-raw-json',
                      });
                    }
                    dispatch({ type: 'SWITCH_TO_JSON' });
                  }}
                >
                  <Button.Label>Raw JSON</Button.Label>
                </Button.Root>
              </>
            ) : null}
            {!previewOpen ? (
              <Button.Root type='button' variant='secondary' size='xs' onClick={onTogglePreview}>
                <Button.Label>Show Preview</Button.Label>
              </Button.Root>
            ) : null}
          </div>
        </div>

        {!draft.isKnownKey ? (
          <p className={styles.noticeBanner}>
            Custom key <code>{row.key}</code> is not in the typed schema registry. Editing in Raw
            JSON fallback mode.
          </p>
        ) : null}

        {initialBundle.introspectionError ? (
          <div className={styles.alertBox} role='alert'>
            Schema introspection fallback active: {initialBundle.introspectionError}
          </div>
        ) : null}

        {draft.jsonParseError || evaluated.jsonParseError ? (
          <div className={styles.alertBox} role='alert'>
            {draft.jsonParseError ?? evaluated.jsonParseError}
          </div>
        ) : null}

        {evaluated.issues.length > 0 ? (
          <div className={styles.alertBox} role='alert'>
            <strong>Fix validation errors before saving:</strong>
            <ul className={styles.alertList}>
              {evaluated.issues.map((issue, idx) => (
                <li key={`${issue.pathKey}-${idx}`}>
                  <code>{issue.pathKey || 'root'}</code>: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor='site-content-markdown-body'>
            Qdrant RAG Corpus Note (Markdown)
          </label>
          <p className={styles.helperText} id='site-content-markdown-help'>
            Indexed into Qdrant by <code>LoadCorpusDocs</code> for AI Ask semantic search. Not
            rendered in the public portal or admin UI.
          </p>
          <textarea
            id='site-content-markdown-body'
            name='markdownBody'
            className={styles.textarea}
            aria-describedby='site-content-markdown-help'
            value={draft.markdownBody}
            onChange={event => {
              dispatch({ type: 'SET_MARKDOWN', markdownBody: event.target.value });
            }}
          />
        </div>

        {draft.mode === 'form' && initialBundle.schema ? (
          <JsonSchemaFormRenderer
            schema={initialBundle.schema}
            value={draft.draftObject}
            issuesByPath={evaluated.issuesByPath}
            onChange={(path, value) => {
              dispatch({ type: 'UPDATE_PATH', path, value });
            }}
          />
        ) : (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor='site-content-raw-json'>
              Raw Metadata JSON
            </label>
            <textarea
              id='site-content-raw-json'
              className={cx(styles.textarea, styles.textareaJson)}
              value={draft.rawText}
              aria-invalid={Boolean(draft.jsonParseError || evaluated.issues.length > 0)}
              onChange={event => {
                dispatch({ type: 'SET_RAW_TEXT', rawText: event.target.value });
              }}
            />
          </div>
        )}

        <div>
          <Button.Root type='submit' variant='primary' size='sm' disabled={!evaluated.canSubmit}>
            <Button.Label>Save Site Content</Button.Label>
          </Button.Root>
        </div>
      </Form>

      {previewOpen ? (
        <LazyChunkBoundary
          loadingLabel='Loading live preview...'
          errorTitle='Unable to load live preview'
          onChunkError={error => {
            reportAdminLazyChunkError('./SiteContentPreviewPane', '/cms', error);
          }}
        >
          <LazySiteContentPreviewPane
            contentKey={row.key}
            metadata={evaluated.previewObject}
            viewport={previewViewport}
            hasValidationErrors={!evaluated.canSubmit}
            onViewportChange={onViewportChange}
            onClose={onTogglePreview}
          />
        </LazyChunkBoundary>
      ) : null}
    </div>
  );
}

export function SiteContentEditorPanel({ siteContents }: SiteContentEditorPanelProps) {
  const [selectedSiteKey, setSelectedSiteKey] = useState<string>(
    siteContents[0]?.key ?? 'portal-home',
  );
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewViewport, setPreviewViewport] = useState<SiteContentPreviewViewport>('desktop');

  const selectedSiteRow =
    siteContents.find(row => row.key === selectedSiteKey) ?? siteContents[0] ?? null;

  return (
    <div className={styles.workspace}>
      <nav className={styles.keyList} aria-label='Site content keys'>
        {siteContents.map(row => {
          const meta = isKnownSiteContentKey(row.key) ? SITE_CONTENT_METADATA[row.key] : null;
          return (
            <button
              key={row.key}
              type='button'
              className={styles.keyButton}
              data-selected={selectedSiteRow?.key === row.key ? 'true' : 'false'}
              onClick={() => {
                setSelectedSiteKey(row.key);
              }}
            >
              <span>{row.key}</span>
              <span className={styles.keyMeta}>{meta ? meta.label : 'Custom JSON'}</span>
            </button>
          );
        })}
      </nav>

      {selectedSiteRow ? (
        <SiteContentEditorSession
          key={`${selectedSiteRow.key}:${selectedSiteRow.updatedAt}`}
          row={selectedSiteRow}
          previewOpen={previewOpen}
          previewViewport={previewViewport}
          onTogglePreview={() => {
            setPreviewOpen(prev => !prev);
          }}
          onViewportChange={setPreviewViewport}
        />
      ) : null}
    </div>
  );
}
