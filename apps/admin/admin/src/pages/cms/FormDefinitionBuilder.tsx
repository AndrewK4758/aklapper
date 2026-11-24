import type { FormFieldNode, FormFieldsetNode } from '@aklapper/core';
import { Button } from '@aklapper/ui';

import { FormFieldNodeCard } from './FormFieldNodeCard';

import styles from './SiteContentEditor.module.css';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function createNewField(index: number): FormFieldNode {
  const n = index + 1;
  return {
    kind: 'field',
    fieldType: 'text',
    id: `field-${n}`,
    name: `field_${n}`,
    label: `Field ${n}`,
    required: false,
  };
}

function createNewFieldset(index: number): FormFieldsetNode {
  const n = index + 1;
  return {
    kind: 'fieldset',
    id: `fieldset-${n}`,
    legend: `Section ${n}`,
    columns: 1,
    children: [createNewField(0)],
  };
}

interface NodeListProps {
  readonly basePath: readonly (string | number)[];
  readonly nodes: readonly unknown[];
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

function FormNodeListEditor({ basePath, nodes, issuesByPath, onChange }: NodeListProps) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const listError = issuesByPath[basePath.join('.')]?.[0];

  function moveNode(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= safeNodes.length) return;
    const next = [...safeNodes];
    const [item] = next.splice(index, 1);
    if (item === undefined) return;
    next.splice(target, 0, item);
    onChange(basePath, next);
  }

  return (
    <div className={styles.formStack}>
      {listError ? <p className={styles.fieldError}>{listError}</p> : null}
      {safeNodes.map((rawNode, index) => {
        const nodePath = [...basePath, index];
        const nodeKey = nodePath.join('.');
        const nodeId = nodePath.join('-');

        if (!isRecord(rawNode) || (rawNode['kind'] !== 'fieldset' && rawNode['kind'] !== 'field')) {
          return (
            <div key={nodeKey} className={styles.subCard}>
              <div className={styles.subCardHeader}>
                <span className={styles.subCardTitle}>Invalid node at index {index}</span>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() => {
                    onChange(
                      basePath,
                      safeNodes.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
              <p className={styles.helperText}>
                Remove this entry or repair its structure in Raw JSON mode.
              </p>
            </div>
          );
        }

        if (rawNode['kind'] === 'fieldset') {
          const fieldsetId = asString(rawNode['id']);
          const fieldsetLegend = asString(rawNode['legend']);
          const fieldsetColumns = rawNode['columns'] === 2 ? 2 : 1;
          const fieldsetChildren = Array.isArray(rawNode['children']) ? rawNode['children'] : [];

          return (
            <div key={nodeKey} className={styles.subCard}>
              <div className={styles.subCardHeader}>
                <span className={styles.subCardTitle}>
                  Fieldset: {fieldsetLegend || fieldsetId}
                </span>
                <div className={styles.toolbarGroup}>
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='xs'
                    disabled={index === 0}
                    onClick={() => {
                      moveNode(index, -1);
                    }}
                  >
                    <Button.Label>Up</Button.Label>
                  </Button.Root>
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='xs'
                    disabled={index === safeNodes.length - 1}
                    onClick={() => {
                      moveNode(index, 1);
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
                        basePath,
                        safeNodes.filter((_, i) => i !== index),
                      );
                    }}
                  >
                    <Button.Label>Remove</Button.Label>
                  </Button.Root>
                </div>
              </div>

              <div className={styles.inlineGrid3}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor={`${nodeId}-id`}>
                    Fieldset ID
                  </label>
                  <input
                    id={`${nodeId}-id`}
                    className={styles.input}
                    value={fieldsetId}
                    onChange={event => {
                      onChange([...nodePath, 'id'], event.target.value);
                    }}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor={`${nodeId}-legend`}>
                    Fieldset Legend
                  </label>
                  <input
                    id={`${nodeId}-legend`}
                    className={styles.input}
                    value={fieldsetLegend}
                    onChange={event => {
                      onChange([...nodePath, 'legend'], event.target.value);
                    }}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel} htmlFor={`${nodeId}-columns`}>
                    Columns
                  </label>
                  <select
                    id={`${nodeId}-columns`}
                    className={styles.select}
                    value={String(fieldsetColumns)}
                    onChange={event => {
                      onChange([...nodePath, 'columns'], Number(event.target.value));
                    }}
                  >
                    <option value='1'>1 column</option>
                    <option value='2'>2 columns</option>
                  </select>
                </div>
              </div>

              <div className={styles.nestedList}>
                <FormNodeListEditor
                  basePath={[...nodePath, 'children']}
                  nodes={fieldsetChildren}
                  issuesByPath={issuesByPath}
                  onChange={onChange}
                />
              </div>
            </div>
          );
        }

        return (
          <FormFieldNodeCard
            key={nodeKey}
            node={rawNode as unknown as FormFieldNode}
            nodePath={nodePath}
            canMoveUp={index > 0}
            canMoveDown={index < safeNodes.length - 1}
            onMoveUp={() => {
              moveNode(index, -1);
            }}
            onMoveDown={() => {
              moveNode(index, 1);
            }}
            onRemove={() => {
              onChange(
                basePath,
                safeNodes.filter((_, i) => i !== index),
              );
            }}
            onChange={onChange}
          />
        );
      })}

      <div className={styles.toolbarGroup}>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(basePath, [...safeNodes, createNewField(safeNodes.length)]);
          }}
        >
          <Button.Label>+ Add Field</Button.Label>
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(basePath, [...safeNodes, createNewFieldset(safeNodes.length)]);
          }}
        >
          <Button.Label>+ Add Fieldset</Button.Label>
        </Button.Root>
      </div>
    </div>
  );
}

export interface FormDefinitionBuilderProps {
  readonly fieldKey: string;
  readonly value: unknown;
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function FormDefinitionBuilder({
  fieldKey,
  value,
  issuesByPath,
  onChange,
}: FormDefinitionBuilderProps) {
  const form = isRecord(value) ? value : {};
  const nodes: readonly unknown[] = Array.isArray(form['nodes']) ? form['nodes'] : [];

  return (
    <fieldset className={styles.subCard}>
      <legend className={styles.subCardTitle}>Contact Form Builder</legend>
      <div className={styles.inlineGrid2}>
        {(
          [
            ['title', 'Form Title'],
            ['cliCommand', 'CLI Command'],
            ['submitLabel', 'Submit Button Label'],
            ['resetLabel', 'Reset Button Label'],
          ] as const
        ).map(([prop, label]) => (
          <div key={prop} className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${prop}`}>
              {label}
            </label>
            <input
              id={`${fieldKey}-${prop}`}
              className={styles.input}
              value={asString(form[prop])}
              onChange={event => {
                onChange([fieldKey, prop], event.target.value);
              }}
            />
          </div>
        ))}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel} htmlFor={`${fieldKey}-description`}>
          Form Description
        </label>
        <textarea
          id={`${fieldKey}-description`}
          className={styles.textarea}
          value={asString(form['description'])}
          onChange={event => {
            onChange([fieldKey, 'description'], event.target.value);
          }}
        />
      </div>

      <FormNodeListEditor
        basePath={[fieldKey, 'nodes']}
        nodes={nodes}
        issuesByPath={issuesByPath}
        onChange={onChange}
      />
    </fieldset>
  );
}
