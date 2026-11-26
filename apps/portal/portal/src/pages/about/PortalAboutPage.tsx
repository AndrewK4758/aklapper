import type { CareerDossier, PortalAboutContent } from '@aklapper/core';
import { Button, OscStatusBadge, PaneLink, Separator, StatusPill, TuiWindow } from '@aklapper/ui';
import { TerminalPortrait } from '@aklapper/ui/terminal-portrait';
import { Link, useInRouterContext } from 'react-router';

import styles from './PortalAboutPage.module.css';

export interface PortalAboutPageProps {
  readonly content: PortalAboutContent;
  readonly dossiers: readonly CareerDossier[];
  readonly brandContactEmail?: string;
  readonly onClose: () => void;
}

function DossierCard({ dossier }: { readonly dossier: CareerDossier }) {
  return (
    <li className={styles.dossierCard} data-testid={`about-dossier-${dossier.slug}`}>
      <div className={styles.dossierHeader}>
        <h3 className={styles.dossierTitle}>{dossier.title}</h3>
        <span className={styles.dossierTimeframe}>{dossier.timeframe}</span>
      </div>
      <p className={styles.summaryCopy}>{dossier.summaryBody}</p>
      {dossier.sections.length > 0 ? (
        <div className={styles.subProjectList}>
          {dossier.sections.map(section => (
            <div key={section.heading} className={styles.subProject}>
              <h4 className={styles.subProjectTitle}>{section.heading}</h4>
              <p className={styles.summaryCopy}>{section.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      {dossier.skills.length > 0 ? (
        <ul className={styles.pillList} aria-label={`${dossier.title} technologies`}>
          {dossier.skills.map(skill => (
            <li key={skill} className={styles.pill}>
              {skill}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PortalAboutPage({
  content,
  dossiers,
  brandContactEmail,
  onClose,
}: PortalAboutPageProps) {
  const inRouter = useInRouterContext();

  // Pure render-time grouping of live published career dossiers (zero useEffect).
  const profileCore = dossiers.find(dossier => dossier.kind === 'profile_core');
  const experienceDossiers = dossiers.filter(dossier => dossier.kind === 'experience');
  const projectDossiers = dossiers.filter(
    dossier => dossier.kind === 'project' || dossier.kind === 'architecture',
  );
  const leadershipDossiers = dossiers.filter(dossier => dossier.kind === 'leadership');

  const renderNavLink = (to: string) =>
    inRouter ? (
      <PaneLink to={to} render={<Link to={to} prefetch='intent' />} />
    ) : (
      <PaneLink to={to} />
    );

  return (
    <div className={styles.workspace} data-testid='about-workspace'>
      <TuiWindow
        title={content.windowTitle}
        onClose={onClose}
        badge={
          <OscStatusBadge
            source={content.statusBadge.source}
            state={content.statusBadge.state}
            label={content.statusBadge.label}
          />
        }
      >
        <div className={styles.stack}>
          <section className={styles.hero} aria-label='Engineer profile'>
            <div className={styles.portraitCol}>
              <TerminalPortrait
                alt={content.portrait.alt}
                caption={content.portrait.caption}
                ttyLabel={content.portrait.ttyLabel}
                size='md'
                variant='profile'
                priority
              />
            </div>

            <div className={styles.identityCol}>
              <h1 className={styles.fullName}>{content.identity.fullName}</h1>
              <p className={styles.roleHeadline}>{content.identity.roleHeadline}</p>
              <ul className={styles.metaRow} aria-label='Public profile links'>
                <li>{content.identity.location}</li>
                {brandContactEmail ? (
                  <li>
                    <a href={`mailto:${brandContactEmail}`} className={styles.metaLink}>
                      {brandContactEmail}
                    </a>
                  </li>
                ) : null}
                <li>
                  <a
                    href={content.identity.githubUrl}
                    target='_blank'
                    rel='noreferrer'
                    className={styles.metaLink}
                  >
                    {content.identity.githubLabel}
                  </a>
                </li>
                <li>
                  <a
                    href={content.identity.websiteUrl}
                    target='_blank'
                    rel='noreferrer'
                    className={styles.metaLink}
                  >
                    {content.identity.websiteLabel}
                  </a>
                </li>
              </ul>
              <p className={styles.summaryCopy}>
                {profileCore ? profileCore.summaryBody : content.description}
              </p>
            </div>
          </section>

          <Separator.Root />

          <section className={styles.section} aria-labelledby='about-skills-heading'>
            <h2 id='about-skills-heading' className={styles.sectionHeading}>
              {content.skillsHeading}
            </h2>
            <ul className={styles.skillsGrid}>
              {content.skillGroups.map(group => (
                <li key={group.category} className={styles.skillCard}>
                  <h3 className={styles.skillCategory}>{group.category}</h3>
                  <ul className={styles.pillList}>
                    {group.skills.map(skill => (
                      <li key={skill} className={styles.pill}>
                        {skill}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {dossiers.length === 0 ? (
            <output className={styles.emptyNotice} data-testid='about-dossiers-empty'>
              {content.emptyDossiersNotice}
            </output>
          ) : (
            <>
              {experienceDossiers.length > 0 ? (
                <section className={styles.section} aria-labelledby='about-experience-heading'>
                  <h2 id='about-experience-heading' className={styles.sectionHeading}>
                    {content.experienceHeading}
                  </h2>
                  <ul className={styles.dossierList}>
                    {experienceDossiers.map(dossier => (
                      <DossierCard key={dossier.slug} dossier={dossier} />
                    ))}
                  </ul>
                </section>
              ) : null}

              {projectDossiers.length > 0 ? (
                <section className={styles.section} aria-labelledby='about-projects-heading'>
                  <h2 id='about-projects-heading' className={styles.sectionHeading}>
                    {content.projectsHeading}
                  </h2>
                  <ul className={styles.dossierList}>
                    {projectDossiers.map(dossier => (
                      <DossierCard key={dossier.slug} dossier={dossier} />
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}

          <section className={styles.section} aria-labelledby='about-community-heading'>
            <h2 id='about-community-heading' className={styles.sectionHeading}>
              {content.communityHeading}
            </h2>
            <ul className={styles.dossierList}>
              {leadershipDossiers.map(dossier => (
                <DossierCard key={dossier.slug} dossier={dossier} />
              ))}
              {content.education.map(edu => (
                <li key={`${edu.institution}-${edu.program}`} className={styles.dossierCard}>
                  <div className={styles.dossierHeader}>
                    <h3 className={styles.dossierTitle}>{edu.institution}</h3>
                    <span className={styles.dossierTimeframe}>{edu.location}</span>
                  </div>
                  <p className={styles.summaryCopy}>{edu.program}</p>
                </li>
              ))}
            </ul>
          </section>

          <Separator.Root />

          <section className={styles.section} aria-labelledby='about-services-heading'>
            <h2 id='about-services-heading' className={styles.sectionHeading}>
              {content.servicesHeading}
            </h2>
            <p className={styles.summaryCopy}>{content.servicesIntro}</p>
            <ul className={styles.servicesGrid} data-testid='about-services-grid'>
              {content.services.map(service => (
                <li key={service.id} className={styles.serviceCard}>
                  <div className={styles.serviceHeader}>
                    <h3 className={styles.serviceTitle}>{service.title}</h3>
                    <StatusPill tone='accent' size='sm'>
                      {service.badge}
                    </StatusPill>
                  </div>
                  <p className={styles.summaryCopy}>{service.summary}</p>
                  <div className={styles.serviceFooter}>
                    <span className={styles.serviceRoute}>{service.to}</span>
                    <Button.Link
                      render={renderNavLink(service.to)}
                      variant='primary'
                      size='sm'
                      data-testid={`about-service-link-${service.id}`}
                    >
                      <Button.Label>{service.ctaLabel}</Button.Label>
                    </Button.Link>
                  </div>
                </li>
              ))}
            </ul>

            <div className={styles.contactBanner}>
              <p className={styles.summaryCopy}>
                Interested in collaborating, discussing architecture, or reaching out directly?
              </p>
              <Button.Link
                render={renderNavLink(content.contactCtaHref)}
                variant='primary'
                size='sm'
                data-testid='about-contact-cta'
              >
                <Button.Label>{content.contactCtaLabel}</Button.Label>
              </Button.Link>
            </div>
          </section>
        </div>
      </TuiWindow>
    </div>
  );
}
