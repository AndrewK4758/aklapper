import { Osc7501StateSchema } from '@aklapper/core';
import { Button } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

const BADGE_STATES = Osc7501StateSchema.options;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export interface StatusBadgeEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function StatusBadgeEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: StatusBadgeEditorProps) {
  const badge = isRecord(value) ? value : {};
  const source = typeof badge['source'] === 'string' ? badge['source'] : '';
  const state = typeof badge['state'] === 'string' ? badge['state'] : 'ready';
  const badgeLabel = typeof badge['label'] === 'string' ? badge['label'] : '';

  const sourceError = issuesByPath[`${fieldKey}.source`]?.[0];
  const labelError = issuesByPath[`${fieldKey}.label`]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>{label}</legend>
      <div className={styles.inlineGrid3}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-source`}>
            Badge Source
          </label>
          <input
            id={`${fieldKey}-source`}
            className={styles.input}
            value={source}
            aria-invalid={Boolean(sourceError)}
            onChange={event => {
              onChange([fieldKey, 'source'], event.target.value);
            }}
          />
          {sourceError ? <p className={styles.fieldError}>{sourceError}</p> : null}
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-state`}>
            Badge State
          </label>
          <select
            id={`${fieldKey}-state`}
            className={styles.select}
            value={state}
            onChange={event => {
              onChange([fieldKey, 'state'], event.target.value);
            }}
          >
            {BADGE_STATES.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-label`}>
            Badge Label
          </label>
          <input
            id={`${fieldKey}-label`}
            className={styles.input}
            value={badgeLabel}
            aria-invalid={Boolean(labelError)}
            onChange={event => {
              onChange([fieldKey, 'label'], event.target.value);
            }}
          />
          {labelError ? <p className={styles.fieldError}>{labelError}</p> : null}
        </div>
      </div>
    </fieldset>
  );
}

export interface LinkActionListEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function LinkActionListEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: LinkActionListEditorProps) {
  const actions: Record<string, unknown>[] = Array.isArray(value)
    ? value.filter(isRecord)
    : [];
  const rootError = issuesByPath[fieldKey]?.[0];

  function moveAction(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= actions.length) return;
    const next = [...actions];
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
              [...actions, { label: 'New Action', to: '/', variant: 'default' }],
            );
          }}
        >
          <Button.Label>+ Add Action</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}
      {actions.map((item, index) => {
        const itemLabel = typeof item['label'] === 'string' ? item['label'] : '';
        const itemTo = typeof item['to'] === 'string' ? item['to'] : '';
        const itemVariant = item['variant'] === 'primary' ? 'primary' : 'default';
        const labelErr = issuesByPath[`${fieldKey}.${index}.label`]?.[0];
        const toErr = issuesByPath[`${fieldKey}.${index}.to`]?.[0];

        return (
          <div key={index} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Action #{index + 1}</span>
              <div className={styles.toolbarGroup}>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === 0}
                  onClick={() => {
                    moveAction(index, -1);
                  }}
                >
                  <Button.Label>Up</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === actions.length - 1}
                  onClick={() => {
                    moveAction(index, 1);
                  }}
                >
                  <Button.Label>Down</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() => {
                    onChange(
                      [fieldKey],
                      actions.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
            </div>
            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-label`}>
                  Action Label
                </label>
                <input
                  id={`${fieldKey}-${index}-label`}
                  className={styles.input}
                  value={itemLabel}
                  aria-invalid={Boolean(labelErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'label'], event.target.value);
                  }}
                />
                {labelErr ? <p className={styles.fieldError}>{labelErr}</p> : null}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-to`}>
                  Target Route
                </label>
                <input
                  id={`${fieldKey}-${index}-to`}
                  className={styles.input}
                  value={itemTo}
                  aria-invalid={Boolean(toErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'to'], event.target.value);
                  }}
                />
                {toErr ? <p className={styles.fieldError}>{toErr}</p> : null}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-variant`}>
                  Variant
                </label>
                <select
                  id={`${fieldKey}-${index}-variant`}
                  className={styles.select}
                  value={itemVariant}
                  onChange={event => {
                    onChange([fieldKey, index, 'variant'], event.target.value);
                  }}
                >
                  <option value='default'>default</option>
                  <option value='primary'>primary</option>
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export interface StringListEditorProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function StringListEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: StringListEditorProps) {
  const items: string[] = Array.isArray(value)
    ? value.map(item => (typeof item === 'string' ? item : ''))
    : [];
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
            onChange([fieldKey], [...items, '']);
          }}
        >
          <Button.Label>+ Add Item</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}
      {items.map((entry, index) => {
        const itemError = issuesByPath[`${fieldKey}.${index}`]?.[0];
        return (
          <div key={index} className={styles.fieldGroup}>
            <div className={styles.subCardHeader}>
              <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}`}>
                {label} #{index + 1}
              </label>
              <Button.Root
                type='button'
                variant='ghost'
                size='xs'
                onClick={() => {
                  onChange(
                    [fieldKey],
                    items.filter((_, i) => i !== index),
                  );
                }}
              >
                <Button.Label>Remove</Button.Label>
              </Button.Root>
            </div>
            <input
              id={`${fieldKey}-${index}`}
              className={styles.input}
              value={entry}
              aria-invalid={Boolean(itemError)}
              onChange={event => {
                onChange([fieldKey, index], event.target.value);
              }}
            />
            {itemError ? <p className={styles.fieldError}>{itemError}</p> : null}
          </div>
        );
      })}
    </fieldset>
  );
}
