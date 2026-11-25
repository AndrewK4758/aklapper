import { Button, Field } from '@aklapper/ui';
import { useState } from 'react';
import { Form } from 'react-router';

import { parseCareerDossierMarkdown, type ParsedDossierMarkdown } from './careerDossierMarkdown';

import styles from './AdminCmsPage.module.css';

export interface CareerDossierImportControlsProps {
  readonly onApplyParsedMarkdown: (parsed: ParsedDossierMarkdown) => void;
}

export function CareerDossierImportControls({
  onApplyParsedMarkdown,
}: CareerDossierImportControlsProps) {
  const [pasteText, setPasteText] = useState('');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  function handleParseMarkdown() {
    if (!pasteText.trim()) {
      setPasteNotice('Paste markdown with optional metadata lines and ## section headings first.');
      return;
    }
    const parsed = parseCareerDossierMarkdown(pasteText);
    onApplyParsedMarkdown(parsed);
    setPasteNotice(
      `Loaded "${parsed.title}" (${parsed.sections.length} section(s), ${1 + parsed.sections.length} chunks) into the editor form.`,
    );
  }

  return (
    <div className={styles.splitGrid}>
      <div className={styles.stackForm}>
        <Field.Root>
          <Field.Label>Markdown Paste-Import (splits ## / ### headings into sections)</Field.Label>
          <textarea
            aria-label='Markdown paste import'
            className={styles.textarea}
            placeholder={
              '# Platform Modernization\nKind: architecture\nDomain: Financial Services\nRole: Principal Architect\nTimeframe: 2023-2026\nSkills: Go, TypeScript, PG19, K8s\n\nSummary paragraph...\n\n## Database Reliability\nSection details...'
            }
            value={pasteText}
            onChange={event => {
              setPasteText(event.target.value);
            }}
          />
        </Field.Root>
        <div className={styles.actionCell}>
          <Button.Root type='button' variant='secondary' size='sm' onClick={handleParseMarkdown}>
            <Button.Label>Parse Markdown into Form</Button.Label>
          </Button.Root>
          {pasteNotice ? <span className={styles.muted}>{pasteNotice}</span> : null}
        </div>
      </div>

      <Form method='post' encType='multipart/form-data' className={styles.stackForm}>
        <input type='hidden' name='intent' value='import-career-dossier-files' />
        <Field.Root>
          <Field.Label>
            Bulk / Single .md File Upload (UTF-8, &lt;= 256 KB/file, max 10 files)
          </Field.Label>
          <input
            aria-label='Upload markdown career dossiers'
            name='markdownFiles'
            type='file'
            accept='.md,text/markdown'
            multiple
            className={styles.selectControl}
            required
          />
        </Field.Root>
        <p className={styles.muted}>
          Uploaded markdown drafts pass synchronous privacy sanitization before persisting as
          drafts.
        </p>
        <div>
          <Button.Root type='submit' variant='secondary' size='sm'>
            <Button.Label>Upload &amp; Sanitize .md Draft(s)</Button.Label>
          </Button.Root>
        </div>
      </Form>
    </div>
  );
}
