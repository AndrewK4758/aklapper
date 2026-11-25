import type { AdminCmsLoaderData, CadencePreset } from '@aklapper/core';
import { Button, Field, LazyChunkBoundary, Separator } from '@aklapper/ui';
import { lazy, useState } from 'react';
import { Form } from 'react-router';

import { AgensiCacheSection } from './AgensiCacheSection';

import styles from './AdminCmsPage.module.css';

const LazySandboxedArtifactFrame = lazy(() =>
  import('@aklapper/ui/sandboxed-artifact-frame').then(mod => ({
    default: mod.SandboxedArtifactFrame,
  })),
);

export interface CmsAgensiPresetsTabProps {
  readonly data: Pick<AdminCmsLoaderData, 'agensiSkills' | 'agensiSyncState' | 'cadencePresets'>;
}

export function CmsAgensiPresetsTab({ data }: CmsAgensiPresetsTabProps) {
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string>(
    data.cadencePresets[0]?.slug ?? '',
  );
  const [previewDraftHtml, setPreviewDraftHtml] = useState<string | null>(null);

  const selectedPreset: CadencePreset | null =
    data.cadencePresets.find(item => item.slug === selectedPresetSlug) ??
    data.cadencePresets[0] ??
    null;

  const activePreviewHtml = previewDraftHtml ?? selectedPreset?.starterArtifactHtml ?? '';

  return (
    <>
      <AgensiCacheSection
        skills={data.agensiSkills}
        syncState={data.agensiSyncState}
        styles={styles}
      />

      <Separator.Root />

      <section className={styles.card} aria-label='CADENCE presets'>
        <div className={styles.cardHeader}>
          <h2 className={styles.sectionTitle}>CADENCE Presets ({data.cadencePresets.length})</h2>
          <Button.Root
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => {
              setSelectedPresetSlug('');
              setPreviewDraftHtml('');
            }}
          >
            <Button.Label>New Preset</Button.Label>
          </Button.Root>
        </div>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Title</th>
              <th>Order</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.cadencePresets.map(preset => (
              <tr key={preset.slug}>
                <td>
                  <code>{preset.slug}</code>
                </td>
                <td>{preset.title}</td>
                <td>{preset.sortOrder}</td>
                <td className={styles.actionCell} aria-label={`Actions for ${preset.slug}`}>
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setSelectedPresetSlug(preset.slug);
                      setPreviewDraftHtml(preset.starterArtifactHtml);
                    }}
                  >
                    <Button.Label>Edit &amp; Preview</Button.Label>
                  </Button.Root>
                  <Form method='post'>
                    <input type='hidden' name='intent' value='delete-cadence-preset' />
                    <input type='hidden' name='slug' value={preset.slug} />
                    <Button.Root type='submit' variant='danger' size='sm'>
                      <Button.Label>Delete</Button.Label>
                    </Button.Root>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.splitGrid}>
          <Form key={selectedPresetSlug || 'new-preset'} method='post' className={styles.stackForm}>
            <input type='hidden' name='intent' value='upsert-cadence-preset' />
            <div className={styles.formGrid}>
              <Field.Root>
                <Field.Label>Slug</Field.Label>
                <Field.Control
                  name='slug'
                  defaultValue={selectedPresetSlug ? (selectedPreset?.slug ?? '') : ''}
                  placeholder='preset-slug'
                  required
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Title</Field.Label>
                <Field.Control
                  name='title'
                  defaultValue={selectedPresetSlug ? (selectedPreset?.title ?? '') : ''}
                  required
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Expected Kind</Field.Label>
                <Field.Control
                  name='expectedKind'
                  defaultValue={
                    selectedPresetSlug ? (selectedPreset?.expectedKind ?? 'html') : 'html'
                  }
                  required
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Sort Order</Field.Label>
                <Field.Control
                  name='sortOrder'
                  type='number'
                  defaultValue={
                    selectedPresetSlug
                      ? (selectedPreset?.sortOrder ?? 1)
                      : data.cadencePresets.length + 1
                  }
                  required
                />
              </Field.Root>
            </div>
            <Field.Root>
              <Field.Label>Starter Prompt</Field.Label>
              <textarea
                name='starterPrompt'
                className={styles.textarea}
                defaultValue={selectedPresetSlug ? (selectedPreset?.starterPrompt ?? '') : ''}
                required
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Starter Artifact HTML</Field.Label>
              <textarea
                name='starterArtifactHtml'
                className={styles.textarea}
                value={activePreviewHtml}
                onChange={event => {
                  setPreviewDraftHtml(event.target.value);
                }}
                required
              />
            </Field.Root>
            <div>
              <Button.Root type='submit' variant='primary' size='sm'>
                <Button.Label>Save CADENCE Preset</Button.Label>
              </Button.Root>
            </div>
          </Form>

          <div className={styles.previewWrap}>
            <span className={styles.muted}>Live SandboxedArtifactFrame Preview</span>
            <LazyChunkBoundary
              loadingLabel='Loading sandboxed preview...'
              errorTitle='Unable to load sandboxed artifact preview'
            >
              <LazySandboxedArtifactFrame
                title={`CADENCE Preset Preview: ${selectedPreset?.title ?? 'Draft'}`}
                srcDoc={
                  activePreviewHtml ||
                  '<html><body><p>Enter starter artifact HTML to preview inside sandbox.</p></body></html>'
                }
              />
            </LazyChunkBoundary>
          </div>
        </div>
      </section>
    </>
  );
}
