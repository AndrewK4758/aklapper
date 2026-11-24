import type { ActionErrorMetadata, AdminInboxItem, AdminInboxLoaderData } from '@aklapper/core';
import {
  ActionFeedbackBanner,
  AlertDialog,
  Button,
  Field,
  OscStatusBadge,
  Separator,
  TuiWindow,
} from '@aklapper/ui';
import { useState } from 'react';
import { Form, Link } from 'react-router';

import styles from './AdminInboxPage.module.css';

export interface AdminInboxActionData extends ActionErrorMetadata {
  ok: boolean;
  message: string;
}

export interface AdminInboxPageProps {
  data: AdminInboxLoaderData;
  actionData?: AdminInboxActionData | null;
}

function formatByteSize(bytes: number | null): string {
  if (bytes === null || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isValidSha256Hex(value: string | null): boolean {
  return Boolean(value && /^[a-f0-9]{64}$/i.test(value));
}

export function AdminInboxPage({ data, actionData }: AdminInboxPageProps) {
  const { items, totalCount, page, pageSize, query } = data;
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const selectedItem: AdminInboxItem | null =
    items.find(item => item.id === selectedId) ?? items[0] ?? null;

  const totalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = page < totalPages ? page + 1 : null;

  const buildPageHref = (targetPage: number): string => {
    const params = new URLSearchParams();
    if (query.trim().length > 0) params.set('q', query.trim());
    params.set('page', String(targetPage));
    return `/inbox?${params.toString()}`;
  };

  return (
    <TuiWindow title='Contact Submissions Inbox // Postgres 19'>
      <div className={styles.panel}>
        {actionData ? <ActionFeedbackBanner {...actionData} /> : null}

        <div className={styles.searchBar}>
          <Form method='get' action='/inbox' className={styles.searchForm}>
            <Field.Root>
              <Field.Label>Search Submissions</Field.Label>
              <Field.Control
                name='q'
                type='search'
                placeholder='Name, email, message, or filename...'
                defaultValue={query}
                key={query}
              />
            </Field.Root>
            <Button.Root type='submit' variant='primary' size='sm'>
              <Button.Label>Search</Button.Label>
            </Button.Root>
            {query ? (
              <Button.Link render={<Link to='/inbox' />} variant='ghost' size='sm'>
                <Button.Label>Clear</Button.Label>
              </Button.Link>
            ) : null}
          </Form>

          <span className={styles.metaCount}>
            {totalCount} submission{totalCount === 1 ? '' : 's'} · Page {page} of {totalPages}
          </span>
        </div>

        <Separator.Root />

        {items.length === 0 ? (
          <p className={styles.metaCount}>No contact submissions match this filter.</p>
        ) : (
          <div className={styles.splitLayout}>
            <div className={styles.listColumn}>
              {items.map(item => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type='button'
                    aria-pressed={isSelected}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={styles.itemButton}
                    onClick={() => {
                      setSelectedId(item.id);
                    }}
                  >
                    <div className={styles.itemHeader}>
                      <strong>{item.name}</strong>
                      {item.attachmentName ? (
                        <OscStatusBadge source='file' state='ready' label='Attachment' />
                      ) : null}
                    </div>
                    <span className={styles.itemSub}>{item.email}</span>
                    <span className={styles.itemSnippet}>{item.message}</span>
                  </button>
                );
              })}

              <div className={styles.pager}>
                {prevPage ? (
                  <Button.Link
                    render={<Link to={buildPageHref(prevPage)} />}
                    variant='ghost'
                    size='sm'
                  >
                    <Button.Label>Previous</Button.Label>
                  </Button.Link>
                ) : (
                  <span />
                )}
                {nextPage ? (
                  <Button.Link
                    render={<Link to={buildPageHref(nextPage)} />}
                    variant='ghost'
                    size='sm'
                  >
                    <Button.Label>Next</Button.Label>
                  </Button.Link>
                ) : (
                  <span />
                )}
              </div>
            </div>

            {selectedItem ? (
              <article className={styles.detailCard} aria-label='Selected submission detail'>
                <div className={styles.detailHeader}>
                  <div>
                    <h2>{selectedItem.name}</h2>
                    <span className={styles.itemSub}>{selectedItem.email}</span>
                  </div>
                  <AlertDialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialog.Trigger type='button'>Delete Submission</AlertDialog.Trigger>
                    <AlertDialog.Portal>
                      <AlertDialog.Backdrop />
                      <AlertDialog.Viewport>
                        <AlertDialog.Popup>
                          <AlertDialog.Title>Delete Contact Submission?</AlertDialog.Title>
                          <AlertDialog.Description>
                            This permanently deletes the message from {selectedItem.name} (
                            {selectedItem.email}) and any stored attachment from PostgreSQL 19.
                          </AlertDialog.Description>
                          <AlertDialog.Actions>
                            <AlertDialog.Close type='button'>Cancel</AlertDialog.Close>
                            <Form
                              method='post'
                              onSubmit={() => {
                                setDeleteDialogOpen(false);
                              }}
                            >
                              <input type='hidden' name='intent' value='delete' />
                              <input type='hidden' name='id' value={selectedItem.id} />
                              <Button.Root type='submit' variant='danger'>
                                <Button.Label>Confirm Delete</Button.Label>
                              </Button.Root>
                            </Form>
                          </AlertDialog.Actions>
                        </AlertDialog.Popup>
                      </AlertDialog.Viewport>
                    </AlertDialog.Portal>
                  </AlertDialog.Root>
                </div>

                <div className={styles.metaGrid}>
                  <div>
                    <span className={styles.metaLabel}>Submitted</span>
                    <span>{new Date(selectedItem.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Phone</span>
                    <span>{selectedItem.phone ?? '—'}</span>
                  </div>
                  <div>
                    <span className={styles.metaLabel}>Record ID</span>
                    <span>{selectedItem.id}</span>
                  </div>
                </div>

                <pre className={styles.messageBody}>{selectedItem.message}</pre>

                {selectedItem.attachmentName ? (
                  <section className={styles.attachmentCard} aria-label='Attachment verification'>
                    <div className={styles.attachmentRow}>
                      <div>
                        <strong>{selectedItem.attachmentName}</strong>
                        <div className={styles.itemSub}>
                          {selectedItem.attachmentMimeType ?? 'application/octet-stream'} ·{' '}
                          {formatByteSize(selectedItem.attachmentSizeBytes)}
                        </div>
                      </div>
                      <OscStatusBadge
                        source='sha256'
                        state={isValidSha256Hex(selectedItem.attachmentSha256) ? 'ready' : 'error'}
                        label={
                          isValidSha256Hex(selectedItem.attachmentSha256)
                            ? 'SHA-256 Verified'
                            : 'Digest Missing'
                        }
                      />
                    </div>
                    {selectedItem.attachmentSha256 ? (
                      <code className={styles.shaCode}>sha256:{selectedItem.attachmentSha256}</code>
                    ) : null}
                    <div>
                      <Button.Link
                        render={
                          <a
                            href={`/inbox/${selectedItem.id}/attachment`}
                            download={selectedItem.attachmentName}
                            aria-label={`Download ${selectedItem.attachmentName}`}
                          />
                        }
                        variant='primary'
                        size='sm'
                      >
                        <Button.Label>Download Attachment</Button.Label>
                      </Button.Link>
                    </div>
                  </section>
                ) : null}
              </article>
            ) : null}
          </div>
        )}
      </div>
    </TuiWindow>
  );
}
