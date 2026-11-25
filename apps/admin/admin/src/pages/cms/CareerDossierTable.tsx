import type { CareerDossier } from '@aklapper/core';
import { Button } from '@aklapper/ui';
import { Form } from 'react-router';

import styles from './AdminCmsPage.module.css';

export interface CareerDossierTableProps {
  readonly dossiers: readonly CareerDossier[];
  readonly onEdit: (dossier: CareerDossier) => void;
}

export function CareerDossierTable({ dossiers, onEdit }: CareerDossierTableProps) {
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>Slug</th>
          <th>Kind</th>
          <th>Title</th>
          <th>Status</th>
          <th>Chunks</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {dossiers.map(dossier => (
          <tr key={dossier.slug}>
            <td>{dossier.slug}</td>
            <td>{dossier.kind}</td>
            <td>{dossier.title}</td>
            <td>{dossier.publishStatus}</td>
            <td>{1 + dossier.sections.length}</td>
            <td className={styles.actionCell} aria-label={`Actions for ${dossier.slug}`}>
              <Button.Root
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => {
                  onEdit(dossier);
                }}
              >
                <Button.Label>Edit</Button.Label>
              </Button.Root>
              {dossier.publishStatus === 'draft' ? (
                <Form method='post'>
                  <input type='hidden' name='intent' value='publish-career-dossier' />
                  <input type='hidden' name='slug' value={dossier.slug} />
                  <Button.Root type='submit' variant='primary' size='sm'>
                    <Button.Label>Publish</Button.Label>
                  </Button.Root>
                </Form>
              ) : (
                <Form method='post'>
                  <input type='hidden' name='intent' value='unpublish-career-dossier' />
                  <input type='hidden' name='slug' value={dossier.slug} />
                  <Button.Root type='submit' variant='secondary' size='sm'>
                    <Button.Label>Unpublish</Button.Label>
                  </Button.Root>
                </Form>
              )}
              <Form method='post'>
                <input type='hidden' name='intent' value='delete-career-dossier' />
                <input type='hidden' name='slug' value={dossier.slug} />
                <Button.Root type='submit' variant='danger' size='sm'>
                  <Button.Label>Delete</Button.Label>
                </Button.Root>
              </Form>
            </td>
          </tr>
        ))}
        {dossiers.length === 0 ? (
          <tr>
            <td colSpan={6} className={styles.muted}>
              No career dossiers stored yet. Author a draft below or import markdown files.
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
