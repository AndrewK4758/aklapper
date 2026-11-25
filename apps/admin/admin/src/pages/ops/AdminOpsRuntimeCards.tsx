import type { CadenceAdminStatus, QdrantHealthStatus } from '@aklapper/core';
import { OscStatusBadge } from '@aklapper/ui';
import type { ReactNode } from 'react';

import styles from './AdminOpsPage.module.css';

export function CadenceRuntimeStatusBody({ status }: { readonly status: CadenceAdminStatus }) {
  return (
    <>
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>cadence-admin Runtime</h2>
        <OscStatusBadge
          source='cadence-admin'
          state={status.online ? 'ready' : 'idle'}
          label={status.online ? 'Online' : 'Offline / Direct PG19'}
        />
      </div>
      <div className={styles.statList}>
        <div className={styles.statRow}>
          <span>Namespace</span>
          <code>{status.namespace}</code>
        </div>
        <div className={styles.statRow}>
          <span>Mode</span>
          <code>{status.mode}</code>
        </div>
        <div className={styles.statRow}>
          <span>PG19 Connected</span>
          <strong>{status.databaseConnected ? 'Yes' : 'No'}</strong>
        </div>
        <div className={styles.statRow}>
          <span>Total Sandbox Runs / Pending Gates</span>
          <strong>
            {status.totalSandboxRuns} / {status.pendingGates}
          </strong>
        </div>
      </div>
      {status.detail ? <p className={styles.muted}>{status.detail}</p> : null}
    </>
  );
}

export function QdrantRuntimeStatusBody({ status }: { readonly status: QdrantHealthStatus }) {
  return (
    <>
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>Qdrant Vector Index</h2>
        <OscStatusBadge
          source='qdrant'
          state={status.online ? 'ready' : 'idle'}
          label={status.status}
        />
      </div>
      <div className={styles.statList}>
        <div className={styles.statRow}>
          <span>Collection</span>
          <code>{status.collection}</code>
        </div>
        <div className={styles.statRow}>
          <span>Indexed Points</span>
          <strong>{status.pointsCount}</strong>
        </div>
        <div className={styles.statRow}>
          <span>Provider</span>
          <code>{status.provider}</code>
        </div>
        {status.collections?.map(col => (
          <div key={col.name} className={styles.statRow}>
            <span>{col.name}</span>
            <strong>
              {col.pointsCount} pts ({col.status})
            </strong>
          </div>
        ))}
      </div>
      {status.detail ? <p className={styles.muted}>{status.detail}</p> : null}
    </>
  );
}

export interface AdminOpsRuntimeCardsProps {
  readonly cadenceAdminStatus?: CadenceAdminStatus;
  readonly qdrantStatus?: QdrantHealthStatus;
  readonly cadenceStatusSlot?: ReactNode;
  readonly qdrantStatusSlot?: ReactNode;
  readonly reindexForm: ReactNode;
}

export function AdminOpsRuntimeCards({
  cadenceAdminStatus,
  qdrantStatus,
  cadenceStatusSlot,
  qdrantStatusSlot,
  reindexForm,
}: AdminOpsRuntimeCardsProps) {
  return (
    <div className={styles.runtimeGrid}>
      <section className={styles.card} aria-label='cadence-admin runtime status'>
        {cadenceStatusSlot ??
          (cadenceAdminStatus ? <CadenceRuntimeStatusBody status={cadenceAdminStatus} /> : null)}
      </section>

      <section className={styles.card} aria-label='Qdrant vector index health'>
        {qdrantStatusSlot ??
          (qdrantStatus ? <QdrantRuntimeStatusBody status={qdrantStatus} /> : null)}
        {reindexForm}
      </section>
    </div>
  );
}
