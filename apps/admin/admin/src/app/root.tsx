import './theme.css';
import { OscStatusBadge, SolarForgeEmblem } from '@aklapper/ui';
import type { ReactNode } from 'react';
import { Link, Links, Meta, Outlet, Scripts, ScrollRestoration } from 'react-router';

import styles from './root.module.css';

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' data-theme='solar-forge'>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <title>admin.andrew-k.us // Solar Forge Ops</title>
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function AdminRoot() {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link to='/' className={styles.brand}>
          <SolarForgeEmblem size={20} />
          <span>admin.andrew-k.us :: cadence-admin</span>
        </Link>
        <OscStatusBadge source='cadence-admin' state='gate' label='Passkey Auth Required' />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
