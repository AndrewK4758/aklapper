import type { FormFieldNode } from '@aklapper/core';
import { Button, Switch } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

const FIELD_TYPES: readonly FormFieldNode['fieldType'][] = [
  'text',
  'tel',
  'email',
  'textarea',
  'file',
];

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
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

export interface FormFieldNodeCardProps {
  readonly node: FormFieldNode;
  readonly nodePath: readonly (string | number)[];
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
  readonly onRemove: () => void;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function FormFieldNodeCard({
  node,
  nodePath,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRemove,
  onChange,
}: FormFieldNodeCardProps) {
  const nodeId = nodePath.join('-');

  return (
    <div className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <span className={styles.subCardTitle}>
          Field ({node.fieldType}): {node.label || node.name}
        </span>
        <div className={styles.toolbarGroup}>
          <Button.Root
            type='button'
            variant='ghost'
            size='xs'
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <Button.Label>Up</Button.Label>
          </Button.Root>
          <Button.Root
            type='button'
            variant='ghost'
            size='xs'
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <Button.Label>Down</Button.Label>
          </Button.Root>
          <Button.Root type='button' variant='ghost' size='xs' onClick={onRemove}>
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
              onChange([...nodePath, 'description'], nextVal.length > 0 ? nextVal : undefined);
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
}
