import type { AdminHomeContent, MenuItem } from '@aklapper/core';
import { Button, Separator, Toolbar, TuiWindow } from '@aklapper/ui';
import { Link } from 'react-router';

import styles from './AdminHomePage.module.css';

export interface AdminHomePageProps {
  content: AdminHomeContent;
  menuItems: readonly MenuItem[];
}

export function AdminHomePage({ content, menuItems }: AdminHomePageProps) {
  return (
    <div className={styles.frame}>
      <TuiWindow title={content.heading}>
        <div className={styles.card} aria-labelledby='admin-heading'>
          <h1 id='admin-heading'>{content.heading}</h1>
          <p>{content.description}</p>
          <Toolbar.Root className={styles.actions} aria-label='Admin actions'>
            {content.actions.map(action => (
              <Button.Link
                key={action.to}
                render={<Link to={action.to} />}
                variant={action.variant}
              >
                <Button.Label>{action.label}</Button.Label>
              </Button.Link>
            ))}
          </Toolbar.Root>
          <Separator.Root />
          <ul className={styles.registryList}>
            {menuItems.map(item => (
              <li key={item.slug} className={styles.registryItem}>
                [{item.keyShortcut}] <strong>{item.title}</strong> (
                {item.adminOnly ? 'admin' : 'public'})
              </li>
            ))}
          </ul>
        </div>
      </TuiWindow>
    </div>
  );
}
