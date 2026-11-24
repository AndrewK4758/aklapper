import type { AdminQuotasLoaderData } from '@aklapper/core';
import { Button, Field, Separator, TuiWindow } from '@aklapper/ui';
import { Form } from 'react-router';

import styles from './AdminQuotasPage.module.css';

export interface AdminQuotasActionData {
  ok: boolean;
  message: string;
}

export interface AdminQuotasPageProps {
  data: AdminQuotasLoaderData;
  actionData?: AdminQuotasActionData | null;
}

export function AdminQuotasPage({ data, actionData }: AdminQuotasPageProps) {
  const { policies, buckets } = data;

  return (
    <TuiWindow title='AI Quotas & Rate-Limit Buckets // Postgres 19'>
      <div className={styles.panel}>
        {actionData ? (
          actionData.ok ? (
            <output className={styles.statusNote}>{actionData.message}</output>
          ) : (
            <p role='alert' className={styles.errorNote}>
              {actionData.message}
            </p>
          )
        ) : null}

        <section aria-label='Quota policies'>
          <div className={styles.policyGrid}>
            {policies.map(policy => (
              <Form
                key={`${policy.role}:${policy.maxTurnsPerSession}:${policy.maxTokensPerRun}:${policy.maxDailyGlobalTokens}`}
                method='post'
                className={styles.card}
              >
                <h2 className={styles.sectionTitle}>Role Policy: {policy.role}</h2>
                <input type='hidden' name='intent' value='update-policy' />
                <input type='hidden' name='role' value={policy.role} />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Max Turns / Session</Field.Label>
                    <Field.Control
                      name='maxTurnsPerSession'
                      type='number'
                      min={1}
                      max={10000}
                      defaultValue={policy.maxTurnsPerSession}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Max Tokens / Run</Field.Label>
                    <Field.Control
                      name='maxTokensPerRun'
                      type='number'
                      min={100}
                      max={1000000}
                      defaultValue={policy.maxTokensPerRun}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Max Daily Global Tokens</Field.Label>
                    <Field.Control
                      name='maxDailyGlobalTokens'
                      type='number'
                      min={1000}
                      max={100000000}
                      defaultValue={policy.maxDailyGlobalTokens}
                      required
                    />
                  </Field.Root>
                </div>
                <div>
                  <Button.Root type='submit' variant='primary' size='sm'>
                    <Button.Label>Save {policy.role} Policy</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            ))}
          </div>
        </section>

        <Separator.Root />

        <section className={styles.card} aria-label='Rate limit buckets'>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Active Rate-Limit Buckets ({buckets.length})</h2>
            <Form method='post' className={styles.inlineForm}>
              <input type='hidden' name='intent' value='purge-stale' />
              <Field.Root>
                <Field.Label>Stale Hours</Field.Label>
                <Field.Control
                  name='olderThanHours'
                  type='number'
                  min={1}
                  max={8760}
                  defaultValue={24}
                  required
                />
              </Field.Root>
              <Button.Root type='submit' variant='secondary' size='sm'>
                <Button.Label>Purge Stale Buckets</Button.Label>
              </Button.Root>
            </Form>
          </div>

          {buckets.length === 0 ? (
            <p className={styles.emptyNote}>No active rate-limit buckets in PostgreSQL 19.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Scope Key</th>
                  <th>Window Start</th>
                  <th className={styles.numericCell}>Turns Used</th>
                  <th className={styles.numericCell}>Tokens Used</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {buckets.map(bucket => (
                  <tr key={bucket.scopeKey}>
                    <td>
                      <code>{bucket.scopeKey}</code>
                    </td>
                    <td>{new Date(bucket.windowStart).toLocaleString()}</td>
                    <td className={styles.numericCell}>{bucket.turnsUsed}</td>
                    <td className={styles.numericCell}>{bucket.tokensUsed.toLocaleString()}</td>
                    <td aria-label={`Reset ${bucket.scopeKey}`}>
                      <Form method='post'>
                        <input type='hidden' name='intent' value='reset-bucket' />
                        <input type='hidden' name='scopeKey' value={bucket.scopeKey} />
                        <Button.Root type='submit' variant='danger' size='sm'>
                          <Button.Label>Reset</Button.Label>
                        </Button.Root>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </TuiWindow>
  );
}
