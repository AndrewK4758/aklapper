import { cx } from '../elements/_internal/elementFactory';

import styles from './SuggestionChipRow.module.css';

export interface SuggestionChipItem {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface SuggestionChipRowProps {
  readonly items: readonly SuggestionChipItem[];
  readonly selectedId?: string;
  readonly ariaLabel: string;
  readonly disabled?: boolean;
  readonly onSelect: (item: SuggestionChipItem) => void;
  readonly testIdPrefix?: string;
}

export function SuggestionChipRow({
  items,
  selectedId,
  ariaLabel,
  disabled = false,
  onSelect,
  testIdPrefix,
}: SuggestionChipRowProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <fieldset aria-label={ariaLabel} className={styles.row}>
      {items.map(item => {
        const isSelected = selectedId !== undefined && selectedId === item.id;
        return (
          <button
            key={item.id}
            type='button'
            disabled={disabled}
            aria-pressed={isSelected}
            data-selected={isSelected ? 'true' : 'false'}
            data-testid={testIdPrefix ? `${testIdPrefix}-${item.id}` : undefined}
            className={cx(styles.chip, isSelected && styles.chipSelected)}
            onClick={() => {
              onSelect(item);
            }}
          >
            <span className={styles.chipLabel}>{item.label}</span>
            {item.description ? (
              <span className={styles.chipDescription}>{item.description}</span>
            ) : null}
          </button>
        );
      })}
    </fieldset>
  );
}
