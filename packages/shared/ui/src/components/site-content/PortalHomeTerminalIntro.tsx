import type { PortalHomePortrait, PortalHomeResumeSummary } from '@aklapper/core';

import { cx } from '../../elements/_internal/elementFactory';
import { TerminalPortrait } from '../TerminalPortrait';

import styles from './PortalHomeTerminalIntro.module.css';

export interface PortalHomeTerminalIntroProps {
  readonly portrait: PortalHomePortrait;
  readonly resumeSummary: PortalHomeResumeSummary;
  readonly priorityPortrait?: boolean;
  readonly className?: string;
}

export function PortalHomeTerminalIntro({
  portrait,
  resumeSummary,
  priorityPortrait = false,
  className,
}: PortalHomeTerminalIntroProps) {
  return (
    <section
      className={cx(styles.intro, className)}
      aria-label={`${resumeSummary.name} profile summary`}
      aria-live='off'
      data-portal-home-intro='true'
    >
      <div className={styles.grid}>
        <div className={styles.portraitCol}>
          <TerminalPortrait
            src={portrait.src}
            alt={portrait.alt}
            width={portrait.width}
            height={portrait.height}
            caption={portrait.caption}
            variant='terminal'
            size='md'
            priority={priorityPortrait}
          />
        </div>

        <div className={styles.contentCol}>
          <div className={styles.header}>
            <p className={styles.name}>{resumeSummary.name}</p>
            <p className={styles.roleLine}>{resumeSummary.roleLine}</p>
            <div className={styles.linksRow}>
              <a className={styles.link} href={`mailto:${resumeSummary.publicEmail}`}>
                {resumeSummary.publicEmail}
              </a>
              <span className={styles.linkSep} aria-hidden='true'>
                ·
              </span>
              <a
                className={styles.link}
                href={resumeSummary.githubUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                {resumeSummary.githubLabel}
              </a>
            </div>
          </div>

          <p className={styles.bio}>{resumeSummary.bio}</p>

          <div className={styles.block}>
            <p className={styles.blockHeading}>{resumeSummary.highlightsHeading}</p>
            <ul className={styles.highlightsList}>
              {resumeSummary.highlights.map((highlight, idx) => (
                <li key={`${idx}-${highlight.slice(0, 24)}`} className={styles.highlightItem}>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className={styles.block}>
            <p className={styles.blockHeading}>{resumeSummary.servicesHeading}</p>
            <ul className={styles.servicesList}>
              {resumeSummary.services.map((service, idx) => (
                <li key={`${idx}-${service.command}`} className={styles.serviceItem}>
                  <code className={styles.serviceCommand}>{service.command}</code>
                  <span className={styles.serviceSep} aria-hidden='true'>
                    —
                  </span>
                  <span className={styles.serviceSummary}>{service.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
