import type { MouseEvent, ReactElement, ReactNode } from 'react';

import { cx } from '../elements/_internal/elementFactory';
import { Button } from '../elements/base/Button';
import { Checkbox } from '../elements/base/Checkbox';

import styles from './BulkSelectionBar.module.css';

export function pruneSelectedIds(
  selectedIds: ReadonlySet<string>,
  availableIds: readonly string[],
): ReadonlySet<string> {
  if (selectedIds.size === 0 || availableIds.length === 0) {
    return new Set<string>();
  }

  const available = new Set(availableIds);
  const next = new Set<string>();
  for (const id of selectedIds) {
    if (available.has(id)) {
      next.add(id);
    }
  }
  return next;
}

export interface SelectionCheckboxProps {
  readonly 'aria-label': string;
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly stopPropagation?: boolean;
  readonly className?: string;
}

export function SelectionCheckbox({
  'aria-label': ariaLabel,
  checked,
  indeterminate = false,
  disabled = false,
  onCheckedChange,
  stopPropagation = true,
  className,
}: SelectionCheckboxProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
  };

  return (
    <span
      role='presentation'
      className={cx(styles.checkboxWrapper, className)}
      onClick={handleClick}
    >
      <Checkbox.Root
        aria-label={ariaLabel}
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        onCheckedChange={nextChecked => {
          onCheckedChange(nextChecked);
        }}
      >
        <Checkbox.Indicator>{indeterminate ? '−' : '✓'}</Checkbox.Indicator>
      </Checkbox.Root>
    </span>
  );
}

export interface BulkSelectionBarProps {
  readonly totalCount: number;
  readonly selectedCount: number;
  readonly allSelected: boolean;
  readonly indeterminate: boolean;
  readonly onToggleAll: (checked: boolean) => void;
  readonly onClear: () => void;
  readonly itemLabel?: string;
  readonly selectAllLabel?: string;
  readonly clearLabel?: string;
  readonly actions?: ReactNode;
  readonly className?: string;
}

function formatPluralLabel(label: string, count: number): string {
  return count === 1 ? label : `${label}s`;
}

export function BulkSelectionBar({
  totalCount,
  selectedCount,
  allSelected,
  indeterminate,
  onToggleAll,
  onClear,
  itemLabel = 'item',
  selectAllLabel = 'Select all on page',
  clearLabel = 'Clear Selection',
  actions,
  className,
}: BulkSelectionBarProps): ReactElement {
  const pluralLabel = formatPluralLabel(itemLabel, totalCount);

  return (
    <div
      role='toolbar'
      aria-label='Bulk selection controls'
      data-has-selection={selectedCount > 0 ? 'true' : 'false'}
      className={cx(styles.bar, className)}
    >
      <div className={styles.leading}>
        <label className={styles.selectAllLabel}>
          <SelectionCheckbox
            aria-label={selectAllLabel}
            checked={allSelected}
            indeterminate={indeterminate}
            disabled={totalCount === 0}
            onCheckedChange={onToggleAll}
            stopPropagation={false}
          />
          <span>{selectAllLabel}</span>
        </label>

        <span className={styles.count} aria-live='polite'>
          {selectedCount} of {totalCount} {pluralLabel} selected
        </span>
      </div>

      <div className={styles.actions}>
        <Button.Root
          type='button'
          variant='ghost'
          size='sm'
          disabled={selectedCount === 0}
          onClick={onClear}
        >
          <Button.Label>{clearLabel}</Button.Label>
        </Button.Root>
        {actions}
      </div>
    </div>
  );
}
