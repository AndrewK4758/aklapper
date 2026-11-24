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
        <title>andrew-k.us // Solar Forge Terminal</title>
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

export default function PortalRoot() {
  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link to='/' className={styles.brand}>
          <SolarForgeEmblem size={20} />
          <span>andrew-k.us :: tty1</span>
        </Link>
        <OscStatusBadge source='gke-autopilot' state='idle' label='0 pods (scale-to-0)' />
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>Solar Forge // Fastify 5 + React Router 8 SSR</span>
        <a href='https://agensi.io/creators/aklapper' target='_blank' rel='noreferrer'>
          agensi.io/creators/aklapper
        </a>
      </footer>
    </div>
  );
}
