import type { CareerDossier, PortalAboutContent } from '@aklapper/core';

import { StatusPill } from '../../elements/StatusPill';
import { TerminalPortrait } from '../TerminalPortrait';
import { SiteContentWindowHeader } from './SiteContentWindowHeader';

import styles from './SiteContentPreview.module.css';

export interface PortalAboutPreviewProps {
  readonly content: PortalAboutContent;
  readonly careerDossiers?: readonly CareerDossier[];
  readonly brandContactEmail?: string;
}

export function PortalAboutPreview({
  content,
  careerDossiers = [],
  brandContactEmail,
}: PortalAboutPreviewProps) {
  // Mirror public /about visibility strictly: only published, sanitization-verified dossiers render.
  const publishedDossiers = careerDossiers.filter(
    dossier => dossier.publishStatus === 'published' && dossier.sanitizationVerifiedAt !== null,
  );
  const profileCore = publishedDossiers.find(dossier => dossier.kind === 'profile_core');
  const experienceDossiers = publishedDossiers.filter(dossier => dossier.kind === 'experience');
  const projectDossiers = publishedDossiers.filter(
    dossier => dossier.kind === 'project' || dossier.kind === 'architecture',
  );
  const leadershipDossiers = publishedDossiers.filter(dossier => dossier.kind === 'leadership');

  return (
    <SiteContentWindowHeader
      title={content.windowTitle}
      statusBadge={content.statusBadge}
      description={content.description}
    >
      <div className={styles.aboutHero}>
        <TerminalPortrait
          alt={content.portrait.alt}
          caption={content.portrait.caption}
          ttyLabel={content.portrait.ttyLabel}
          size='sm'
          variant='profile'
        />
        <div className={styles.aboutIdentity}>
          <h3 className={styles.aboutName}>{content.identity.fullName}</h3>
          <p className={styles.aboutHeadline}>{content.identity.roleHeadline}</p>
          <p className={styles.aboutMeta}>
            <span>{content.identity.location}</span>
            {brandContactEmail ? (
              <>
                {' · '}
                <span>{brandContactEmail}</span>
              </>
            ) : null}
          </p>
          <p className={styles.aboutMeta}>
            {content.identity.githubLabel} · {content.identity.websiteLabel}
          </p>
          {profileCore ? <p className={styles.aboutSummary}>{profileCore.summaryBody}</p> : null}
        </div>
      </div>

      <section className={styles.aboutSection}>
        <h4 className={styles.aboutSectionTitle}>{content.skillsHeading}</h4>
        <div className={styles.aboutSkillList}>
          {content.skillGroups.map(group => (
            <div key={group.category} className={styles.aboutSkillRow}>
              <strong className={styles.aboutSkillCategory}>{group.category}:</strong>{' '}
              <span>{group.skills.join(', ')}</span>
            </div>
          ))}
        </div>
      </section>

      {publishedDossiers.length === 0 ? (
        <output className={styles.previewNotice} data-testid='about-preview-dossiers-empty'>
          {content.emptyDossiersNotice}
        </output>
      ) : (
        <>
          {experienceDossiers.length > 0 ? (
            <section className={styles.aboutSection}>
              <h4 className={styles.aboutSectionTitle}>{content.experienceHeading}</h4>
              <ul className={styles.aboutDossierList}>
                {experienceDossiers.map(dossier => (
                  <li key={dossier.slug} className={styles.aboutDossierItem}>
                    <strong>{dossier.title}</strong> ·{' '}
                    <span className={styles.chromeMeta}>{dossier.timeframe}</span>
                    <p className={styles.aboutSummary}>{dossier.summaryBody}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {projectDossiers.length > 0 ? (
            <section className={styles.aboutSection}>
              <h4 className={styles.aboutSectionTitle}>{content.projectsHeading}</h4>
              <ul className={styles.aboutDossierList}>
                {projectDossiers.map(dossier => (
                  <li key={dossier.slug} className={styles.aboutDossierItem}>
                    <strong>{dossier.title}</strong>
                    <p className={styles.aboutSummary}>{dossier.summaryBody}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {leadershipDossiers.length > 0 ? (
            <section className={styles.aboutSection}>
              <h4 className={styles.aboutSectionTitle}>{content.communityHeading}</h4>
              <ul className={styles.aboutDossierList}>
                {leadershipDossiers.map(dossier => (
                  <li key={dossier.slug} className={styles.aboutDossierItem}>
                    <strong>{dossier.title}</strong> ·{' '}
                    <span className={styles.chromeMeta}>{dossier.timeframe}</span>
                    <p className={styles.aboutSummary}>{dossier.summaryBody}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className={styles.aboutSection}>
        <h4 className={styles.aboutSectionTitle}>Education</h4>
        <ul className={styles.aboutDossierList}>
          {content.education.map(edu => (
            <li key={`${edu.institution}-${edu.program}`} className={styles.aboutDossierItem}>
              <strong>{edu.institution}</strong> ·{' '}
              <span className={styles.chromeMeta}>{edu.location}</span>
              <div className={styles.aboutSummary}>{edu.program}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.aboutSection}>
        <h4 className={styles.aboutSectionTitle}>{content.servicesHeading}</h4>
        <p className={styles.windowDescription}>{content.servicesIntro}</p>
        <ul className={styles.aboutServiceGrid} aria-label='Platform services preview'>
          {content.services.map(service => (
            <li key={service.id} className={styles.aboutServiceCard}>
              <div className={styles.aboutServiceHeader}>
                <strong>{service.title}</strong>
                <StatusPill tone='accent' size='sm'>
                  {service.badge}
                </StatusPill>
              </div>
              <p className={styles.aboutSummary}>{service.summary}</p>
              <span className={styles.chromeMeta}>
                {service.ctaLabel} ({service.to})
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.previewSlotBox}>
          Contact CTA: {content.contactCtaLabel} ({content.contactCtaHref})
        </div>
      </section>
    </SiteContentWindowHeader>
  );
}
