import type { ContactActionResult, PortalContactContent } from '@aklapper/core';
import {
  Button,
  OscStatusBadge,
  RecursiveTuiForm,
  Separator,
  TuiWindow,
  usePaneNavigation,
} from '@aklapper/ui';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Form, Link } from 'react-router';

import styles from './PortalContactPage.module.css';

export interface PortalContactFormRenderProps {
  readonly action: string;
  readonly className: string;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly children: ReactNode;
}

export interface PortalContactPageProps {
  content: PortalContactContent;
  actionData?: ContactActionResult;
  isSubmitting: boolean;
  onClose: () => void;
  formAction?: string;
  renderFormElement?: (props: PortalContactFormRenderProps) => ReactNode;
}

export function PortalContactPage({
  content,
  actionData,
  isSubmitting,
  onClose,
  formAction = '/contact',
  renderFormElement,
}: PortalContactPageProps) {
  const paneNav = usePaneNavigation();
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const confirmedSubmission =
    actionData?.ok && actionData.submission.id !== dismissedId ? actionData.submission : null;
  const errorResult = actionData && !actionData.ok ? actionData : null;

  return (
    <div className={styles.workspace}>
      <TuiWindow
        title={content.windowTitle}
        onClose={onClose}
        badge={
          <OscStatusBadge
            source={content.statusBadge.source}
            state={confirmedSubmission ? 'ready' : content.statusBadge.state}
            label={confirmedSubmission ? 'committed · pg19' : content.statusBadge.label}
          />
        }
      >
        <p className={styles.intro}>{content.description}</p>
        <Separator.Root />

        {confirmedSubmission && (
          <section
            className={styles.receipt}
            aria-label='Transmission Receipt'
            data-testid='contact-receipt'
          >
            <div className={styles.receiptHeader}>
              <h2 className={styles.receiptTitle}>✓ TRANSMISSION COMMITTED // POSTGRES 19</h2>
              <OscStatusBadge source='contact_submissions' state='ready' label='201 Created' />
            </div>
            <dl className={styles.receiptList}>
              <dt className={styles.receiptTerm}>Receipt ID</dt>
              <dd className={styles.receiptValue}>{confirmedSubmission.id}</dd>
              <dt className={styles.receiptTerm}>Sender</dt>
              <dd className={styles.receiptValue}>
                {confirmedSubmission.name} &lt;{confirmedSubmission.email}&gt;
              </dd>
              {confirmedSubmission.phone && (
                <>
                  <dt className={styles.receiptTerm}>Phone</dt>
                  <dd className={styles.receiptValue}>{confirmedSubmission.phone}</dd>
                </>
              )}
              {confirmedSubmission.attachmentName && (
                <>
                  <dt className={styles.receiptTerm}>Attachment</dt>
                  <dd className={styles.receiptValue}>
                    {confirmedSubmission.attachmentName} ({confirmedSubmission.attachmentSizeBytes}{' '}
                    B · sha256:{confirmedSubmission.attachmentSha256?.slice(0, 12)}…)
                  </dd>
                </>
              )}
              <dt className={styles.receiptTerm}>Committed At</dt>
              <dd className={styles.receiptValue}>{confirmedSubmission.createdAt}</dd>
            </dl>
            <div className={styles.receiptActions}>
              <Button
                type='button'
                variant='primary'
                onClick={() => setDismissedId(confirmedSubmission.id)}
              >
                New Transmission
              </Button>
              {paneNav?.docked ? (
                <Button type='button' variant='default' onClick={paneNav.exitTui}>
                  Return to Terminal
                </Button>
              ) : (
                <Button.Link variant='default' render={<Link to='/' />}>
                  Return to Terminal
                </Button.Link>
              )}
            </div>
          </section>
        )}

        {!confirmedSubmission && (
          <RecursiveTuiForm
            key={actionData?.ok ? actionData.submission.id : 'contact-draft'}
            definition={content.form}
            serverErrors={errorResult?.fieldErrors}
            serverFormError={errorResult?.formError ?? null}
            errorSource={errorResult?.source ?? null}
            isSubmitting={isSubmitting}
            renderForm={({ className, onSubmit, children }) => {
              const formBody = (
                <>
                  <input
                    type='text'
                    name='website'
                    tabIndex={-1}
                    autoComplete='off'
                    aria-hidden='true'
                    defaultValue=''
                    className={styles.honeypot}
                  />
                  {children}
                </>
              );
              if (renderFormElement) {
                return renderFormElement({
                  action: formAction,
                  className,
                  onSubmit,
                  children: formBody,
                });
              }
              return (
                <Form
                  action={formAction}
                  method='post'
                  encType='multipart/form-data'
                  noValidate
                  className={className}
                  onSubmit={onSubmit}
                >
                  {formBody}
                </Form>
              );
            }}
          />
        )}
      </TuiWindow>
    </div>
  );
}
