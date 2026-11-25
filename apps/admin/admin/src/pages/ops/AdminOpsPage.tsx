import type {
  ActionErrorMetadata,
  AdminOpsLoaderData,
  AdminSandboxRun,
  CadenceGateVerdict,
  Osc7501State,
  QdrantHealthStatus,
  RuntimeServiceHealthItem,
  RuntimeServiceHealthSnapshot,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  LazyChunkBoundary,
  lazyWithRetry,
  OscStatusBadge,
  Separator,
  TuiWindow,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import { Form, useFetcher } from 'react-router';

import { reportAdminLazyChunkError } from '../client-telemetry';
import { AdminOpsRuntimeCards } from './AdminOpsRuntimeCards';
import { refreshOpsRuntimeStatus, useOpsRuntimeStatus } from './opsRuntimeStore';

import styles from './AdminOpsPage.module.css';

const LazySandboxedArtifactFrame = lazyWithRetry(() =>
  import('@aklapper/ui/sandboxed-artifact-frame').then(mod => ({
    default: mod.SandboxedArtifactFrame,
  })),
);

export interface AdminOpsActionData extends ActionErrorMetadata {
  ok: boolean;
  message: string;
}

export interface AdminOpsPrimaryData {
  readonly sandboxRuns: readonly AdminSandboxRun[];
  readonly runtimeHealth?: RuntimeServiceHealthSnapshot;
  readonly qdrantStatus?: QdrantHealthStatus;
}

export interface AdminOpsPageProps {
  data: AdminOpsPrimaryData | AdminOpsLoaderData;
  qdrantStatusSlot?: ReactNode;
  actionData?: AdminOpsActionData | null;
}

function mapHealthStatusToOsc(status: RuntimeServiceHealthItem['status']): Osc7501State {
  if (status === 'healthy') return 'ready';
  if (status === 'degraded') return 'scaling';
  if (status === 'offline') return 'error';
  return 'idle';
}

function mapGateVerdictToOsc(verdict: CadenceGateVerdict): Osc7501State {
  if (verdict === 'approved') return 'ready';
  if (verdict === 'rejected') return 'error';
  return 'gate';
}

export function AdminOpsPage({ data, qdrantStatusSlot, actionData }: AdminOpsPageProps) {
  const runtimeState = useOpsRuntimeStatus();
  const reindexFetcher = useFetcher<AdminOpsActionData>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    data.sandboxRuns[0]?.runId ?? null,
  );

  const selectedRun: AdminSandboxRun | null =
    data.sandboxRuns.find(run => run.runId === selectedRunId) ?? data.sandboxRuns[0] ?? null;

  const feedback = reindexFetcher.data ?? actionData ?? null;
  const activeSnapshot = runtimeState.snapshot ?? data.runtimeHealth ?? null;
  const services = activeSnapshot?.services ?? [];

  return (
    <TuiWindow title='Runtime Health, Qdrant & Sandbox Audit // Ops'>
      <div className={styles.panel}>
        {feedback ? <ActionFeedbackBanner {...feedback} /> : null}

        <section className={styles.card} aria-label='Cloud Run / Docker Runtime Health'>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Cloud Run / Docker Runtime Health</h2>
            <div className={styles.podActions}>
              <OscStatusBadge
                source={activeSnapshot?.runtime ?? 'cloud-run'}
                state={
                  runtimeState.error
                    ? 'error'
                    : activeSnapshot
                      ? activeSnapshot.services.some(s => s.status === 'offline')
                        ? 'error'
                        : activeSnapshot.services.some(s => s.status === 'degraded')
                          ? 'scaling'
                          : 'ready'
                      : 'idle'
                }
                label={
                  runtimeState.error
                    ? 'Probe Error'
                    : (activeSnapshot?.summaryLabel ?? 'Awaiting runtime probe')
                }
              />
              <Button.Root
                type='button'
                variant='secondary'
                size='sm'
                loading={runtimeState.loading}
                onClick={() => {
                  void refreshOpsRuntimeStatus();
                }}
              >
                <Button.Label>Refresh Health</Button.Label>
              </Button.Root>
            </div>
          </div>

          {runtimeState.error ? (
            <p className={styles.muted} role='alert'>
              {runtimeState.error}
            </p>
          ) : null}

          <ul className={styles.podList}>
            {services.length === 0 ? (
              <li className={styles.podRow}>
                <span className={styles.muted}>
                  Click &ldquo;Refresh Health&rdquo; to probe Cloud Run / Docker services on demand.
                </span>
              </li>
            ) : (
              services.map(item => (
                <li key={item.service} className={styles.podRow}>
                  <div className={styles.podMeta}>
                    <strong>{item.service}</strong>
                    <span className={styles.muted}>
                      {item.runtime} ·{' '}
                      {item.latencyMs !== null ? `${item.latencyMs}ms` : 'not probed'}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </span>
                  </div>
                  <div className={styles.podActions}>
                    <OscStatusBadge
                      source={item.service}
                      state={mapHealthStatusToOsc(item.status)}
                      label={item.status}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <AdminOpsRuntimeCards
          qdrantStatus={data.qdrantStatus}
          qdrantStatusSlot={qdrantStatusSlot}
          reindexForm={
            <reindexFetcher.Form method='post'>
              <input type='hidden' name='intent' value='reindex-qdrant' />
              <Button.Root
                type='submit'
                variant='secondary'
                size='sm'
                loading={reindexFetcher.state !== 'idle'}
              >
                <Button.Label>Re-Index portfolio_docs</Button.Label>
              </Button.Root>
            </reindexFetcher.Form>
          }
        />

        <Separator.Root />

        <section className={styles.card} aria-label='Sandbox runs audit viewer'>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>
              CHORD Sandbox Runs &amp; Gate Overrides ({data.sandboxRuns.length})
            </h2>
          </div>

          {data.sandboxRuns.length === 0 ? (
            <p className={styles.muted}>No sandbox runs recorded in PostgreSQL 19 yet.</p>
          ) : (
            <div className={styles.auditSplit}>
              <div className={styles.runList}>
                {data.sandboxRuns.map(run => {
                  const isSelected = selectedRun?.runId === run.runId;
                  const totalTokens = (run.tokensIn ?? 0) + (run.tokensOut ?? 0);
                  return (
                    <button
                      key={run.runId}
                      type='button'
                      aria-pressed={isSelected}
                      data-selected={isSelected ? 'true' : 'false'}
                      className={styles.runButton}
                      onClick={() => {
                        setSelectedRunId(run.runId);
                      }}
                    >
                      <div className={styles.cardHeader}>
                        <strong>{run.menuSlug}</strong>
                        <OscStatusBadge
                          source='gate'
                          state={mapGateVerdictToOsc(run.gateVerdict)}
                          label={run.gateVerdict}
                        />
                      </div>
                      <span>{run.prompt}</span>
                      <span className={styles.muted}>
                        {totalTokens} tokens · {run.turns.length} turns
                      </span>
                    </button>
                  );
                })}
              </div>

              {selectedRun ? (
                <article className={styles.runDetail} aria-label='Selected sandbox run audit'>
                  <div className={styles.cardHeader}>
                    <div>
                      <h3>Run {selectedRun.runId}</h3>
                      <p className={styles.muted}>
                        Session: {selectedRun.sessionId} · Status: {selectedRun.runStatus} · Tokens:{' '}
                        {selectedRun.tokensIn ?? 0} in / {selectedRun.tokensOut ?? 0} out
                      </p>
                    </div>
                    <OscStatusBadge
                      source='verdict'
                      state={mapGateVerdictToOsc(selectedRun.gateVerdict)}
                      label={`Gate: ${selectedRun.gateVerdict}`}
                    />
                  </div>

                  <p>{selectedRun.prompt}</p>

                  <div className={styles.gateControls} aria-label='Gate verdict override controls'>
                    {(['approved', 'rejected', 'pending'] as const).map(verdict => (
                      <Form key={verdict} method='post'>
                        <input type='hidden' name='intent' value='override-gate' />
                        <input type='hidden' name='runId' value={selectedRun.runId} />
                        <input type='hidden' name='gateVerdict' value={verdict} />
                        <Button.Root
                          type='submit'
                          size='sm'
                          variant={
                            verdict === 'approved'
                              ? 'primary'
                              : verdict === 'rejected'
                                ? 'danger'
                                : 'secondary'
                          }
                        >
                          <Button.Label>Set Gate: {verdict}</Button.Label>
                        </Button.Root>
                      </Form>
                    ))}
                  </div>

                  <div>
                    <h4 className={styles.sectionTitle}>
                      CHORD Turn Timeline ({selectedRun.turns.length})
                    </h4>
                    {selectedRun.turns.length === 0 ? (
                      <p className={styles.muted}>No recorded turns for this run.</p>
                    ) : (
                      <ul className={styles.turnList}>
                        {selectedRun.turns.map((turn, idx) => (
                          <li key={turn.id ?? `${turn.phase}-${idx}`} className={styles.turnItem}>
                            <details>
                              <summary className={styles.turnSummary}>
                                [{turn.phase}] {turn.agentName} — {turn.status} ({turn.latencyMs}
                                ms)
                              </summary>
                              <p className={styles.muted}>{turn.summary}</p>
                            </details>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {selectedRun.artifactHtml ? (
                    <div>
                      <h4 className={styles.sectionTitle}>Sandboxed Artifact Preview</h4>
                      <LazyChunkBoundary
                        loadingLabel='Loading sandboxed artifact preview...'
                        errorTitle='Unable to load artifact preview'
                        onChunkError={error => {
                          reportAdminLazyChunkError(
                            '@aklapper/ui/sandboxed-artifact-frame',
                            '/ops',
                            error,
                          );
                        }}
                      >
                        <LazySandboxedArtifactFrame
                          title={`Sandbox Run ${selectedRun.runId}`}
                          srcDoc={selectedRun.artifactHtml}
                        />
                      </LazyChunkBoundary>
                    </div>
                  ) : null}
                </article>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </TuiWindow>
  );
}
