import type { QdrantHealthStatus } from '@aklapper/core';
import { OscStatusBadge } from '@aklapper/ui';
import type { ReactNode } from 'react';

import styles from './AdminOpsPage.module.css';

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
  readonly qdrantStatus?: QdrantHealthStatus;
  readonly qdrantStatusSlot?: ReactNode;
  readonly reindexForm: ReactNode;
}

export function AdminOpsRuntimeCards({
  qdrantStatus,
  qdrantStatusSlot,
  reindexForm,
}: AdminOpsRuntimeCardsProps) {
  return (
    <div className={styles.runtimeGrid}>
      <section className={styles.card} aria-label='Qdrant vector index health'>
        {qdrantStatusSlot ??
          (qdrantStatus ? <QdrantRuntimeStatusBody status={qdrantStatus} /> : null)}
        {reindexForm}
      </section>
    </div>
  );
}
