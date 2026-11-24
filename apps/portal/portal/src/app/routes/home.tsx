import { SfButton } from '@aklapper/ui';
import { Link } from 'react-router';

import styles from './home.module.css';

export default function PortalGreeterRoute() {
  return (
    <section className={styles.card} aria-labelledby='greeter-heading'>
      <h1 id='greeter-heading'>Solar Forge Agentic Terminal — tty1</h1>
      <p>
        Enter as Guest to launch the clean menu, wake real GKE Autopilot scale-from-zero Go
        microservices on demand, and build live sandboxed artifacts with CADENCE.
      </p>
      <div className={styles.actions}>
        <Link to='/menu'>
          <SfButton variant='primary'>Enter as Guest → /menu</SfButton>
        </Link>
      </div>
    </section>
  );
}
