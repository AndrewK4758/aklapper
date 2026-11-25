import type {
  ActionErrorMetadata,
  AdminOpsLoaderData,
  AdminSandboxRun,
  CadenceGateVerdict,
  K8sPodEvent,
  Osc7501State,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  OscStatusBadge,
  SandboxedArtifactFrame,
  Separator,
  TuiWindow,
} from '@aklapper/ui';
import { useState } from 'react';
import { Form, useFetcher } from 'react-router';

import { markDeploymentWaking, useOpsClusterStream } from './opsClusterStore';

import styles from './AdminOpsPage.module.css';

export interface AdminOpsActionData extends ActionErrorMetadata {
  ok: boolean;
  message: string;
}

export interface AdminOpsPageProps {
  data: AdminOpsLoaderData;
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

export function AdminOpsPage({ data, actionData }: AdminOpsPageProps) {
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
    <TuiWindow title='Cluster Watcher, cadence-admin & Sandbox Audit // Ops'>
      <div className={styles.panel}>
        {feedback ? <ActionFeedbackBanner {...feedback} /> : null}

        <section className={styles.card} aria-label='Dual-namespace cluster watcher'>
          <div className={styles.cardHeader}>
            <h2 className={styles.sectionTitle}>Dual-Namespace GKE Pod Watcher (SSE)</h2>
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

            <div>
              <h3 className={styles.sectionTitle}>Namespace: cadence-admin</h3>
              <ul className={styles.podList}>
                {cluster.adminDeployments.map(ev => (
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
                        variant='primary'
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

        <div className={styles.runtimeGrid}>
          <section className={styles.card} aria-label='cadence-admin runtime status'>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>cadence-admin Runtime</h2>
              <OscStatusBadge
                source='cadence-admin'
                state={data.cadenceAdminStatus.online ? 'ready' : 'idle'}
                label={data.cadenceAdminStatus.online ? 'Online' : 'Offline / Direct PG19'}
              />
            </div>
            <div className={styles.statList}>
              <div className={styles.statRow}>
                <span>Namespace</span>
                <code>{data.cadenceAdminStatus.namespace}</code>
              </div>
              <div className={styles.statRow}>
                <span>Mode</span>
                <code>{data.cadenceAdminStatus.mode}</code>
              </div>
              <div className={styles.statRow}>
                <span>PG19 Connected</span>
                <strong>{data.cadenceAdminStatus.databaseConnected ? 'Yes' : 'No'}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Total Sandbox Runs / Pending Gates</span>
                <strong>
                  {data.cadenceAdminStatus.totalSandboxRuns} /{' '}
                  {data.cadenceAdminStatus.pendingGates}
                </strong>
              </div>
            </div>
            {data.cadenceAdminStatus.detail ? (
              <p className={styles.muted}>{data.cadenceAdminStatus.detail}</p>
            ) : null}
          </section>

          <section className={styles.card} aria-label='Qdrant vector index health'>
            <div className={styles.cardHeader}>
              <h2 className={styles.sectionTitle}>Qdrant Vector Index</h2>
              <OscStatusBadge
                source='qdrant'
                state={data.qdrantStatus.online ? 'ready' : 'idle'}
                label={data.qdrantStatus.status}
              />
            </div>
            <div className={styles.statList}>
              <div className={styles.statRow}>
                <span>Collection</span>
                <code>{data.qdrantStatus.collection}</code>
              </div>
              <div className={styles.statRow}>
                <span>Indexed Points</span>
                <strong>{data.qdrantStatus.pointsCount}</strong>
              </div>
              <div className={styles.statRow}>
                <span>Provider</span>
                <code>{data.qdrantStatus.provider}</code>
              </div>
              {data.qdrantStatus.collections?.map(col => (
                <div key={col.name} className={styles.statRow}>
                  <span>{col.name}</span>
                  <strong>
                    {col.pointsCount} pts ({col.status})
                  </strong>
                </div>
              ))}
            </div>
            {data.qdrantStatus.detail ? (
              <p className={styles.muted}>{data.qdrantStatus.detail}</p>
            ) : null}
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
          </section>
        </div>

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
                      <SandboxedArtifactFrame
                        title={`Sandbox Run ${selectedRun.runId}`}
                        srcDoc={selectedRun.artifactHtml}
                      />
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
