import { TuiWindow } from '@aklapper/ui';

import styles from './analytics.module.css';

export default function AdminAnalyticsRoute() {
  return (
    <div className={styles.panel}>
      <TuiWindow title='First-Party Visitor Analytics // Postgres 19'>
        <p>
          Wired for node-api-analytics ingest queries, Core Web Vitals percentiles, and Agensi
          outbound conversion counts.
        </p>
      </TuiWindow>
    </div>
  );
}
