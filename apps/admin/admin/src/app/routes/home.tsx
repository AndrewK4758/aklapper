import type { AdminHomeLoaderData } from '@aklapper/contracts';
import { loadAdminHomeDataWithPrerender } from '@aklapper/db';
import { Button, Separator, Toolbar, TuiWindow } from '@aklapper/ui';
import { Link, type MetaArgs, useLoaderData } from 'react-router';

import { buildAdminPageMeta } from '../seo';

import styles from './home.module.css';

export async function loader(): Promise<AdminHomeLoaderData> {
  return loadAdminHomeDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'admin.andrew-k.us // Solar Forge Ops',
    description:
      loaderData?.content.description ??
      'Isolated operations console for andrew-k.us passkey auth, CMS, and telemetry.',
  });
}

export default function AdminHomeRoute() {
  const { content, menuItems } = useLoaderData() as AdminHomeLoaderData;

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
