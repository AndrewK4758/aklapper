import { SfButton } from '@aklapper/ui';
import { Link } from 'react-router';

import styles from './home.module.css';

export default function AdminHomeRoute() {
  return (
    <section className={styles.card} aria-labelledby='admin-heading'>
      <h1 id='admin-heading'>Admin Operations Console</h1>
      <p>
        Isolated bundle for <code>aklapper</code>: WebAuthn Passkey + future TOTP 2FA gate,
        first-party analytics, Postgres 19 menu/quota CMS, and private <code>cadence-admin</code>{' '}
        namespace controls.
      </p>
      <div className={styles.actions}>
        <Link to='/analytics'>
          <SfButton variant='primary'>Open Telemetry View</SfButton>
        </Link>
      </div>
    </section>
  );
}
