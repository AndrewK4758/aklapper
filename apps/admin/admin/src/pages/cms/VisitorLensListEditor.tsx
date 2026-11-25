import { Button } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface VisitorLensListEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function VisitorLensListEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: VisitorLensListEditorProps) {
  const lenses: Record<string, unknown>[] = Array.isArray(value) ? value.filter(isRecord) : [];
  const rootError = issuesByPath[fieldKey]?.[0];

  function moveLens(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= lenses.length) return;
    const next = [...lenses];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange([fieldKey], next);
  }

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
                ...lenses,
                {
                  id: `lens-${lenses.length + 1}`,
                  label: 'New Visitor Lens',
                  description: 'Describe what this audience wants to explore.',
                  starterQuestions: ['What architecture patterns has Andrew built?'],
                },
              ],
            );
          }}
        >
          <Button.Label>+ Add Visitor Lens</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}

      {lenses.map((lens, index) => {
        const lensId = typeof lens['id'] === 'string' ? lens['id'] : '';
        const lensLabel = typeof lens['label'] === 'string' ? lens['label'] : '';
        const lensDescription = typeof lens['description'] === 'string' ? lens['description'] : '';
        const starters: string[] = Array.isArray(lens['starterQuestions'])
          ? lens['starterQuestions'].filter((item): item is string => typeof item === 'string')
          : [];

        const idErr = issuesByPath[`${fieldKey}.${index}.id`]?.[0];
        const labelErr = issuesByPath[`${fieldKey}.${index}.label`]?.[0];
        const descErr = issuesByPath[`${fieldKey}.${index}.description`]?.[0];
        const startersErr = issuesByPath[`${fieldKey}.${index}.starterQuestions`]?.[0];

        return (
          <div key={index} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Lens #{index + 1}</span>
              <div className={styles.toolbarGroup}>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === 0}
                  onClick={() => {
                    moveLens(index, -1);
                  }}
                >
                  <Button.Label>Up</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === lenses.length - 1}
                  onClick={() => {
                    moveLens(index, 1);
                  }}
                >
                  <Button.Label>Down</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={lenses.length <= 1}
                  onClick={() => {
                    onChange(
                      [fieldKey],
                      lenses.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
            </div>

            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-id`}>
                  Lens ID
                </label>
                <input
                  id={`${fieldKey}-${index}-id`}
                  className={styles.input}
                  value={lensId}
                  aria-invalid={Boolean(idErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'id'], event.target.value);
                  }}
                />
                {idErr ? <p className={styles.fieldError}>{idErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-label`}>
                  Lens Label
                </label>
                <input
                  id={`${fieldKey}-${index}-label`}
                  className={styles.input}
                  value={lensLabel}
                  aria-invalid={Boolean(labelErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'label'], event.target.value);
                  }}
                />
                {labelErr ? <p className={styles.fieldError}>{labelErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-description`}>
                  Description
                </label>
                <input
                  id={`${fieldKey}-${index}-description`}
                  className={styles.input}
                  value={lensDescription}
                  aria-invalid={Boolean(descErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'description'], event.target.value);
                  }}
                />
                {descErr ? <p className={styles.fieldError}>{descErr}</p> : null}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.subCardHeader}>
                <span className={styles.fieldLabel}>Starter Questions ({starters.length})</span>
                <Button.Root
                  type='button'
                  variant='secondary'
                  size='xs'
                  onClick={() => {
                    onChange(
                      [fieldKey, index, 'starterQuestions'],
                      [...starters, 'New starter question'],
                    );
                  }}
                >
                  <Button.Label>+ Add Starter</Button.Label>
                </Button.Root>
              </div>
              {startersErr ? <p className={styles.fieldError}>{startersErr}</p> : null}
              {starters.map((question, qIdx) => (
                <div key={qIdx} className={styles.inlineGrid3}>
                  <input
                    aria-label={`Lens ${index + 1} starter question ${qIdx + 1}`}
                    className={styles.input}
                    value={question}
                    onChange={event => {
                      onChange([fieldKey, index, 'starterQuestions', qIdx], event.target.value);
                    }}
                  />
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='xs'
                    disabled={starters.length <= 1}
                    onClick={() => {
                      onChange(
                        [fieldKey, index, 'starterQuestions'],
                        starters.filter((_, idx) => idx !== qIdx),
                      );
                    }}
                  >
                    <Button.Label>Remove</Button.Label>
                  </Button.Root>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
