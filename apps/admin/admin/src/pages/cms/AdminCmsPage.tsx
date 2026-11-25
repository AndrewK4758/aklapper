import type {
  ActionErrorMetadata,
  AdminCmsLoaderData,
  PrivacySanitizationFinding,
  QdrantHealthStatus,
} from '@aklapper/core';
import {
  ActionFeedbackBanner,
  Button,
  Field,
  LazyChunkBoundary,
  lazyWithRetry,
  OscStatusBadge,
  Switch,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { type ReactNode, useState } from 'react';
import { Form, useFetcher } from 'react-router';

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
  const maintenanceFetcher = useFetcher<AdminCmsActionData>();
  const reindexFetcher = useFetcher<AdminCmsActionData>();

  const [lastMaintenanceData, setLastMaintenanceData] = useState<AdminCmsActionData | undefined>(
    undefined,
  );
  const [lastReindexData, setLastReindexData] = useState<AdminCmsActionData | undefined>(undefined);
  const [lastActionData, setLastActionData] = useState<AdminCmsActionData | null | undefined>(
    undefined,
  );
  const [latestFeedback, setLatestFeedback] = useState<AdminCmsActionData | null>(
    () => actionData ?? null,
  );

  if (maintenanceFetcher.data && maintenanceFetcher.data !== lastMaintenanceData) {
    setLastMaintenanceData(maintenanceFetcher.data);
    setLatestFeedback(maintenanceFetcher.data);
  } else if (reindexFetcher.data && reindexFetcher.data !== lastReindexData) {
    setLastReindexData(reindexFetcher.data);
    setLatestFeedback(reindexFetcher.data);
  } else if (actionData !== lastActionData) {
    setLastActionData(actionData);
    if (actionData) {
      setLatestFeedback(actionData);
    }
  }

  const activeFeedback = latestFeedback ?? actionData ?? null;

  const optimisticMaintenance = maintenanceFetcher.formData
    ? maintenanceFetcher.formData.get('maintenanceModeDefault') === 'true'
    : data.maintenanceModeDefault;

  function handleMaintenanceSwitch(nextChecked: boolean) {
    const payload = new FormData();
    payload.set('intent', 'set-maintenance');
    payload.set('maintenanceModeDefault', String(nextChecked));
    payload.set('rebuildProgressPercent', String(data.rebuildProgressPercent));
    void maintenanceFetcher.submit(payload, { method: 'post' });
  }

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
            <Tabs.Tab value='site'>Site &amp; Maintenance</Tabs.Tab>
            <Tabs.Tab value='dossiers'>Career Dossiers ({data.careerDossiers.length})</Tabs.Tab>
            <Tabs.Tab value='menu'>Menu Registry ({data.menuItems.length})</Tabs.Tab>
            <Tabs.Tab value='terminal'>Terminal &amp; Roadmap</Tabs.Tab>
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
            <section className={styles.card} aria-label='Portal maintenance controls'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>Live Maintenance Mode &amp; Qdrant Index</h2>
                <OscStatusBadge
                  source='portal-mode'
                  state={optimisticMaintenance ? 'scaling' : 'ready'}
                  label={optimisticMaintenance ? 'Maintenance Active' : 'Portal Live'}
                />
              </div>

              <div className={styles.maintenanceRow}>
                <div className={styles.switchGroup}>
                  <Switch.Root
                    id='maintenance-mode-switch'
                    aria-label='Maintenance Mode'
                    checked={optimisticMaintenance}
                    onCheckedChange={checked => {
                      handleMaintenanceSwitch(Boolean(checked));
                    }}
                  >
                    <Switch.Thumb />
                  </Switch.Root>
                  <Switch.Label htmlFor='maintenance-mode-switch'>
                    Maintenance Mode Default ({optimisticMaintenance ? 'ON' : 'OFF'})
                  </Switch.Label>
                </div>

                <Form method='post' className={styles.inlineForm}>
                  <input type='hidden' name='intent' value='set-maintenance' />
                  <input
                    type='hidden'
                    name='maintenanceModeDefault'
                    value={String(optimisticMaintenance)}
                  />
                  <Field.Root>
                    <Field.Label>Rebuild Progress (%)</Field.Label>
                    <Field.Control
                      name='rebuildProgressPercent'
                      type='number'
                      min={0}
                      max={100}
                      defaultValue={data.rebuildProgressPercent}
                      key={data.rebuildProgressPercent}
                      required
                    />
                  </Field.Root>
                  <Button.Root type='submit' variant='secondary' size='sm'>
                    <Button.Label>Update Progress</Button.Label>
                  </Button.Root>
                </Form>

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
              <SiteContentEditorPanel siteContents={data.siteContents} />
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
              loadingLabel='Loading terminal & roadmap editor...'
              errorTitle='Unable to load Terminal & Roadmap tab'
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
