import type { AdminAnalyticsBreakdownsData } from '@aklapper/core';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsBreakdownsProps {
  readonly data: AdminAnalyticsBreakdownsData;
}

export function AdminAnalyticsBreakdowns({ data }: AdminAnalyticsBreakdownsProps) {
  const { topPaths, topReferrers, geoBreakdown, agensiConversions } = data;

  return (
    <>
      <div className={styles.tableGrid}>
        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Top Paths</h2>
          {topPaths.length === 0 ? (
            <p className={styles.emptyNote}>No path events recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Path</th>
                  <th className={styles.numericCell}>Hits</th>
                </tr>
              </thead>
              <tbody>
                {topPaths.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={styles.numericCell}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Top Referrers</h2>
          {topReferrers.length === 0 ? (
            <p className={styles.emptyNote}>No referrer entries recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th className={styles.numericCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className={styles.numericCell}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Country / Region Breakdown</h2>
          {geoBreakdown.length === 0 ? (
            <p className={styles.emptyNote}>No geo breakdown entries recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Region</th>
                  <th className={styles.numericCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {geoBreakdown.map(row => (
                  <tr key={`${row.label}:${row.secondaryLabel ?? ''}`}>
                    <td>{row.label}</td>
                    <td>{row.secondaryLabel ?? '—'}</td>
                    <td className={styles.numericCell}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className={styles.tableGrid}>
        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Agensi Outbound Conversion Funnel</h2>
          {agensiConversions.length === 0 ? (
            <p className={styles.emptyNote}>
              No agensi_outbound_click conversions recorded in this window.
            </p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Skill Slug</th>
                  <th className={styles.numericCell}>Outbound Clicks</th>
                </tr>
              </thead>
              <tbody>
                {agensiConversions.map(row => (
                  <tr key={row.slug}>
                    <td>{row.slug}</td>
                    <td className={styles.numericCell}>{row.clicks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
