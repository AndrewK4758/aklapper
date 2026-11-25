import type { AdminInboxItem, AdminInboxLoaderData } from '@aklapper/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AdminInboxPage } from './AdminInboxPage';

const ITEMS_FIXTURE: readonly AdminInboxItem[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Alice Vance',
    email: 'alice@example.com',
    phone: '555-0101',
    message: 'First message body',
    createdAt: '2026-11-24T12:00:00.000Z',
    attachmentName: null,
    attachmentMimeType: null,
    attachmentSizeBytes: null,
    attachmentSha256: null,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Bob Mercer',
    email: 'bob@example.com',
    phone: null,
    message: 'Second message body',
    createdAt: '2026-11-24T13:00:00.000Z',
    attachmentName: null,
    attachmentMimeType: null,
    attachmentSizeBytes: null,
    attachmentSha256: null,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Cara Singh',
    email: 'cara@example.com',
    phone: null,
    message: 'Third message body',
    createdAt: '2026-11-24T14:00:00.000Z',
    attachmentName: null,
    attachmentMimeType: null,
    attachmentSizeBytes: null,
    attachmentSha256: null,
  },
];

function makeInboxData(items: readonly AdminInboxItem[]): AdminInboxLoaderData {
  return {
    items: [...items],
    totalCount: items.length,
    page: 1,
    pageSize: 20,
    query: '',
  };
}

describe('AdminInboxPage multi-select and bulk delete', () => {
  it('hides BulkSelectionBar when the inbox list is empty', async () => {
    const Stub = createRoutesStub([
      {
        path: '/inbox',
        Component: () => <AdminInboxPage data={makeInboxData([])} actionData={null} />,
      },
    ]);

    render(<Stub initialEntries={['/inbox']} />);
    expect(await screen.findByText('No contact submissions match this filter.')).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'Bulk selection controls' })).toBeNull();
  });

  it('toggles row checkboxes without breaking click-to-inspect detail view, and supports select-all and clear', async () => {
    const Stub = createRoutesStub([
      {
        path: '/inbox',
        Component: () => <AdminInboxPage data={makeInboxData(ITEMS_FIXTURE)} actionData={null} />,
      },
    ]);

    render(<Stub initialEntries={['/inbox']} />);

    // Initially first item is inspected in the detail pane
    const detail = await screen.findByRole('article', { name: 'Selected submission detail' });
    expect(detail.textContent).toContain('Alice Vance');

    // Selecting Bob's checkbox updates count without changing the inspected detail item
    const bobCheckbox = screen.getByRole('checkbox', { name: 'Select submission from Bob Mercer' });
    fireEvent.click(bobCheckbox);
    expect(bobCheckbox.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('1 of 3 submissions selected')).toBeTruthy();
    expect(detail.textContent).toContain('Alice Vance');

    // Select-all checkbox shows indeterminate state on partial selection
    const selectAll = screen.getByRole('checkbox', { name: /select all/i });
    expect(selectAll.getAttribute('aria-checked')).toBe('mixed');

    // Clicking Cara's row inspects Cara without toggling Cara's checkbox
    const caraRowBtn = screen.getByRole('button', { name: /Cara Singh/i });
    fireEvent.click(caraRowBtn);
    expect(detail.textContent).toContain('Cara Singh');
    const caraCheckbox = screen.getByRole('checkbox', { name: 'Select submission from Cara Singh' });
    expect(caraCheckbox.getAttribute('aria-checked')).toBe('false');

    // Clicking select-all selects all 3 rows on page
    fireEvent.click(selectAll);
    expect(selectAll.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('3 of 3 submissions selected')).toBeTruthy();

    // Clicking Clear Selection resets selected count to 0
    fireEvent.click(screen.getByRole('button', { name: 'Clear Selection' }));
    expect(screen.getByText('0 of 3 submissions selected')).toBeTruthy();
    expect(selectAll.getAttribute('aria-checked')).toBe('false');
  });

  it('submits intent=delete-many with all selected IDs on confirmation and clears selection', async () => {
    const submittedPayloads: { intent: string; ids: string[] }[] = [];
    const actionSpy = vi.fn<(args: { request: Request }) => Promise<{ ok: boolean; message: string }>>(
      async ({ request }) => {
        const fd = await request.formData();
        submittedPayloads.push({
          intent: String(fd.get('intent') ?? ''),
          ids: fd.getAll('id').map(v => String(v)),
        });
        return { ok: true, message: 'Deleted 2 contact submissions from PostgreSQL 19.' };
      },
    );

    const Stub = createRoutesStub([
      {
        path: '/inbox',
        action: actionSpy,
        Component: () => <AdminInboxPage data={makeInboxData(ITEMS_FIXTURE)} actionData={null} />,
      },
    ]);

    render(<Stub initialEntries={['/inbox']} />);

    // Bulk delete trigger disabled when nothing selected
    const deleteSelectedBtn = (await screen.findByRole('button', {
      name: /Delete Selected/i,
    })) as HTMLButtonElement;
    expect(deleteSelectedBtn.disabled).toBe(true);

    // Select Alice and Cara
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select submission from Alice Vance' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select submission from Cara Singh' }));

    expect(deleteSelectedBtn.disabled).toBe(false);
    expect(deleteSelectedBtn.textContent).toContain('Delete Selected (2)');

    // Open confirmation dialog
    fireEvent.click(deleteSelectedBtn);
    expect(await screen.findByText('Delete 2 Contact Submissions?')).toBeTruthy();

    // Confirm bulk delete
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Bulk Delete' }));

    await waitFor(() => {
      expect(submittedPayloads).toHaveLength(1);
    });
    expect(submittedPayloads[0]).toEqual({
      intent: 'delete-many',
      ids: [ITEMS_FIXTURE[0].id, ITEMS_FIXTURE[2].id],
    });
    expect(screen.getByText('0 of 3 submissions selected')).toBeTruthy();
  });

  it('prunes stale selected IDs during render when items change and preserves single-item delete', async () => {
    const submittedPayloads: { intent: string; id: string }[] = [];
    const actionSpy = vi.fn<(args: { request: Request }) => Promise<{ ok: boolean; message: string }>>(
      async ({ request }) => {
        const fd = await request.formData();
        submittedPayloads.push({
          intent: String(fd.get('intent') ?? ''),
          id: String(fd.get('id') ?? ''),
        });
        return { ok: true, message: 'Contact submission deleted from PostgreSQL 19.' };
      },
    );

    function InboxHarness() {
      const [currentItems, setCurrentItems] = useState<readonly AdminInboxItem[]>(ITEMS_FIXTURE);
      return (
        <>
          <button
            type='button'
            onClick={() => {
              setCurrentItems(ITEMS_FIXTURE.slice(1));
            }}
          >
            Drop First Item
          </button>
          <AdminInboxPage data={makeInboxData(currentItems)} actionData={null} />
        </>
      );
    }

    const Stub = createRoutesStub([
      {
        path: '/inbox',
        action: actionSpy,
        Component: InboxHarness,
      },
    ]);

    render(<Stub initialEntries={['/inbox']} />);

    // Select Alice and Bob
    fireEvent.click(
      await screen.findByRole('checkbox', { name: 'Select submission from Alice Vance' }),
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select submission from Bob Mercer' }));
    expect(screen.getByText('2 of 3 submissions selected')).toBeTruthy();

    // Simulate list update where Alice was deleted / filtered out while AdminInboxPage stays mounted
    fireEvent.click(screen.getByRole('button', { name: 'Drop First Item' }));

    expect(screen.getByText('1 of 2 submissions selected')).toBeTruthy();

    // Single-item delete from detail pane still submits intent=delete
    fireEvent.click(screen.getByRole('button', { name: 'Delete Submission' }));
    expect(await screen.findByText('Delete Contact Submission?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    await waitFor(() => {
      expect(submittedPayloads).toHaveLength(1);
    });
    expect(submittedPayloads[0]).toEqual({
      intent: 'delete',
      id: ITEMS_FIXTURE[1].id,
    });
  });
});
