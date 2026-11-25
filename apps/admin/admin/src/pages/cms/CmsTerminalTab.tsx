import type { AdminCmsLoaderData } from '@aklapper/core';
import { Button, Field, Separator } from '@aklapper/ui';
import { useState } from 'react';
import { Form } from 'react-router';

import { CmsRoadmapSection } from './CmsRoadmapSection';

import styles from './AdminCmsPage.module.css';

export interface CmsTerminalTabProps {
  readonly data: Pick<
    AdminCmsLoaderData,
    | 'terminalProfiles'
    | 'terminalCommands'
    | 'terminalInitialEntries'
    | 'terminalDirectoryEntries'
    | 'roadmapMilestones'
  >;
}

export function CmsTerminalTab({ data }: CmsTerminalTabProps) {
  const [selectedProfileSlug, setSelectedProfileSlug] = useState<string>(
    data.terminalProfiles[0]?.slug ?? 'portal-shell',
  );
  const selectedProfile =
    data.terminalProfiles.find(profile => profile.slug === selectedProfileSlug) ??
    data.terminalProfiles[0] ??
    null;

  return (
    <>
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
                <Field.Control name='osLabel' defaultValue={selectedProfile.osLabel} required />
              </Field.Root>
              <Field.Root>
                <Field.Label>Directory</Field.Label>
                <Field.Control name='directory' defaultValue={selectedProfile.directory} required />
              </Field.Root>
              <Field.Root>
                <Field.Label>VCS Branch</Field.Label>
                <Field.Control name='vcsBranch' defaultValue={selectedProfile.vcsBranch} required />
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
        <h2 className={styles.sectionTitle}>Terminal Commands ({data.terminalCommands.length})</h2>
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

      <section className={styles.card} aria-label='Terminal directory entries'>
        <h2 className={styles.sectionTitle}>
          Terminal Directory Entries ({data.terminalDirectoryEntries.length})
        </h2>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Name</th>
              <th>Description</th>
              <th>Order</th>
              <th>Enabled</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.terminalDirectoryEntries.map(entry => (
              <tr key={entry.id}>
                <td>{entry.profileSlug}</td>
                <td>
                  <code>{entry.name}</code>
                </td>
                <td>{entry.description}</td>
                <td>{entry.sortOrder}</td>
                <td>{entry.enabled ? 'yes' : 'no'}</td>
                <td aria-label={`Delete directory entry ${entry.name}`}>
                  <Form method='post'>
                    <input type='hidden' name='intent' value='delete-terminal-directory-entry' />
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
          <input type='hidden' name='intent' value='upsert-terminal-directory-entry' />
          <div className={styles.formGrid}>
            <Field.Root>
              <Field.Label>Profile Slug</Field.Label>
              <Field.Control
                name='profileSlug'
                defaultValue={selectedProfile?.slug ?? 'portal-home'}
                required
              />
            </Field.Root>
            <Field.Root>
              <Field.Label>Entry Name</Field.Label>
              <Field.Control name='name' placeholder='menu' required />
            </Field.Root>
            <Field.Root>
              <Field.Label>Description</Field.Label>
              <Field.Control name='description' placeholder='Site menu' required />
            </Field.Root>
            <Field.Root>
              <Field.Label>Sort Order</Field.Label>
              <Field.Control name='sortOrder' type='number' defaultValue={10} required />
            </Field.Root>
            <Field.Root>
              <Field.Label>Enabled</Field.Label>
              <select name='enabled' className={styles.selectControl} defaultValue='true'>
                <option value='true'>true</option>
                <option value='false'>false</option>
              </select>
            </Field.Root>
          </div>
          <div>
            <Button.Root type='submit' variant='secondary' size='sm'>
              <Button.Label>Save Directory Entry</Button.Label>
            </Button.Root>
          </div>
        </Form>
      </section>

      <Separator.Root />

      <CmsRoadmapSection roadmapMilestones={data.roadmapMilestones} />
    </>
  );
}
