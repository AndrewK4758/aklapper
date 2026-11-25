import type { JsonSchemaObject } from '@aklapper/core';
import { Switch } from '@aklapper/ui';

import { FormDefinitionBuilder } from './FormDefinitionBuilder';
import { LinkActionListEditor, StatusBadgeEditor, StringListEditor } from './SiteContentSubEditors';
import { VisitorLensListEditor } from './VisitorLensListEditor';

import styles from './SiteContentEditor.module.css';

export interface JsonSchemaFormRendererProps {
  readonly schema: JsonSchemaObject;
  readonly value: Record<string, unknown>;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

function formatPropertyLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, ch => ch.toUpperCase())
    .trim();
}

function isSchemaType(prop: JsonSchemaObject, target: string): boolean {
  if (typeof prop.type === 'string') {
    return prop.type === target;
  }
  return Array.isArray(prop.type) && prop.type.includes(target);
}

export function JsonSchemaFormRenderer({
  schema,
  value,
  issuesByPath,
  onChange,
}: JsonSchemaFormRendererProps) {
  const properties = schema.properties ?? {};
  const requiredSet = new Set(schema.required ?? []);

  return (
    <div className={styles.formStack}>
      {Object.entries(properties).map(([propKey, propSchema]) => {
        const label = formatPropertyLabel(propKey);
        const isRequired = requiredSet.has(propKey);
        const currentValue = value[propKey];
        const fieldErrors = issuesByPath[propKey] ?? [];
        const errorId = `sc-err-${propKey}`;
        const inputId = `sc-field-${propKey}`;

        if (propKey === 'statusBadge' || propKey === 'tuiBadge') {
          return (
            <StatusBadgeEditor
              key={propKey}
              fieldKey={propKey}
              label={label}
              value={currentValue}
              issuesByPath={issuesByPath}
              onChange={onChange}
            />
          );
        }

        if (propKey === 'actions') {
          return (
            <LinkActionListEditor
              key={propKey}
              fieldKey={propKey}
              label={label}
              value={currentValue}
              issuesByPath={issuesByPath}
              onChange={onChange}
            />
          );
        }

        if (propKey === 'visitorLenses') {
          return (
            <VisitorLensListEditor
              key={propKey}
              fieldKey={propKey}
              label={label}
              value={currentValue}
              issuesByPath={issuesByPath}
              onChange={onChange}
            />
          );
        }

        if (propKey === 'form') {
          return (
            <FormDefinitionBuilder
              key={propKey}
              fieldKey={propKey}
              value={currentValue}
              issuesByPath={issuesByPath}
              onChange={onChange}
            />
          );
        }

        if (
          isSchemaType(propSchema, 'array') &&
          propSchema.items &&
          isSchemaType(propSchema.items, 'string')
        ) {
          return (
            <StringListEditor
              key={propKey}
              fieldKey={propKey}
              label={label}
              value={currentValue}
              issuesByPath={issuesByPath}
              onChange={onChange}
            />
          );
        }

        if (isSchemaType(propSchema, 'boolean')) {
          return (
            <div key={propKey} className={styles.fieldGroup}>
              <div className={styles.switchRow}>
                <Switch.Root
                  id={inputId}
                  aria-label={label}
                  checked={Boolean(currentValue)}
                  onCheckedChange={checked => {
                    onChange([propKey], Boolean(checked));
                  }}
                >
                  <Switch.Thumb />
                </Switch.Root>
                <Switch.Label htmlFor={inputId}>{label}</Switch.Label>
              </div>
              {fieldErrors[0] ? (
                <p id={errorId} className={styles.fieldError}>
                  {fieldErrors[0]}
                </p>
              ) : null}
            </div>
          );
        }

        if (isSchemaType(propSchema, 'integer') || isSchemaType(propSchema, 'number')) {
          const displayValue =
            typeof currentValue === 'number' && Number.isFinite(currentValue)
              ? String(currentValue)
              : '';
          return (
            <div key={propKey} className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={inputId}>
                {label}
                {isRequired ? ' *' : ' (optional)'}
              </label>
              <input
                id={inputId}
                type='number'
                className={styles.input}
                min={propSchema.minimum}
                max={propSchema.maximum}
                step={isSchemaType(propSchema, 'integer') ? 1 : 'any'}
                value={displayValue}
                aria-invalid={fieldErrors.length > 0 ? 'true' : 'false'}
                aria-describedby={fieldErrors.length > 0 ? errorId : undefined}
                onChange={event => {
                  const raw = event.target.value.trim();
                  if (raw === '') {
                    onChange([propKey], isRequired ? Number.NaN : undefined);
                    return;
                  }
                  const parsedNum = Number(raw);
                  onChange([propKey], parsedNum);
                }}
              />
              {fieldErrors[0] ? (
                <p id={errorId} className={styles.fieldError}>
                  {fieldErrors[0]}
                </p>
              ) : null}
            </div>
          );
        }

        const strValue = typeof currentValue === 'string' ? currentValue : '';
        const isLongCopy =
          propKey === 'description' ||
          propKey === 'lead' ||
          propKey === 'abstentionNotice' ||
          propKey === 'boundaryFallbackNotice' ||
          propKey === 'emptyThreadHint' ||
          propKey === 'jdPlaceholder' ||
          propKey === 'jdTextareaLabel' ||
          propKey === 'footerText';

        return (
          <div key={propKey} className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor={inputId}>
              {label}
              {isRequired ? ' *' : ' (optional)'}
            </label>
            {isLongCopy ? (
              <textarea
                id={inputId}
                className={styles.textarea}
                value={strValue}
                aria-invalid={fieldErrors.length > 0 ? 'true' : 'false'}
                aria-describedby={fieldErrors.length > 0 ? errorId : undefined}
                onChange={event => {
                  const next = event.target.value;
                  onChange([propKey], !isRequired && next === '' ? undefined : next);
                }}
              />
            ) : (
              <input
                id={inputId}
                type={propSchema.format === 'uri' ? 'url' : 'text'}
                className={styles.input}
                value={strValue}
                aria-invalid={fieldErrors.length > 0 ? 'true' : 'false'}
                aria-describedby={fieldErrors.length > 0 ? errorId : undefined}
                onChange={event => {
                  const next = event.target.value;
                  onChange([propKey], !isRequired && next === '' ? undefined : next);
                }}
              />
            )}
            {fieldErrors[0] ? (
              <p id={errorId} className={styles.fieldError}>
                {fieldErrors[0]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
