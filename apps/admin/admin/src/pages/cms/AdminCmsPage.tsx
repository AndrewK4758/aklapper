import type {
  AdminCmsLoaderData,
  AgensiSkill,
  CadencePreset,
  MenuItem,
  QdrantHealthStatus,
  RoadmapMilestone,
} from '@aklapper/core';
import {
  Button,
  Field,
  OscStatusBadge,
  SandboxedArtifactFrame,
  Separator,
  Switch,
  Tabs,
  TuiWindow,
} from '@aklapper/ui';
import { useState } from 'react';
import { Form, useFetcher } from 'react-router';

import styles from './AdminCmsPage.module.css';

export interface AdminCmsActionData {
  ok: boolean;
  message: string;
}

export interface AdminCmsPageProps {
  data: AdminCmsLoaderData;
  qdrant: QdrantHealthStatus;
  actionData?: AdminCmsActionData | null;
}

export function AdminCmsPage({ data, qdrant, actionData }: AdminCmsPageProps) {
  const maintenanceFetcher = useFetcher<AdminCmsActionData>();
  const reindexFetcher = useFetcher<AdminCmsActionData>();

  const [selectedSiteKey, setSelectedSiteKey] = useState<string>(
    data.siteContents[0]?.key ?? 'portal-home',
  );
  const [selectedMenuSlug, setSelectedMenuSlug] = useState<string | null>(null);
  const [selectedProfileSlug, setSelectedProfileSlug] = useState<string>(
    data.terminalProfiles[0]?.slug ?? 'portal-shell',
  );
  const [selectedMilestoneSlug, setSelectedMilestoneSlug] = useState<string | null>(null);
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string | null>(null);
  const [selectedPresetSlug, setSelectedPresetSlug] = useState<string>(
    data.cadencePresets[0]?.slug ?? '',
  );
  const [previewDraftHtml, setPreviewDraftHtml] = useState<string | null>(null);

  const selectedSiteRow =
    data.siteContents.find(row => row.key === selectedSiteKey) ?? data.siteContents[0] ?? null;
  const editingMenuItem: MenuItem | null =
    data.menuItems.find(item => item.slug === selectedMenuSlug) ?? null;
  const selectedProfile =
    data.terminalProfiles.find(profile => profile.slug === selectedProfileSlug) ??
    data.terminalProfiles[0] ??
    null;
  const editingMilestone: RoadmapMilestone | null =
    data.roadmapMilestones.find(item => item.slug === selectedMilestoneSlug) ?? null;
  const editingSkill: AgensiSkill | null =
    data.agensiSkills.find(item => item.slug === selectedSkillSlug) ?? null;
  const selectedPreset: CadencePreset | null =
    data.cadencePresets.find(item => item.slug === selectedPresetSlug) ??
    data.cadencePresets[0] ??
    null;

  const activeFeedback = maintenanceFetcher.data ?? reindexFetcher.data ?? actionData ?? null;

  const optimisticMaintenance = maintenanceFetcher.formData
    ? maintenanceFetcher.formData.get('maintenanceModeDefault') === 'true'
    : data.maintenanceModeDefault;

  const activePreviewHtml = previewDraftHtml ?? selectedPreset?.starterArtifactHtml ?? '';

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
        {activeFeedback ? (
          activeFeedback.ok ? (
            <output className={styles.statusNote}>{activeFeedback.message}</output>
          ) : (
            <p role='alert' className={styles.errorNote}>
              {activeFeedback.message}
            </p>
          )
        ) : null}

        <Tabs.Root defaultValue='site'>
          <Tabs.List aria-label='CMS sections'>
            <Tabs.Tab value='site'>Site &amp; Maintenance</Tabs.Tab>
            <Tabs.Tab value='menu'>Menu Registry ({data.menuItems.length})</Tabs.Tab>
            <Tabs.Tab value='terminal'>Terminal &amp; Roadmap</Tabs.Tab>
            <Tabs.Tab value='agensi'>Agensi &amp; Presets</Tabs.Tab>
            <Tabs.Indicator />
          </Tabs.List>

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
                  <OscStatusBadge
                    source='qdrant'
                    state={qdrant.online ? 'ready' : 'idle'}
                    label={
                      qdrant.online
                        ? `${qdrant.collection}: ${qdrant.pointsCount} pts`
                        : 'Qdrant offline'
                    }
                  />
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
              <h2 className={styles.sectionTitle}>site_content JSON &amp; Markdown Editor</h2>
              <div className={styles.splitGrid}>
                <div className={styles.keyList}>
                  {data.siteContents.map(row => (
                    <button
                      key={row.key}
                      type='button'
                      className={styles.keyButton}
                      data-selected={selectedSiteRow?.key === row.key ? 'true' : 'false'}
                      onClick={() => {
                        setSelectedSiteKey(row.key);
                      }}
                    >
                      <span>{row.key}</span>
                    </button>
                  ))}
                </div>

                {selectedSiteRow ? (
                  <Form
                    key={`${selectedSiteRow.key}:${selectedSiteRow.updatedAt}`}
                    method='post'
                    className={styles.stackForm}
                  >
                    <input type='hidden' name='intent' value='upsert-site-content' />
                    <input type='hidden' name='key' value={selectedSiteRow.key} />
                    <p className={styles.muted}>
                      Editing key <code>{selectedSiteRow.key}</code> · last updated{' '}
                      {new Date(selectedSiteRow.updatedAt).toLocaleString()}
                    </p>
                    <Field.Root>
                      <Field.Label>Markdown Body</Field.Label>
                      <textarea
                        name='markdownBody'
                        className={styles.textarea}
                        defaultValue={selectedSiteRow.markdownBody}
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Metadata JSON (Zod validated per key)</Field.Label>
                      <textarea
                        name='metadataJson'
                        className={styles.textarea}
                        defaultValue={JSON.stringify(selectedSiteRow.metadataJson, null, 2)}
                      />
                    </Field.Root>
                    <div>
                      <Button.Root type='submit' variant='primary' size='sm'>
                        <Button.Label>Save Site Content</Button.Label>
                      </Button.Root>
                    </div>
                  </Form>
                ) : null}
              </div>
            </section>
          </Tabs.Panel>

          <Tabs.Panel value='menu' className={styles.tabPanel}>
            <section className={styles.card} aria-label='Menu items table'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>Menu Registry Items</h2>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setSelectedMenuSlug(null);
                  }}
                >
                  <Button.Label>New Menu Item</Button.Label>
                </Button.Root>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Slug</th>
                    <th>Title</th>
                    <th>Target Deploy</th>
                    <th>Order</th>
                    <th>Flags</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.menuItems.map(item => (
                    <tr key={item.slug}>
                      <td>[{item.keyShortcut}]</td>
                      <td>
                        <code>{item.slug}</code>
                      </td>
                      <td>{item.title}</td>
                      <td>
                        <code>{item.targetK8sDeploy ?? 'local'}</code> ({item.namespace ?? 'none'})
                      </td>
                      <td>{item.sortOrder}</td>
                      <td>
                        {item.enabled ? 'enabled' : 'disabled'} ·{' '}
                        {item.adminOnly ? 'admin' : 'public'}
                      </td>
                      <td className={styles.actionCell} aria-label={`Actions for ${item.slug}`}>
                        <Button.Root
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setSelectedMenuSlug(item.slug);
                          }}
                        >
                          <Button.Label>Edit</Button.Label>
                        </Button.Root>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='upsert-menu-item' />
                          <input type='hidden' name='slug' value={item.slug} />
                          <input type='hidden' name='keyShortcut' value={item.keyShortcut} />
                          <input type='hidden' name='title' value={item.title} />
                          <input type='hidden' name='description' value={item.description} />
                          <input
                            type='hidden'
                            name='targetK8sDeploy'
                            value={item.targetK8sDeploy ?? ''}
                          />
                          <input type='hidden' name='namespace' value={item.namespace ?? ''} />
                          <input type='hidden' name='sortOrder' value={String(item.sortOrder)} />
                          <input type='hidden' name='enabled' value={String(!item.enabled)} />
                          <input type='hidden' name='adminOnly' value={String(item.adminOnly)} />
                          <Button.Root type='submit' variant='secondary' size='sm'>
                            <Button.Label>{item.enabled ? 'Disable' : 'Enable'}</Button.Label>
                          </Button.Root>
                        </Form>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-menu-item' />
                          <input type='hidden' name='slug' value={item.slug} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className={styles.card} aria-label='Menu item form'>
              <h2 className={styles.sectionTitle}>
                {editingMenuItem ? `Edit Menu Item: ${editingMenuItem.slug}` : 'Create Menu Item'}
              </h2>
              <Form
                key={editingMenuItem?.slug ?? 'new-menu-item'}
                method='post'
                className={styles.stackForm}
              >
                <input type='hidden' name='intent' value='upsert-menu-item' />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Slug</Field.Label>
                    <Field.Control
                      name='slug'
                      defaultValue={editingMenuItem?.slug ?? ''}
                      placeholder='custom-module'
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Shortcut Key</Field.Label>
                    <Field.Control
                      name='keyShortcut'
                      defaultValue={editingMenuItem?.keyShortcut ?? ''}
                      placeholder='6'
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Title</Field.Label>
                    <Field.Control
                      name='title'
                      defaultValue={editingMenuItem?.title ?? ''}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Target Deployment</Field.Label>
                    <Field.Control
                      name='targetK8sDeploy'
                      defaultValue={editingMenuItem?.targetK8sDeploy ?? ''}
                      placeholder='svc-portal'
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Namespace</Field.Label>
                    <Field.Control
                      name='namespace'
                      defaultValue={editingMenuItem?.namespace ?? 'portfolio-public'}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Sort Order</Field.Label>
                    <Field.Control
                      name='sortOrder'
                      type='number'
                      min={0}
                      defaultValue={editingMenuItem?.sortOrder ?? data.menuItems.length + 1}
                      required
                    />
                  </Field.Root>
                </div>
                <Field.Root>
                  <Field.Label>Description</Field.Label>
                  <Field.Control
                    name='description'
                    defaultValue={editingMenuItem?.description ?? ''}
                    required
                  />
                </Field.Root>
                <div className={styles.inlineForm}>
                  <label className={styles.checkboxRow}>
                    <input
                      type='checkbox'
                      name='enabled'
                      value='true'
                      defaultChecked={editingMenuItem?.enabled ?? true}
                    />
                    Enabled
                  </label>
                  <label className={styles.checkboxRow}>
                    <input
                      type='checkbox'
                      name='adminOnly'
                      value='true'
                      defaultChecked={editingMenuItem?.adminOnly ?? false}
                    />
                    Admin Only
                  </label>
                </div>
                <div>
                  <Button.Root type='submit' variant='primary' size='sm'>
                    <Button.Label>Save Menu Item</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            </section>
          </Tabs.Panel>

          <Tabs.Panel value='terminal' className={styles.tabPanel}>
            <section className={styles.card} aria-label='Terminal profiles'>
              <h2 className={styles.sectionTitle}>Terminal Profiles</h2>
              <div className={styles.inlineForm}>
                {data.terminalProfiles.map(profile => (
                  <Button.Root
                    key={profile.slug}
                    type='button'
                    variant={selectedProfile?.slug === profile.slug ? 'primary' : 'secondary'}
                    size='sm'
                    onClick={() => {
                      setSelectedProfileSlug(profile.slug);
                    }}
                  >
                    <Button.Label>{profile.slug}</Button.Label>
                  </Button.Root>
                ))}
              </div>
              {selectedProfile ? (
                <Form key={selectedProfile.slug} method='post' className={styles.stackForm}>
                  <input type='hidden' name='intent' value='upsert-terminal-profile' />
                  <input type='hidden' name='slug' value={selectedProfile.slug} />
                  <div className={styles.formGrid}>
                    <Field.Root>
                      <Field.Label>Banner Title</Field.Label>
                      <Field.Control
                        name='bannerTitle'
                        defaultValue={selectedProfile.bannerTitle}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Banner Meta</Field.Label>
                      <Field.Control
                        name='bannerMeta'
                        defaultValue={selectedProfile.bannerMeta}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>OS Label</Field.Label>
                      <Field.Control
                        name='osLabel'
                        defaultValue={selectedProfile.osLabel}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Directory</Field.Label>
                      <Field.Control
                        name='directory'
                        defaultValue={selectedProfile.directory}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>VCS Branch</Field.Label>
                      <Field.Control
                        name='vcsBranch'
                        defaultValue={selectedProfile.vcsBranch}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>VCS State</Field.Label>
                      <select
                        name='vcsState'
                        className={styles.selectControl}
                        defaultValue={selectedProfile.vcsState}
                      >
                        <option value='clean'>clean</option>
                        <option value='modified'>modified</option>
                        <option value='untracked'>untracked</option>
                      </select>
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Context Label</Field.Label>
                      <Field.Control
                        name='contextLabel'
                        defaultValue={selectedProfile.contextLabel}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Placeholder</Field.Label>
                      <Field.Control
                        name='placeholder'
                        defaultValue={selectedProfile.placeholder}
                        required
                      />
                    </Field.Root>
                  </div>
                  <Field.Root>
                    <Field.Label>Quick Commands (comma-separated)</Field.Label>
                    <Field.Control
                      name='quickCommands'
                      defaultValue={selectedProfile.quickCommands.join(', ')}
                    />
                  </Field.Root>
                  <div>
                    <Button.Root type='submit' variant='primary' size='sm'>
                      <Button.Label>Save Terminal Profile</Button.Label>
                    </Button.Root>
                  </div>
                </Form>
              ) : null}
            </section>

            <section className={styles.card} aria-label='Terminal commands'>
              <h2 className={styles.sectionTitle}>
                Terminal Commands ({data.terminalCommands.length})
              </h2>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Command</th>
                    <th>Kind</th>
                    <th>Target / Output</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.terminalCommands.map(cmd => (
                    <tr key={cmd.id}>
                      <td>{cmd.profileSlug}</td>
                      <td>
                        <code>{cmd.name}</code>
                      </td>
                      <td>{cmd.kind}</td>
                      <td>{cmd.targetRoute ?? cmd.output}</td>
                      <td aria-label={`Delete command ${cmd.name}`}>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-terminal-command' />
                          <input type='hidden' name='id' value={String(cmd.id)} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Form method='post' className={styles.stackForm}>
                <input type='hidden' name='intent' value='upsert-terminal-command' />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Profile Slug</Field.Label>
                    <Field.Control
                      name='profileSlug'
                      defaultValue={selectedProfile?.slug ?? 'portal-shell'}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Command Name</Field.Label>
                    <Field.Control name='name' placeholder='status' required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Kind</Field.Label>
                    <select name='kind' className={styles.selectControl} defaultValue='static'>
                      <option value='static'>static</option>
                      <option value='navigate'>navigate</option>
                      <option value='cd'>cd</option>
                      <option value='tui'>tui</option>
                      <option value='roadmap'>roadmap</option>
                      <option value='uptime'>uptime</option>
                      <option value='clear'>clear</option>
                    </select>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Sort Order</Field.Label>
                    <Field.Control name='sortOrder' type='number' defaultValue={10} required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Target Route (optional)</Field.Label>
                    <Field.Control name='targetRoute' placeholder='/cadence' />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Allowed Routes (comma-separated)</Field.Label>
                    <Field.Control name='allowedRoutes' placeholder='/, /menu, /cadence' />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Field.Control name='description' placeholder='Describe command' required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Error Template (optional)</Field.Label>
                    <Field.Control name='errorTemplate' placeholder='Unknown target: {arg}' />
                  </Field.Root>
                </div>
                <Field.Root>
                  <Field.Label>Output Text</Field.Label>
                  <textarea name='output' className={styles.textarea} />
                </Field.Root>
                <div>
                  <Button.Root type='submit' variant='secondary' size='sm'>
                    <Button.Label>Add Terminal Command</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            </section>

            <section className={styles.card} aria-label='Terminal initial entries'>
              <h2 className={styles.sectionTitle}>
                Terminal Initial Entries ({data.terminalInitialEntries.length})
              </h2>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Command</th>
                    <th>Output</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.terminalInitialEntries.map(entry => (
                    <tr key={entry.id}>
                      <td>{entry.profileSlug}</td>
                      <td>
                        <code>{entry.command}</code>
                      </td>
                      <td>{entry.output}</td>
                      <td aria-label={`Delete entry ${entry.command}`}>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-terminal-entry' />
                          <input type='hidden' name='id' value={String(entry.id)} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Form method='post' className={styles.stackForm}>
                <input type='hidden' name='intent' value='upsert-terminal-entry' />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Profile Slug</Field.Label>
                    <Field.Control
                      name='profileSlug'
                      defaultValue={selectedProfile?.slug ?? 'portal-shell'}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Command</Field.Label>
                    <Field.Control name='command' placeholder='uname -a' required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Status</Field.Label>
                    <select name='status' className={styles.selectControl} defaultValue='ok'>
                      <option value='ok'>ok</option>
                      <option value='error'>error</option>
                    </select>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Duration Label</Field.Label>
                    <Field.Control name='durationLabel' defaultValue='12ms' required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Timestamp Label</Field.Label>
                    <Field.Control name='timestampLabel' defaultValue='00:00:00' required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Sort Order</Field.Label>
                    <Field.Control name='sortOrder' type='number' defaultValue={10} required />
                  </Field.Root>
                </div>
                <Field.Root>
                  <Field.Label>Output Text</Field.Label>
                  <textarea name='output' className={styles.textarea} />
                </Field.Root>
                <div>
                  <Button.Root type='submit' variant='secondary' size='sm'>
                    <Button.Label>Add Initial Entry</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            </section>

            <Separator.Root />

            <section className={styles.card} aria-label='Roadmap milestones'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>
                  Roadmap Milestones ({data.roadmapMilestones.length})
                </h2>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setSelectedMilestoneSlug(null);
                  }}
                >
                  <Button.Label>New Milestone</Button.Label>
                </Button.Root>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Status</th>
                    <th>Label</th>
                    <th>Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.roadmapMilestones.map(ms => (
                    <tr key={ms.slug}>
                      <td>
                        <code>{ms.slug}</code>
                      </td>
                      <td>{ms.status}</td>
                      <td>{ms.label}</td>
                      <td>{ms.sortOrder}</td>
                      <td className={styles.actionCell} aria-label={`Actions for ${ms.slug}`}>
                        <Button.Root
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setSelectedMilestoneSlug(ms.slug);
                          }}
                        >
                          <Button.Label>Edit</Button.Label>
                        </Button.Root>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-roadmap-milestone' />
                          <input type='hidden' name='slug' value={ms.slug} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Form
                key={editingMilestone?.slug ?? 'new-milestone'}
                method='post'
                className={styles.stackForm}
              >
                <input type='hidden' name='intent' value='upsert-roadmap-milestone' />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Slug</Field.Label>
                    <Field.Control
                      name='slug'
                      defaultValue={editingMilestone?.slug ?? ''}
                      placeholder='milestone-slug'
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Status</Field.Label>
                    <select
                      name='status'
                      className={styles.selectControl}
                      defaultValue={editingMilestone?.status ?? 'active'}
                    >
                      <option value='done'>done</option>
                      <option value='active'>active</option>
                      <option value='queued'>queued</option>
                    </select>
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Sort Order</Field.Label>
                    <Field.Control
                      name='sortOrder'
                      type='number'
                      defaultValue={
                        editingMilestone?.sortOrder ?? data.roadmapMilestones.length + 1
                      }
                      required
                    />
                  </Field.Root>
                </div>
                <Field.Root>
                  <Field.Label>Label</Field.Label>
                  <Field.Control
                    name='label'
                    defaultValue={editingMilestone?.label ?? ''}
                    required
                  />
                </Field.Root>
                <label className={styles.checkboxRow}>
                  <input
                    type='checkbox'
                    name='enabled'
                    value='true'
                    defaultChecked={editingMilestone?.enabled ?? true}
                  />
                  Enabled
                </label>
                <div>
                  <Button.Root type='submit' variant='primary' size='sm'>
                    <Button.Label>Save Milestone</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            </section>
          </Tabs.Panel>

          <Tabs.Panel value='agensi' className={styles.tabPanel}>
            <section className={styles.card} aria-label='Agensi skills'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>
                  Agensi Skills Showcase ({data.agensiSkills.length})
                </h2>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setSelectedSkillSlug(null);
                  }}
                >
                  <Button.Label>New Skill</Button.Label>
                </Button.Root>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Name</th>
                    <th>Tags</th>
                    <th>Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agensiSkills.map(skill => (
                    <tr key={skill.slug}>
                      <td>
                        <code>{skill.slug}</code>
                      </td>
                      <td>{skill.name}</td>
                      <td>{skill.tags.join(', ')}</td>
                      <td>{skill.sortOrder}</td>
                      <td className={styles.actionCell} aria-label={`Actions for ${skill.slug}`}>
                        <Button.Root
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setSelectedSkillSlug(skill.slug);
                          }}
                        >
                          <Button.Label>Edit</Button.Label>
                        </Button.Root>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-agensi-skill' />
                          <input type='hidden' name='slug' value={skill.slug} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Form
                key={editingSkill?.slug ?? 'new-skill'}
                method='post'
                className={styles.stackForm}
              >
                <input type='hidden' name='intent' value='upsert-agensi-skill' />
                <div className={styles.formGrid}>
                  <Field.Root>
                    <Field.Label>Slug</Field.Label>
                    <Field.Control
                      name='slug'
                      defaultValue={editingSkill?.slug ?? ''}
                      placeholder='skill-slug'
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Name</Field.Label>
                    <Field.Control name='name' defaultValue={editingSkill?.name ?? ''} required />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>URL</Field.Label>
                    <Field.Control
                      name='url'
                      type='url'
                      defaultValue={editingSkill?.url ?? 'https://agensi.io/'}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Tags (comma-separated)</Field.Label>
                    <Field.Control
                      name='tags'
                      defaultValue={editingSkill?.tags.join(', ') ?? ''}
                      placeholder='go, ssr, qdrant'
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Sort Order</Field.Label>
                    <Field.Control
                      name='sortOrder'
                      type='number'
                      defaultValue={editingSkill?.sortOrder ?? data.agensiSkills.length + 1}
                      required
                    />
                  </Field.Root>
                </div>
                <Field.Root>
                  <Field.Label>Summary</Field.Label>
                  <Field.Control
                    name='summary'
                    defaultValue={editingSkill?.summary ?? ''}
                    required
                  />
                </Field.Root>
                <div>
                  <Button.Root type='submit' variant='primary' size='sm'>
                    <Button.Label>Save Agensi Skill</Button.Label>
                  </Button.Root>
                </div>
              </Form>
            </section>

            <Separator.Root />

            <section className={styles.card} aria-label='CADENCE presets'>
              <div className={styles.cardHeader}>
                <h2 className={styles.sectionTitle}>
                  CADENCE Presets ({data.cadencePresets.length})
                </h2>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setSelectedPresetSlug('');
                    setPreviewDraftHtml('');
                  }}
                >
                  <Button.Label>New Preset</Button.Label>
                </Button.Root>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Slug</th>
                    <th>Title</th>
                    <th>Order</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cadencePresets.map(preset => (
                    <tr key={preset.slug}>
                      <td>
                        <code>{preset.slug}</code>
                      </td>
                      <td>{preset.title}</td>
                      <td>{preset.sortOrder}</td>
                      <td className={styles.actionCell} aria-label={`Actions for ${preset.slug}`}>
                        <Button.Root
                          type='button'
                          variant='ghost'
                          size='sm'
                          onClick={() => {
                            setSelectedPresetSlug(preset.slug);
                            setPreviewDraftHtml(preset.starterArtifactHtml);
                          }}
                        >
                          <Button.Label>Edit &amp; Preview</Button.Label>
                        </Button.Root>
                        <Form method='post'>
                          <input type='hidden' name='intent' value='delete-cadence-preset' />
                          <input type='hidden' name='slug' value={preset.slug} />
                          <Button.Root type='submit' variant='danger' size='sm'>
                            <Button.Label>Delete</Button.Label>
                          </Button.Root>
                        </Form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={styles.splitGrid}>
                <Form
                  key={selectedPresetSlug || 'new-preset'}
                  method='post'
                  className={styles.stackForm}
                >
                  <input type='hidden' name='intent' value='upsert-cadence-preset' />
                  <div className={styles.formGrid}>
                    <Field.Root>
                      <Field.Label>Slug</Field.Label>
                      <Field.Control
                        name='slug'
                        defaultValue={selectedPresetSlug ? (selectedPreset?.slug ?? '') : ''}
                        placeholder='preset-slug'
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Title</Field.Label>
                      <Field.Control
                        name='title'
                        defaultValue={selectedPresetSlug ? (selectedPreset?.title ?? '') : ''}
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Expected Kind</Field.Label>
                      <Field.Control
                        name='expectedKind'
                        defaultValue={
                          selectedPresetSlug ? (selectedPreset?.expectedKind ?? 'html') : 'html'
                        }
                        required
                      />
                    </Field.Root>
                    <Field.Root>
                      <Field.Label>Sort Order</Field.Label>
                      <Field.Control
                        name='sortOrder'
                        type='number'
                        defaultValue={
                          selectedPresetSlug
                            ? (selectedPreset?.sortOrder ?? 1)
                            : data.cadencePresets.length + 1
                        }
                        required
                      />
                    </Field.Root>
                  </div>
                  <Field.Root>
                    <Field.Label>Starter Prompt</Field.Label>
                    <textarea
                      name='starterPrompt'
                      className={styles.textarea}
                      defaultValue={selectedPresetSlug ? (selectedPreset?.starterPrompt ?? '') : ''}
                      required
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>Starter Artifact HTML</Field.Label>
                    <textarea
                      name='starterArtifactHtml'
                      className={styles.textarea}
                      value={activePreviewHtml}
                      onChange={event => {
                        setPreviewDraftHtml(event.target.value);
                      }}
                      required
                    />
                  </Field.Root>
                  <div>
                    <Button.Root type='submit' variant='primary' size='sm'>
                      <Button.Label>Save CADENCE Preset</Button.Label>
                    </Button.Root>
                  </div>
                </Form>

                <div className={styles.previewWrap}>
                  <span className={styles.muted}>Live SandboxedArtifactFrame Preview</span>
                  <SandboxedArtifactFrame
                    title={`CADENCE Preset Preview: ${selectedPreset?.title ?? 'Draft'}`}
                    srcDoc={
                      activePreviewHtml ||
                      '<html><body><p>Enter starter artifact HTML to preview inside sandbox.</p></body></html>'
                    }
                  />
                </div>
              </div>
            </section>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
    </TuiWindow>
  );
}
