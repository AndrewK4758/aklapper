import type { FormFieldNode, FormFieldsetNode, FormNode } from '@aklapper/core';
import { Button, Switch } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

const FIELD_TYPES: readonly FormFieldNode['fieldType'][] = [
  'text',
  'tel',
  'email',
  'textarea',
  'file',
];

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

function switchFieldType(
  node: Record<string, unknown>,
  nextType: FormFieldNode['fieldType'],
): FormFieldNode {
  const base = {
    kind: 'field' as const,
    id: asString(node['id']) || 'field',
    name: asString(node['name']) || 'field',
    label: asString(node['label']) || 'Field',
    required: Boolean(node['required']),
    ...(typeof node['cliFlag'] === 'string' && node['cliFlag'].length > 0
      ? { cliFlag: node['cliFlag'] }
      : {}),
    ...(typeof node['description'] === 'string' && node['description'].length > 0
      ? { description: node['description'] }
      : {}),
  };

  if (nextType === 'file') {
    return { ...base, fieldType: 'file' };
  }
  if (nextType === 'textarea') {
    return { ...base, fieldType: 'textarea', rows: 4 };
  }
  return { ...base, fieldType: nextType };
}

interface NodeListProps {
  readonly basePath: readonly (string | number)[];
  readonly nodes: readonly FormNode[];
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

function FormNodeListEditor({ basePath, nodes, issuesByPath, onChange }: NodeListProps) {
  const pathPrefix = basePath.join('.');
  const listError = issuesByPath[pathPrefix]?.[0];

  function moveNode(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= nodes.length) return;
    const next = [...nodes];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange(basePath, next);
  }

  return (
    <div className={styles.formStack}>
      {listError ? <p className={styles.fieldError}>{listError}</p> : null}
      {nodes.map((node, index) => {
        const nodePath = [...basePath, index];
        const nodeId = nodePath.join('-');

        if (node.kind === 'fieldset') {
          return (
            <div key={`${node.id}-${index}`} className={styles.subCard}>
              <div className={styles.subCardHeader}>
                <span className={styles.subCardTitle}>Fieldset: {node.legend || node.id}</span>
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
                    disabled={index === nodes.length - 1}
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
                        nodes.filter((_, i) => i !== index),
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
                    value={node.id}
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
                    value={node.legend}
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
                    value={String(node.columns ?? 1)}
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
                  nodes={node.children}
                  issuesByPath={issuesByPath}
                  onChange={onChange}
                />
              </div>
            </div>
          );
        }

        return (
          <div key={`${node.id}-${index}`} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.subCardTitle}>
                Field ({node.fieldType}): {node.label || node.name}
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
                  disabled={index === nodes.length - 1}
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
                      nodes.filter((_, i) => i !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
            </div>

            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${nodeId}-label`}>
                  Label
                </label>
                <input
                  id={`${nodeId}-label`}
                  className={styles.input}
                  value={node.label}
                  onChange={event => {
                    onChange([...nodePath, 'label'], event.target.value);
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${nodeId}-name`}>
                  Field Name
                </label>
                <input
                  id={`${nodeId}-name`}
                  className={styles.input}
                  value={node.name}
                  onChange={event => {
                    onChange([...nodePath, 'name'], event.target.value);
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${nodeId}-type`}>
                  Field Type
                </label>
                <select
                  id={`${nodeId}-type`}
                  className={styles.select}
                  value={node.fieldType}
                  onChange={event => {
                    onChange(
                      nodePath,
                      switchFieldType(
                        node as unknown as Record<string, unknown>,
                        event.target.value as FormFieldNode['fieldType'],
                      ),
                    );
                  }}
                >
                  {FIELD_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${nodeId}-cliflag`}>
                  CLI Flag (optional)
                </label>
                <input
                  id={`${nodeId}-cliflag`}
                  className={styles.input}
                  value={node.cliFlag ?? ''}
                  onChange={event => {
                    const trimmed = event.target.value.trim();
                    onChange([...nodePath, 'cliFlag'], trimmed.length > 0 ? trimmed : undefined);
                  }}
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${nodeId}-desc`}>
                  Description (optional)
                </label>
                <input
                  id={`${nodeId}-desc`}
                  className={styles.input}
                  value={node.description ?? ''}
                  onChange={event => {
                    const nextVal = event.target.value;
                    onChange(
                      [...nodePath, 'description'],
                      nextVal.length > 0 ? nextVal : undefined,
                    );
                  }}
                />
              </div>
              <div className={styles.switchRow}>
                <Switch.Root
                  id={`${nodeId}-required`}
                  aria-label={`Required ${node.label}`}
                  checked={node.required}
                  onCheckedChange={checked => {
                    onChange([...nodePath, 'required'], Boolean(checked));
                  }}
                >
                  <Switch.Thumb />
                </Switch.Root>
                <Switch.Label htmlFor={`${nodeId}-required`}>Required</Switch.Label>
              </div>
            </div>
          </div>
        );
      })}

      <div className={styles.toolbarGroup}>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(basePath, [...nodes, createNewField(nodes.length)]);
          }}
        >
          <Button.Label>+ Add Field</Button.Label>
        </Button.Root>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(basePath, [...nodes, createNewFieldset(nodes.length)]);
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
  const nodes = Array.isArray(form['nodes']) ? (form['nodes'] as FormNode[]) : [];

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
