import type { MenuItem } from '@aklapper/core';
import { Button, Field } from '@aklapper/ui';
import { useState } from 'react';
import { Form } from 'react-router';

import styles from './AdminCmsPage.module.css';

export interface CmsMenuTabProps {
  readonly menuItems: readonly MenuItem[];
}

export function CmsMenuTab({ menuItems }: CmsMenuTabProps) {
  const [selectedMenuSlug, setSelectedMenuSlug] = useState<string | null>(null);
  const editingMenuItem: MenuItem | null =
    menuItems.find(item => item.slug === selectedMenuSlug) ?? null;

  return (
    <>
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
            {menuItems.map(item => (
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
                  {item.enabled ? 'enabled' : 'disabled'} · {item.adminOnly ? 'admin' : 'public'}
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
              <Field.Control name='title' defaultValue={editingMenuItem?.title ?? ''} required />
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
                defaultValue={editingMenuItem?.sortOrder ?? menuItems.length + 1}
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
    </>
  );
}
