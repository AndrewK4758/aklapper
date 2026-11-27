import type {
  AdminAnalyticsBreakdownsData,
  AdminAnalyticsFilter,
  AnalyticsBreakdownRow,
} from '@aklapper/core';
import { Link } from 'react-router';

import { AdminAnalyticsAskFeed } from './AdminAnalyticsAskFeed';
import { AdminAnalyticsRecentVisitors } from './AdminAnalyticsRecentVisitors';
import { buildAdminAnalyticsHref, DEFAULT_ADMIN_ANALYTICS_FILTER } from './analytics-filter-url';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsBreakdownsProps {
  readonly data: AdminAnalyticsBreakdownsData;
  readonly filter?: AdminAnalyticsFilter;
}

function SimpleCountList({
  title,
  rows,
  emptyLabel,
}: {
  readonly title: string;
  readonly rows: readonly AnalyticsBreakdownRow[];
  readonly emptyLabel: string;
}) {
  return (
    <section className={styles.tableCard}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {rows.length === 0 ? (
        <p className={styles.emptyNote}>{emptyLabel}</p>
      ) : (
        <table className={styles.dataTable}>
          <thead>
            <tr>
              <th>Label</th>
              <th className={styles.numericCell}>Sessions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.label}:${row.secondaryLabel ?? ''}`}>
                <td>{row.label}</td>
                <td className={styles.numericCell}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AdminAnalyticsBreakdowns({ data, filter }: AdminAnalyticsBreakdownsProps) {
  const activeFilter = filter ?? DEFAULT_ADMIN_ANALYTICS_FILTER;
  const {
    topPaths,
    topReferrers,
    geoBreakdown,
    agensiConversions,
    orgBreakdown = [],
    campaignBreakdown = [],
    deviceBreakdown = [],
    osBreakdown = [],
    browserBreakdown = [],
    conversionFunnel = [],
    recentVisitors = [],
    askTurnsFeed = [],
  } = data;

  return (
    <>
      <div className={styles.tableGrid}>
        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Top Paths</h2>
          {topPaths.length === 0 ? (
            <p className={styles.emptyNote}>No page views recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Path</th>
                  <th className={styles.numericCell}>Views</th>
                  <th className={styles.numericCell}>Unique</th>
                </tr>
              </thead>
              <tbody>
                {topPaths.map(row => {
                  const targetPath = row.filterValue ?? row.label;
                  const isActive = activeFilter.path === targetPath;
                  return (
                    <tr key={row.label}>
                      <td>
                        <Link
                          to={buildAdminAnalyticsHref(activeFilter, {
                            path: isActive ? undefined : targetPath,
                          })}
                          prefetch='intent'
                          className={styles.filterCellLink}
                          data-active={isActive ? 'true' : 'false'}
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className={styles.numericCell}>{row.count}</td>
                      <td className={styles.numericCell}>{row.uniqueVisitors ?? row.count}</td>
                    </tr>
                  );
                })}
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
                  <th>Category</th>
                  <th className={styles.numericCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map(row => {
                  const targetSource = row.filterValue ?? row.label;
                  const isActive = activeFilter.source === targetSource;
                  return (
                    <tr key={`${row.label}:${row.secondaryLabel ?? ''}`}>
                      <td>
                        <Link
                          to={buildAdminAnalyticsHref(activeFilter, {
                            source: isActive ? undefined : targetSource,
                          })}
                          prefetch='intent'
                          className={styles.filterCellLink}
                          data-active={isActive ? 'true' : 'false'}
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td>{row.secondaryLabel ?? '—'}</td>
                      <td className={styles.numericCell}>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Campaigns &amp; Links</h2>
          {campaignBreakdown.length === 0 ? (
            <p className={styles.emptyNote}>No ?ref or UTM campaigns recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Campaign / Ref</th>
                  <th>Detail</th>
                  <th className={styles.numericCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {campaignBreakdown.map(row => {
                  const targetCampaign = row.filterValue ?? row.label;
                  const isActive = activeFilter.campaign === targetCampaign;
                  return (
                    <tr key={`${row.label}:${row.secondaryLabel ?? ''}`}>
                      <td>
                        <Link
                          to={buildAdminAnalyticsHref(activeFilter, {
                            campaign: isActive ? undefined : targetCampaign,
                          })}
                          prefetch='intent'
                          className={styles.filterCellLink}
                          data-active={isActive ? 'true' : 'false'}
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td>{row.secondaryLabel ?? '—'}</td>
                      <td className={styles.numericCell}>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className={styles.tableGrid}>
        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Locations (Country / Region / City)</h2>
          {geoBreakdown.length === 0 ? (
            <p className={styles.emptyNote}>No geo breakdown entries recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Region / City</th>
                  <th className={styles.numericCell}>Sessions</th>
                </tr>
              </thead>
              <tbody>
                {geoBreakdown.map(row => {
                  const targetCountry = row.filterValue ?? row.label;
                  const isActive = activeFilter.country === targetCountry;
                  return (
                    <tr key={`${row.label}:${row.secondaryLabel ?? ''}`}>
                      <td>
                        {row.label === 'Unknown' ? (
                          row.label
                        ) : (
                          <Link
                            to={buildAdminAnalyticsHref(activeFilter, {
                              country: isActive ? undefined : targetCountry,
                            })}
                            prefetch='intent'
                            className={styles.filterCellLink}
                            data-active={isActive ? 'true' : 'false'}
                          >
                            {row.label}
                          </Link>
                        )}
                      </td>
                      <td>{row.secondaryLabel ?? '—'}</td>
                      <td className={styles.numericCell}>{row.count}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <SimpleCountList
          title='Top Organizations (ASN Org)'
          rows={orgBreakdown}
          emptyLabel='No ASN organization entries recorded in this window.'
        />

        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>Profile Conversion Funnel</h2>
          {conversionFunnel.length === 0 ? (
            <p className={styles.emptyNote}>No funnel sessions recorded in this window.</p>
          ) : (
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th className={styles.numericCell}>Sessions</th>
                  <th className={styles.numericCell}>Rate</th>
                </tr>
              </thead>
              <tbody>
                {conversionFunnel.map(step => (
                  <tr key={step.step}>
                    <td>{step.label}</td>
                    <td className={styles.numericCell}>{step.sessions}</td>
                    <td className={styles.numericCell}>{Math.round(step.conversionRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className={styles.tableGrid}>
        <SimpleCountList
          title='Devices'
          rows={deviceBreakdown}
          emptyLabel='No device profiles recorded.'
        />
        <SimpleCountList
          title='Operating Systems'
          rows={osBreakdown}
          emptyLabel='No OS profiles recorded.'
        />
        <SimpleCountList
          title='Browsers'
          rows={browserBreakdown}
          emptyLabel='No browser profiles recorded.'
        />
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

      <AdminAnalyticsRecentVisitors visitors={recentVisitors} />
      <AdminAnalyticsAskFeed turns={askTurnsFeed} />
    </>
  );
}
