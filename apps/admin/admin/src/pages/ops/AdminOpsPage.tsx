import type {
  ActionErrorMetadata,
  AdminOpsLoaderData,
  AdminSandboxRun,
  CadenceGateVerdict,
  K8sPodEvent,
  Osc7501State,
  QdrantHealthStatus,
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
import { markDeploymentWaking, useOpsClusterStream } from './opsClusterStore';

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
  readonly k8sWatchConfigured: boolean;
  readonly qdrantStatus?: QdrantHealthStatus;
}

export interface AdminOpsPageProps {
  data: AdminOpsPrimaryData | AdminOpsLoaderData;
  qdrantStatusSlot?: ReactNode;
  actionData?: AdminOpsActionData | null;
}

function mapPodPhaseToOsc(ev: K8sPodEvent): Osc7501State {
  if (ev.ready || ev.phase === 'Running') return 'ready';
  if (
    ev.phase === 'TriggeredScaleUp' ||
    ev.phase === 'ContainerCreating' ||
    ev.phase === 'Pending'
  ) {
    return 'scaling';
  }
  if (ev.phase === 'Terminating') return 'error';
  return 'idle';
}

function mapGateVerdictToOsc(verdict: CadenceGateVerdict): Osc7501State {
  if (verdict === 'approved') return 'ready';
  if (verdict === 'rejected') return 'error';
  return 'gate';
}

export function AdminOpsPage({ data, qdrantStatusSlot, actionData }: AdminOpsPageProps) {
  const cluster = useOpsClusterStream();
  const wakeFetcher = useFetcher<AdminOpsActionData>();
  const reindexFetcher = useFetcher<AdminOpsActionData>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    data.sandboxRuns[0]?.runId ?? null,
  );

  const selectedRun: AdminSandboxRun | null =
    data.sandboxRuns.find(run => run.runId === selectedRunId) ?? data.sandboxRuns[0] ?? null;

  const feedback = wakeFetcher.data ?? reindexFetcher.data ?? actionData ?? null;

  function triggerWake(deployment: string) {
    markDeploymentWaking(deployment);
    const formData = new FormData();
    formData.set('intent', 'wake-deployment');
    formData.set('deployment', deployment);
    void wakeFetcher.submit(formData, { method: 'post' });
  }

  return (
    <TuiWindow title='Cluster Watcher, Qdrant & Sandbox Audit // Ops'>
      <div className={styles.panel}>
        {feedback ? <ActionFeedbackBanner {...feedback} /> : null}

        <section className={styles.card} aria-label='Portfolio public cluster watcher'>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>GKE Pod Watcher (SSE)</h2>
            <OscStatusBadge
              source='cluster-sse'
              state={cluster.connected ? 'ready' : 'scaling'}
              label={
                cluster.connected
                  ? data.k8sWatchConfigured
                    ? 'Live GKE Stream'
                    : 'Simulation Stream Connected'
                  : 'Connecting / Fallback'
              }
            />
          </div>

          <div className={styles.namespaceGrid}>
            <div>
              <h3 className={styles.sectionTitle}>Namespace: portfolio-public</h3>
              <ul className={styles.podList}>
                {cluster.publicDeployments.map(ev => (
                  <li key={`${ev.namespace}:${ev.deployment}`} className={styles.podRow}>
                    <div className={styles.podMeta}>
                      <strong>{ev.deployment}</strong>
                      <span className={styles.muted}>
                        {ev.podName} · {ev.message}
                      </span>
                    </div>
                    <div className={styles.podActions}>
                      <OscStatusBadge
                        source={ev.deployment}
                        state={mapPodPhaseToOsc(ev)}
                        label={ev.phase}
                      />
                      <Button.Root
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => {
                          triggerWake(ev.deployment);
                        }}
                      >
                        <Button.Label>Wake {ev.deployment}</Button.Label>
                      </Button.Root>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
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
