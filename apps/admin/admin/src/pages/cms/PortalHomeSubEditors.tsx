import { HomeHighlightsListEditor, HomeServicesListEditor } from './PortalHomeResumeLists';

import styles from './SiteContentEditor.module.css';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumberText(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export interface HomeSubEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function HomePortraitEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: HomeSubEditorProps) {
  const record = isRecord(value) ? value : {};
  const srcErr = issuesByPath[`${fieldKey}.src`]?.[0];
  const altErr = issuesByPath[`${fieldKey}.alt`]?.[0];
  const captionErr = issuesByPath[`${fieldKey}.caption`]?.[0];
  const widthErr = issuesByPath[`${fieldKey}.width`]?.[0];
  const heightErr = issuesByPath[`${fieldKey}.height`]?.[0];

  const handleDimensionChange = (dimKey: 'width' | 'height', raw: string) => {
    const trimmed = raw.trim();
    onChange([fieldKey, dimKey], trimmed === '' ? Number.NaN : Number(trimmed));
  };

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>{label}</legend>
      <div className={styles.inlineGrid2}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-src`}>
            Portrait Source Path
          </label>
          <input
            id={`${fieldKey}-src`}
            className={styles.input}
            value={asString(record['src'])}
            aria-invalid={Boolean(srcErr)}
            onChange={event => {
              onChange([fieldKey, 'src'], event.target.value);
            }}
          />
          {srcErr ? <p className={styles.fieldError}>{srcErr}</p> : null}
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-caption`}>
            Caption
          </label>
          <input
            id={`${fieldKey}-caption`}
            className={styles.input}
            value={asString(record['caption'])}
            aria-invalid={Boolean(captionErr)}
            onChange={event => {
              onChange([fieldKey, 'caption'], event.target.value);
            }}
          />
          {captionErr ? <p className={styles.fieldError}>{captionErr}</p> : null}
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor={`${fieldKey}-alt`}>
          Alt Text
        </label>
        <input
          id={`${fieldKey}-alt`}
          className={styles.input}
          value={asString(record['alt'])}
          aria-invalid={Boolean(altErr)}
          onChange={event => {
            onChange([fieldKey, 'alt'], event.target.value);
          }}
        />
        {altErr ? <p className={styles.fieldError}>{altErr}</p> : null}
      </div>

      <div className={styles.inlineGrid2}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-width`}>
            Width (px)
          </label>
          <input
            id={`${fieldKey}-width`}
            type='number'
            min={64}
            max={2048}
            step={1}
            className={styles.input}
            value={asNumberText(record['width'])}
            aria-invalid={Boolean(widthErr)}
            onChange={event => {
              handleDimensionChange('width', event.target.value);
            }}
          />
          {widthErr ? <p className={styles.fieldError}>{widthErr}</p> : null}
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-height`}>
            Height (px)
          </label>
          <input
            id={`${fieldKey}-height`}
            type='number'
            min={64}
            max={2048}
            step={1}
            className={styles.input}
            value={asNumberText(record['height'])}
            aria-invalid={Boolean(heightErr)}
            onChange={event => {
              handleDimensionChange('height', event.target.value);
            }}
          />
          {heightErr ? <p className={styles.fieldError}>{heightErr}</p> : null}
        </div>
      </div>
    </fieldset>
  );
}

const RESUME_TEXT_FIELDS: ReadonlyArray<{
  readonly key: string;
  readonly labelText: string;
  readonly inputType?: 'text' | 'email' | 'url';
}> = [
  { key: 'name', labelText: 'Display Name' },
  { key: 'roleLine', labelText: 'Role & Location' },
  { key: 'publicEmail', labelText: 'Public Email', inputType: 'email' },
  { key: 'githubLabel', labelText: 'GitHub Label' },
  { key: 'githubUrl', labelText: 'GitHub URL (HTTPS)', inputType: 'url' },
];

export function HomeResumeSummaryEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: HomeSubEditorProps) {
  const record = isRecord(value) ? value : {};
  const highlights: string[] = Array.isArray(record['highlights'])
    ? record['highlights'].map(item => (typeof item === 'string' ? item : ''))
    : [];
  const services: Record<string, unknown>[] = Array.isArray(record['services'])
    ? record['services'].filter(isRecord)
    : [];
  const bioErr = issuesByPath[`${fieldKey}.bio`]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>{label}</legend>

      <div className={styles.inlineGrid2}>
        {RESUME_TEXT_FIELDS.map(field => {
          const err = issuesByPath[`${fieldKey}.${field.key}`]?.[0];
          const inputId = `${fieldKey}-${field.key}`;
          return (
            <div key={field.key} className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={inputId}>
                {field.labelText}
              </label>
              <input
                id={inputId}
                type={field.inputType ?? 'text'}
                className={styles.input}
                value={asString(record[field.key])}
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

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor={`${fieldKey}-bio`}>
          Engineering Bio
        </label>
        <textarea
          id={`${fieldKey}-bio`}
          className={styles.textarea}
          value={asString(record['bio'])}
          aria-invalid={Boolean(bioErr)}
          onChange={event => {
            onChange([fieldKey, 'bio'], event.target.value);
          }}
        />
        {bioErr ? <p className={styles.fieldError}>{bioErr}</p> : null}
      </div>

      <HomeHighlightsListEditor
        fieldKey={fieldKey}
        heading={asString(record['highlightsHeading'])}
        highlights={highlights}
        issuesByPath={issuesByPath}
        onChange={onChange}
      />

      <HomeServicesListEditor
        fieldKey={fieldKey}
        heading={asString(record['servicesHeading'])}
        services={services}
        issuesByPath={issuesByPath}
        onChange={onChange}
      />
    </fieldset>
  );
}
