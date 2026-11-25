import type { RoadmapMilestone } from '@aklapper/core';
import { Button, Field } from '@aklapper/ui';
import { useState } from 'react';
import { Form } from 'react-router';

import styles from './AdminCmsPage.module.css';

export interface CmsRoadmapSectionProps {
  readonly roadmapMilestones: readonly RoadmapMilestone[];
}

export function CmsRoadmapSection({ roadmapMilestones }: CmsRoadmapSectionProps) {
  const [selectedMilestoneSlug, setSelectedMilestoneSlug] = useState<string | null>(null);
  const editingMilestone: RoadmapMilestone | null =
    roadmapMilestones.find(item => item.slug === selectedMilestoneSlug) ?? null;

  return (
    <section className={styles.card} aria-label='Roadmap milestones'>
      <div className={styles.cardHeader}>
        <h2 className={styles.sectionTitle}>Roadmap Milestones ({roadmapMilestones.length})</h2>
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
          {roadmapMilestones.map(ms => (
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
              defaultValue={editingMilestone?.sortOrder ?? roadmapMilestones.length + 1}
              required
            />
          </Field.Root>
        </div>
        <Field.Root>
          <Field.Label>Label</Field.Label>
          <Field.Control name='label' defaultValue={editingMilestone?.label ?? ''} required />
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
  );
}
