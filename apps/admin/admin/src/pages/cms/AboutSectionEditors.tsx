import { Button } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface AboutSubEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

const IDENTITY_FIELDS = [
  { key: 'fullName', label: 'Full Name', type: 'text' },
  { key: 'roleHeadline', label: 'Role Headline', type: 'text' },
  { key: 'location', label: 'Location (City, ST — no ZIP)', type: 'text' },
  { key: 'githubLabel', label: 'GitHub Label', type: 'text' },
  { key: 'githubUrl', label: 'GitHub URL', type: 'url' },
  { key: 'websiteLabel', label: 'Website Label', type: 'text' },
  { key: 'websiteUrl', label: 'Website URL', type: 'url' },
] as const;

export function AboutIdentityEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: AboutSubEditorProps) {
  const identity = isRecord(value) ? value : {};
  const rootError = issuesByPath[fieldKey]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>{label}</legend>
      <p className={styles.helperText}>
        Public contact email is sourced read-only from <code>portal-chrome.brandContactEmail</code>.
      </p>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}
      <div className={styles.inlineGrid2}>
        {IDENTITY_FIELDS.map(field => {
          const raw = identity[field.key];
          const current = typeof raw === 'string' ? raw : '';
          const err = issuesByPath[`${fieldKey}.${field.key}`]?.[0];
          const inputId = `${fieldKey}-${field.key}`;
          return (
            <div key={field.key} className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={inputId}>
                {field.label}
              </label>
              <input
                id={inputId}
                type={field.type}
                className={styles.input}
                value={current}
                aria-invalid={Boolean(err)}
                onChange={event => {
                  onChange([fieldKey, field.key], event.target.value);
                }}
              />
              {err ? <p className={styles.fieldError}>{err}</p> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

const PORTRAIT_FIELDS = [
  { key: 'alt', label: 'Portrait Alt Text' },
  { key: 'caption', label: 'Portrait Caption' },
  { key: 'ttyLabel', label: 'Portrait TTY Label' },
] as const;

export function AboutPortraitEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: AboutSubEditorProps) {
  const portrait = isRecord(value) ? value : {};
  const rootError = issuesByPath[fieldKey]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>{label}</legend>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}
      <div className={styles.inlineGrid3}>
        {PORTRAIT_FIELDS.map(field => {
          const raw = portrait[field.key];
          const current = typeof raw === 'string' ? raw : '';
          const err = issuesByPath[`${fieldKey}.${field.key}`]?.[0];
          const inputId = `${fieldKey}-${field.key}`;
          return (
            <div key={field.key} className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={inputId}>
                {field.label}
              </label>
              <input
                id={inputId}
                className={styles.input}
                value={current}
                aria-invalid={Boolean(err)}
                onChange={event => {
                  onChange([fieldKey, field.key], event.target.value);
                }}
              />
              {err ? <p className={styles.fieldError}>{err}</p> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function AboutEducationEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: AboutSubEditorProps) {
  const entries: Record<string, unknown>[] = Array.isArray(value) ? value.filter(isRecord) : [];
  const rootError = issuesByPath[fieldKey]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <legend className={styles.subCardTitle}>{label}</legend>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(
              [fieldKey],
              [
                ...entries,
                {
                  institution: 'Institution Name',
                  location: 'City, ST',
                  program: 'Program / Study Area',
                },
              ],
            );
          }}
        >
          <Button.Label>+ Add Education</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}

      {entries.map((entry, index) => {
        const institution = typeof entry['institution'] === 'string' ? entry['institution'] : '';
        const location = typeof entry['location'] === 'string' ? entry['location'] : '';
        const program = typeof entry['program'] === 'string' ? entry['program'] : '';
        const instErr = issuesByPath[`${fieldKey}.${index}.institution`]?.[0];
        const locErr = issuesByPath[`${fieldKey}.${index}.location`]?.[0];
        const progErr = issuesByPath[`${fieldKey}.${index}.program`]?.[0];

        return (
          <div key={index} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Education #{index + 1}</span>
              <Button.Root
                type='button'
                variant='ghost'
                size='xs'
                disabled={entries.length <= 1}
                onClick={() => {
                  onChange(
                    [fieldKey],
                    entries.filter((_, idx) => idx !== index),
                  );
                }}
              >
                <Button.Label>Remove</Button.Label>
              </Button.Root>
            </div>
            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-institution`}>
                  Education {index + 1} Institution
                </label>
                <input
                  id={`${fieldKey}-${index}-institution`}
                  className={styles.input}
                  value={institution}
                  aria-invalid={Boolean(instErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'institution'], event.target.value);
                  }}
                />
                {instErr ? <p className={styles.fieldError}>{instErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-location`}>
                  Education {index + 1} Location
                </label>
                <input
                  id={`${fieldKey}-${index}-location`}
                  className={styles.input}
                  value={location}
                  aria-invalid={Boolean(locErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'location'], event.target.value);
                  }}
                />
                {locErr ? <p className={styles.fieldError}>{locErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-program`}>
                  Education {index + 1} Program
                </label>
                <input
                  id={`${fieldKey}-${index}-program`}
                  className={styles.input}
                  value={program}
                  aria-invalid={Boolean(progErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'program'], event.target.value);
                  }}
                />
                {progErr ? <p className={styles.fieldError}>{progErr}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
