import type { MenuItem } from '@aklapper/contracts';
import { filterMenuForRole } from '@aklapper/shared-utils';
import { Link } from 'react-router';

import styles from './menu.module.css';

const PUBLIC_MENU_SEED: MenuItem[] = [
  {
    slug: 'cadence',
    keyShortcut: '1',
    title: 'CADENCE Builder',
    description: 'Prompt-to-artifact sandbox backed by live GKE pods + Qdrant',
    targetK8sDeploy: 'svc-cadence-demo',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 1,
    enabled: true,
  },
];

export default function PortalMenuRoute() {
  const items = filterMenuForRole(PUBLIC_MENU_SEED, 'guest');
  return (
    <section className={styles.card} aria-labelledby='menu-heading'>
      <h1 id='menu-heading'>Launch Menu</h1>
      <p>Select a module. No pods wake until you invoke a live GKE workflow.</p>
      <ul className={styles.menuList}>
        {items.map(item => (
          <li key={item.slug}>
            <Link to={`/${item.slug}`} className={styles.menuLink}>
              <span>
                [{item.keyShortcut}] <strong>{item.title}</strong> — {item.description}
              </span>
              <span>{item.targetK8sDeploy ?? 'local'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
