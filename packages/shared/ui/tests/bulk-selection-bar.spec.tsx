import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { BulkSelectionBar, Button, pruneSelectedIds, SelectionCheckbox } from '../src';

describe('BulkSelectionBar and SelectionCheckbox', () => {
  it('prunes stale selected IDs against available IDs without mutating inputs', () => {
    const selected = new Set(['id-1', 'id-2', 'id-3']);
    const pruned = pruneSelectedIds(selected, ['id-2', 'id-4']);

    expect([...pruned]).toEqual(['id-2']);
    expect([...selected]).toEqual(['id-1', 'id-2', 'id-3']);
    expect([...pruneSelectedIds(new Set(), ['id-1'])]).toEqual([]);
    expect([...pruneSelectedIds(selected, [])]).toEqual([]);
  });

  it('toggles SelectionCheckbox and stops click propagation by default', () => {
    const onRowClick = vi.fn<() => void>();
    const onCheckedChange = vi.fn<(checked: boolean) => void>();

    render(
      <div onClick={onRowClick}>
        <SelectionCheckbox
          aria-label='Select Jane Doe'
          checked={false}
          onCheckedChange={onCheckedChange}
        />
      </div>,
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Select Jane Doe' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders BulkSelectionBar states (none, indeterminate, all), clear button, and actions slot', () => {
    const onToggleAll = vi.fn<(checked: boolean) => void>();
    const onClear = vi.fn<() => void>();

    const { rerender } = render(
      <BulkSelectionBar
        totalCount={3}
        selectedCount={0}
        allSelected={false}
        indeterminate={false}
        onToggleAll={onToggleAll}
        onClear={onClear}
        itemLabel='submission'
        actions={
          <Button.Root type='button' variant='danger' size='sm' disabled>
            <Button.Label>Delete Selected</Button.Label>
          </Button.Root>
        }
      />,
    );

    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    expect(selectAll.getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('0 of 3 submissions selected')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Clear Selection' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Delete Selected' })).toBeTruthy();

    fireEvent.click(selectAll);
    expect(onToggleAll).toHaveBeenCalledWith(true);

    rerender(
      <BulkSelectionBar
        totalCount={3}
        selectedCount={1}
        allSelected={false}
        indeterminate={true}
        onToggleAll={onToggleAll}
        onClear={onClear}
        itemLabel='submission'
      />,
    );

    expect(selectAll.getAttribute('aria-checked')).toBe('mixed');
    expect(screen.getByText('1 of 3 submissions selected')).toBeTruthy();
    const clearBtn = screen.getByRole('button', { name: 'Clear Selection' }) as HTMLButtonElement;
    expect(clearBtn.disabled).toBe(false);
    fireEvent.click(clearBtn);
    expect(onClear).toHaveBeenCalledTimes(1);

    rerender(
      <BulkSelectionBar
        totalCount={3}
        selectedCount={3}
        allSelected={true}
        indeterminate={false}
        onToggleAll={onToggleAll}
        onClear={onClear}
        itemLabel='submission'
      />,
    );

    expect(selectAll.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('3 of 3 submissions selected')).toBeTruthy();
  });
});
