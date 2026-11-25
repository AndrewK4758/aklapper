import type { AgensiSkill, AgensiSyncState } from '@aklapper/core';
import { Button, OscStatusBadge } from '@aklapper/ui';
import { Form } from 'react-router';

export interface AgensiCacheSectionProps {
  readonly skills: readonly AgensiSkill[];
  readonly syncState?: AgensiSyncState | null;
  readonly styles: Readonly<Record<string, string>>;
}

function resolveBadgeState(status: AgensiSyncState['lastStatus'] | undefined) {
  switch (status) {
    case 'ok':
      return 'ready' as const;
    case 'error':
      return 'error' as const;
    default:
      return 'idle' as const;
  }
}

/** Read-only Agensi cache status & creator-scoped catalog table with explicit catalog sync trigger. */
export function AgensiCacheSection({ skills, syncState, styles }: AgensiCacheSectionProps) {
  const statusLabel = syncState
    ? `${syncState.lastStatus} · @${syncState.creatorHandle}`
    : 'idle · awaiting first sync';

  return (
    <section className={styles['card']} aria-label='Agensi skills'>
      <div className={styles['cardHeader']}>
        <div>
          <h2 className={styles['sectionTitle']}>Creator Agensi Cache ({skills.length})</h2>
          <p className={styles['muted']}>
            Last synced: {syncState?.lastSyncedAt ?? 'never'} · Last attempt:{' '}
            {syncState?.lastAttemptAt ?? 'never'} · Tracked items:{' '}
            {syncState?.itemCount ?? skills.length}
          </p>
        </div>
        <div className={styles['actionCell']}>
          <OscStatusBadge
            source='agensi-sync'
            state={resolveBadgeState(syncState?.lastStatus)}
            label={statusLabel}
          />
          <Form method='post'>
            <input type='hidden' name='intent' value='sync-agensi-catalog' />
            <Button.Root type='submit' variant='primary' size='sm'>
              <Button.Label>Sync Agensi Catalog</Button.Label>
            </Button.Root>
          </Form>
        </div>
      </div>

      {syncState?.lastError ? (
        <output className={styles['errorNote']}>Last sync error: {syncState.lastError}</output>
      ) : null}

      <table className={styles['dataTable']}>
        <thead>
          <tr>
            <th>Slug</th>
            <th>Name</th>
            <th>Creator</th>
            <th>Published</th>
            <th>Source</th>
            <th>Synced At</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {skills.length === 0 ? (
            <tr>
              <td colSpan={7} className={styles['muted']}>
                No published cached items recorded for this creator yet. Trigger &ldquo;Sync Agensi
                Catalog&rdquo; to populate PG19 cache.
              </td>
            </tr>
          ) : (
            skills.map(skill => (
              <tr key={skill.slug}>
                <td>
                  <code>{skill.slug}</code>
                </td>
                <td>{skill.name}</td>
                <td>{skill.creatorHandle ?? 'aklapper'}</td>
                <td>{skill.isPublished === false ? 'false' : 'true'}</td>
                <td>{skill.source ?? 'agensi_api'}</td>
                <td>{skill.syncedAt ?? '—'}</td>
                <td>{skill.tags.join(', ')}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
