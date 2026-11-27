import type {
  ActionErrorMetadata,
  AdminCmsLoaderData,
  PrivacySanitizationFinding,
  QdrantHealthStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  LazyChunkBoundary,
  lazyWithRetry,
  OscStatusBadge,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import { useFetcher } from 'react-router';

import { reportAdminLazyChunkError } from '../client-telemetry';
import { SiteContentEditorPanel } from './SiteContentEditorPanel';

import styles from './AdminCmsPage.module.css';

const LazyCareerDossierSection = lazyWithRetry(() =>
  import('./CareerDossierSection').then(mod => ({ default: mod.CareerDossierSection })),
);
const LazyCmsMenuTab = lazyWithRetry(() =>
  import('./CmsMenuTab').then(mod => ({ default: mod.CmsMenuTab })),
);
const LazyCmsTerminalTab = lazyWithRetry(() =>
  import('./CmsTerminalTab').then(mod => ({ default: mod.CmsTerminalTab })),
);
const LazyCmsAgensiPresetsTab = lazyWithRetry(() =>
  import('./CmsAgensiPresetsTab').then(mod => ({ default: mod.CmsAgensiPresetsTab })),
);

export interface AdminCmsActionData extends ActionErrorMetadata {
  ok: boolean;
  message: string;
  sanitizationFindings?: readonly PrivacySanitizationFinding[];
}

export interface AdminCmsPageProps {
  data: AdminCmsLoaderData;
  qdrant?: QdrantHealthStatus;
  qdrantStatusSlot?: ReactNode;
  actionData?: AdminCmsActionData | null;
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
}

export function AdminCmsPage({
  data,
  qdrant,
  qdrantStatusSlot,
  actionData,
  activeTab,
  onActiveTabChange,
}: AdminCmsPageProps) {
  const reindexFetcher = useFetcher<AdminCmsActionData>();

  const [lastReindexData, setLastReindexData] = useState<AdminCmsActionData | undefined>(undefined);
  const [lastActionData, setLastActionData] = useState<AdminCmsActionData | null | undefined>(
    undefined,
  );
  const [latestFeedback, setLatestFeedback] = useState<AdminCmsActionData | null>(
    () => actionData ?? null,
  );

  if (reindexFetcher.data && reindexFetcher.data !== lastReindexData) {
    setLastReindexData(reindexFetcher.data);
    setLatestFeedback(reindexFetcher.data);
  } else if (actionData !== lastActionData) {
    setLastActionData(actionData);
    if (actionData) {
      setLatestFeedback(actionData);
    }
  }

  const activeFeedback = latestFeedback ?? actionData ?? null;

  return (
    <TuiWindow title='PostgreSQL 19 CMS // Site, Registry, Terminal & Presets'>
      <div className={styles.panel}>
        {activeFeedback ? <ActionFeedbackBanner {...activeFeedback} /> : null}

        <Tabs.Root
          {...(activeTab !== undefined
            ? {
                value: activeTab,
                onValueChange: value => {
                  onActiveTabChange?.(String(value));
                },
              }
            : { defaultValue: 'site' })}
        >
          <Tabs.List aria-label='CMS sections'>
            <Tabs.Tab value='site'>Site Content</Tabs.Tab>
            <Tabs.Tab value='dossiers'>Career Dossiers ({data.careerDossiers.length})</Tabs.Tab>
            <Tabs.Tab value='menu'>Menu Registry ({data.menuItems.length})</Tabs.Tab>
            <Tabs.Tab value='terminal'>Terminal</Tabs.Tab>
            <Tabs.Tab value='agensi'>Agensi &amp; Presets</Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>

          <Tabs.Panel value='dossiers' className={styles.tabPanel}>
            <LazyChunkBoundary
              loadingLabel='Loading career dossier studio...'
              errorTitle='Unable to load Career Dossiers tab'
              onChunkError={error => {
                reportAdminLazyChunkError('./CareerDossierSection', '/cms', error);
              }}
            >
              <LazyCareerDossierSection
                dossiers={data.careerDossiers}
                qdrant={qdrant}
                qdrantStatusSlot={qdrantStatusSlot}
                sanitizationFindings={actionData?.sanitizationFindings}
                reindexFetcher={reindexFetcher}
              />
            </LazyChunkBoundary>
          </Tabs.Panel>

          <Tabs.Panel value='site' className={styles.tabPanel}>
            <section className={styles.card} aria-label='Qdrant index controls'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>Qdrant Corpus Index</h2>
                <reindexFetcher.Form method='post' className={styles.inlineForm}>
                  <input type='hidden' name='intent' value='reindex-qdrant' />
                  {qdrantStatusSlot ?? (
                    <OscStatusBadge
                      source='qdrant'
                      state={qdrant?.online ? 'ready' : 'idle'}
                      label={
                        qdrant?.online
                          ? `${qdrant.collection}: ${qdrant.pointsCount} pts`
                          : 'Qdrant offline'
                      }
                    />
                  )}
                  <Button.Root
                    type='submit'
                    variant='primary'
                    size='sm'
                    loading={reindexFetcher.state !== 'idle'}
                  >
                    <Button.Label>Re-Index Qdrant Corpus</Button.Label>
                  </Button.Root>
                </reindexFetcher.Form>
              </div>
            </section>

            <section className={styles.card} aria-label='Site content editor'>
              <h2 className={styles.sectionTitle}>
                Site Content Structured Editor &amp; Live Preview
              </h2>
              <SiteContentEditorPanel
                siteContents={data.siteContents}
                careerDossiers={data.careerDossiers}
              />
            </section>
          </Tabs.Panel>

          <Tabs.Panel value='menu' className={styles.tabPanel}>
            <LazyChunkBoundary
              loadingLabel='Loading menu registry editor...'
              errorTitle='Unable to load Menu Registry tab'
              onChunkError={error => {
                reportAdminLazyChunkError('./CmsMenuTab', '/cms', error);
              }}
            >
              <LazyCmsMenuTab menuItems={data.menuItems} />
            </LazyChunkBoundary>
          </Tabs.Panel>

          <Tabs.Panel value='terminal' className={styles.tabPanel}>
            <LazyChunkBoundary
              loadingLabel='Loading terminal editor...'
              errorTitle='Unable to load Terminal tab'
              onChunkError={error => {
                reportAdminLazyChunkError('./CmsTerminalTab', '/cms', error);
              }}
            >
              <LazyCmsTerminalTab data={data} />
            </LazyChunkBoundary>
          </Tabs.Panel>

          <Tabs.Panel value='agensi' className={styles.tabPanel}>
            <LazyChunkBoundary
              loadingLabel='Loading Agensi & presets editor...'
              errorTitle='Unable to load Agensi & Presets tab'
              onChunkError={error => {
                reportAdminLazyChunkError('./CmsAgensiPresetsTab', '/cms', error);
              }}
            >
              <LazyCmsAgensiPresetsTab data={data} />
            </LazyChunkBoundary>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
    </TuiWindow>
  );
}
