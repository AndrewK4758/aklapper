import {
  CAREER_DOSSIER_KINDS,
  type CareerDossier,
  type CareerDossierKind,
  type PrivacySanitizationFinding,
  type QdrantHealthStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  CitationSourceList,
  Field,
  OscStatusBadge,
  Separator,
  ValidationGatePreview,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import { Form, type FetcherWithComponents, useFetcher } from 'react-router';

import type { AdminCmsActionData } from './AdminCmsPage';
import { CareerDossierImportControls } from './CareerDossierImportControls';
import {
  buildDossierPreviewChunks,
  createBlankDossierDraft,
  draftFromCareerDossier,
  type DraftEditorValues,
  type ParsedDossierMarkdown,
} from './careerDossierMarkdown';
import { CareerDossierTable } from './CareerDossierTable';

import cardStyles from '../shared/adminSectionCard.module.css';
import styles from './AdminCmsPage.module.css';

export interface CareerDossierSectionProps {
  readonly dossiers: readonly CareerDossier[];
  readonly qdrant?: QdrantHealthStatus;
  readonly qdrantStatusSlot?: ReactNode;
  readonly sanitizationFindings?: readonly PrivacySanitizationFinding[];
  readonly reindexFetcher?: FetcherWithComponents<AdminCmsActionData>;
}

export function CareerDossierSection({
  dossiers,
  qdrant,
  qdrantStatusSlot,
  sanitizationFindings = [],
  reindexFetcher: sharedReindexFetcher,
}: CareerDossierSectionProps) {
  const localReindexFetcher = useFetcher<AdminCmsActionData>();
  const reindexFetcher = sharedReindexFetcher ?? localReindexFetcher;
  const standaloneReindexFeedback = !sharedReindexFetcher ? localReindexFetcher.data : undefined;
  const [draft, setDraft] = useState<DraftEditorValues>(() =>
    dossiers[0] ? draftFromCareerDossier(dossiers[0]) : createBlankDossierDraft(dossiers.length),
  );

  const previewChunks = buildDossierPreviewChunks(draft);
  const chunkCount = Math.max(1, previewChunks.length);
  const gatePassed = sanitizationFindings.length === 0;

  function applyParsedMarkdown(parsed: ParsedDossierMarkdown) {
    setDraft(prev => ({
      ...prev,
      slug: parsed.slug,
      kind: parsed.kind,
      title: parsed.title,
      domainLabel: parsed.domainLabel,
      roleTitle: parsed.roleTitle,
      timeframe: parsed.timeframe,
      skillsCsv: parsed.skills.join(', '),
      summaryBody: parsed.summaryBody,
      sections: [...parsed.sections],
      publishStatus: 'draft',
    }));
  }

  return (
    <section className={cardStyles.card} aria-label='Career Dossier Studio'>
      <div className={cardStyles.cardHeader}>
        <h2 className={cardStyles.sectionTitle}>Career Dossier Studio ({dossiers.length})</h2>
        <div className={styles.actionCell}>
          <Button.Root
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => {
              setDraft(createBlankDossierDraft(dossiers.length + 1));
            }}
          >
            <Button.Label>+ New Dossier Draft</Button.Label>
          </Button.Root>
          <reindexFetcher.Form method='post' className={styles.inlineForm}>
            <input type='hidden' name='intent' value='reindex-qdrant' />
            {qdrantStatusSlot ?? (
              <OscStatusBadge
                source='qdrant-dossiers'
                state={qdrant?.online ? 'ready' : 'idle'}
                label={
                  qdrant?.online
                    ? `${qdrant.collection}: ${qdrant.pointsCount} pts`
                    : 'Qdrant offline'
                }
              />
            )}
            <Button.Root
              type='submit'
              variant='primary'
              size='sm'
              disabled={reindexFetcher.state !== 'idle'}
            >
              <Button.Label>
                {reindexFetcher.state === 'idle' ? 'Re-Index Qdrant Corpus' : 'Re-Indexing...'}
              </Button.Label>
            </Button.Root>
          </reindexFetcher.Form>
        </div>
      </div>

      {standaloneReindexFeedback ? <ActionFeedbackBanner {...standaloneReindexFeedback} /> : null}

      <CareerDossierTable
        dossiers={dossiers}
        onEdit={dossier => {
          setDraft(draftFromCareerDossier(dossier));
        }}
      />

      <Separator />

      <CareerDossierImportControls onApplyParsedMarkdown={applyParsedMarkdown} />

      <Separator />

      <div className={styles.splitGrid}>
        <Form method='post' className={styles.stackForm}>
          <input type='hidden' name='intent' value='upsert-career-dossier' />
          <input type='hidden' name='sectionsJson' value={JSON.stringify(draft.sections)} />

          <div className={styles.formGrid}>
            <Field.Root>
              <Field.Label>Slug</Field.Label>
              <Field.Control
                name='slug'
                value={draft.slug}
                placeholder='cloud-platform-lead'
                required
                onChange={event => {
                  setDraft(prev => ({ ...prev, slug: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Kind</Field.Label>
              <select
                name='kind'
                aria-label='Dossier Kind'
                className={styles.selectControl}
                value={draft.kind}
                onChange={event => {
                  setDraft(prev => ({ ...prev, kind: event.target.value as CareerDossierKind }));
                }}
              >
                {CAREER_DOSSIER_KINDS.map(kind => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </Field.Root>

            <Field.Root>
              <Field.Label>Title</Field.Label>
              <Field.Control
                name='title'
                value={draft.title}
                required
                onChange={event => {
                  setDraft(prev => ({ ...prev, title: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Domain Label (Anonymized)</Field.Label>
              <Field.Control
                name='domainLabel'
                value={draft.domainLabel}
                placeholder='Enterprise Cloud & Platform'
                required
                onChange={event => {
                  setDraft(prev => ({ ...prev, domainLabel: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Role Title</Field.Label>
              <Field.Control
                name='roleTitle'
                value={draft.roleTitle}
                placeholder='Principal Platform Architect'
                required
                onChange={event => {
                  setDraft(prev => ({ ...prev, roleTitle: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Timeframe</Field.Label>
              <Field.Control
                name='timeframe'
                value={draft.timeframe}
                placeholder='2023-2026'
                required
                onChange={event => {
                  setDraft(prev => ({ ...prev, timeframe: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Skills (comma-separated)</Field.Label>
              <Field.Control
                name='skills'
                value={draft.skillsCsv}
                placeholder='Go, TypeScript, PG19, K8s'
                onChange={event => {
                  setDraft(prev => ({ ...prev, skillsCsv: event.target.value }));
                }}
              />
            </Field.Root>

            <Field.Root>
              <Field.Label>Sort Order</Field.Label>
              <Field.Control
                name='sortOrder'
                type='number'
                min={0}
                max={1000}
                value={draft.sortOrder}
                onChange={event => {
                  setDraft(prev => ({ ...prev, sortOrder: Number(event.target.value || 0) }));
                }}
              />
            </Field.Root>
          </div>

          <Field.Root>
            <Field.Label>Summary Body (Chunk #0)</Field.Label>
            <textarea
              name='summaryBody'
              className={styles.textarea}
              value={draft.summaryBody}
              required
              onChange={event => {
                setDraft(prev => ({ ...prev, summaryBody: event.target.value }));
              }}
            />
          </Field.Root>

          <div className={styles.stackForm}>
            <div className={cardStyles.cardHeader}>
              <span className={styles.muted}>Sections ({draft.sections.length})</span>
              <Button.Root
                type='button'
                variant='secondary'
                size='sm'
                onClick={() => {
                  setDraft(prev => ({
                    ...prev,
                    sections: [...prev.sections, { heading: 'New Section', body: '' }],
                  }));
                }}
              >
                <Button.Label>+ Add Section</Button.Label>
              </Button.Root>
            </div>
            {draft.sections.map((section, index) => (
              <div key={index} className={cardStyles.card}>
                <div className={cardStyles.cardHeader}>
                  <span className={styles.muted}>Chunk #{index + 1}</span>
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setDraft(prev => ({
                        ...prev,
                        sections: prev.sections.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    <Button.Label>Remove Section</Button.Label>
                  </Button.Root>
                </div>
                <Field.Root>
                  <Field.Label>Section Heading</Field.Label>
                  <Field.Control
                    value={section.heading}
                    onChange={event => {
                      const nextHeading = event.target.value;
                      setDraft(prev => ({
                        ...prev,
                        sections: prev.sections.map((item, i) =>
                          i === index ? { ...item, heading: nextHeading } : item,
                        ),
                      }));
                    }}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Section Body</Field.Label>
                  <textarea
                    className={styles.textarea}
                    value={section.body}
                    onChange={event => {
                      const nextBody = event.target.value;
                      setDraft(prev => ({
                        ...prev,
                        sections: prev.sections.map((item, i) =>
                          i === index ? { ...item, body: nextBody } : item,
                        ),
                      }));
                    }}
                  />
                </Field.Root>
              </div>
            ))}
          </div>

          <div>
            <Button.Root type='submit' variant='primary' size='sm'>
              <Button.Label>Save Sanitized Draft</Button.Label>
            </Button.Root>
          </div>
        </Form>

        <div className={styles.previewWrap}>
          <ValidationGatePreview
            passed={gatePassed}
            findings={sanitizationFindings}
            chunkCount={chunkCount}
            publishStatus={draft.publishStatus}
            testId='dossier-validation-gate'
          />
          <CitationSourceList
            heading='Deterministic Chunk Preview'
            sources={previewChunks}
            defaultOpen={true}
            testId='dossier-chunk-preview'
          />
        </div>
      </div>
    </section>
  );
}
