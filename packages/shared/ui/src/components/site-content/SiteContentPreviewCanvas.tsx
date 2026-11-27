import {
  AdminAnalyticsContentSchema,
  AdminChromeContentSchema,
  AdminHomeContentSchema,
  type CareerDossier,
  PortalAboutContentSchema,
  PortalAgensiContentSchema,
  PortalAskContentSchema,
  PortalCadenceContentSchema,
  PortalChromeContentSchema,
  PortalContactContentSchema,
  PortalHomeContentSchema,
  SITE_CONTENT_KEYS,
} from '@aklapper/core';

import { cx } from '../../elements/_internal/elementFactory';
import { OscStatusBadge } from '../../elements/OscStatusBadge';
import { StatusPill } from '../../elements/StatusPill';
import { RecursiveTuiForm } from '../RecursiveTuiForm';
import { TuiWindow } from '../TuiWindow';
import { ViewportProvider } from '../ViewportProvider';
import { PortalAboutPreview } from './PortalAboutPreview';
import { PortalHomeTerminalIntro } from './PortalHomeTerminalIntro';
import { SiteChromePreviewBar } from './SiteChromePreviewBar';
import { SiteContentWindowHeader } from './SiteContentWindowHeader';
import { TuiHeroCard } from './TuiHeroCard';

import styles from './SiteContentPreview.module.css';

export type SiteContentPreviewViewport = 'desktop' | 'mobile';

export interface SiteContentPreviewCanvasProps {
  readonly contentKey: string;
  readonly metadata: Record<string, unknown>;
  readonly viewport: SiteContentPreviewViewport;
  readonly careerDossiers?: readonly CareerDossier[];
  readonly brandContactEmail?: string;
}

function renderKeyPreview(
  contentKey: string,
  metadata: Record<string, unknown>,
  careerDossiers?: readonly CareerDossier[],
  brandContactEmail?: string,
) {
  switch (contentKey) {
    case SITE_CONTENT_KEYS.portalChrome: {
      const parsed = PortalChromeContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      return <SiteChromePreviewBar {...parsed.data} />;
    }

    case SITE_CONTENT_KEYS.adminChrome: {
      const parsed = AdminChromeContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      return <SiteChromePreviewBar {...parsed.data} />;
    }

    case SITE_CONTENT_KEYS.portalHome: {
      const parsed = PortalHomeContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <div className={styles.homePreviewStack}>
          <div className={styles.terminalGreetingPreview}>
            <div className={styles.terminalPromptEcho}>
              <span className={styles.terminalPromptGlyph} aria-hidden='true'>
                ❯
              </span>
              <code>ls</code>
            </div>
            <PortalHomeTerminalIntro portrait={d.portrait} resumeSummary={d.resumeSummary} />
          </div>
          <TuiWindow
            title={d.tuiTitle}
            badge={
              <OscStatusBadge
                source={d.tuiBadge.source}
                state={d.tuiBadge.state}
                label={d.tuiBadge.label}
              />
            }
          >
            <TuiHeroCard
              heading={d.heading}
              description={d.description}
              actions={d.actions}
              actionsAriaLabel='Portal launch actions preview'
            />
          </TuiWindow>
        </div>
      );
    }

    case SITE_CONTENT_KEYS.adminHome: {
      const parsed = AdminHomeContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <TuiWindow title='Admin Overview // Preview'>
          <TuiHeroCard
            heading={d.heading}
            description={d.description}
            actions={d.actions}
            actionsAriaLabel='Admin overview actions preview'
          />
        </TuiWindow>
      );
    }

    case SITE_CONTENT_KEYS.portalAbout: {
      const parsed = PortalAboutContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      return (
        <PortalAboutPreview
          content={parsed.data}
          careerDossiers={careerDossiers}
          brandContactEmail={brandContactEmail}
        />
      );
    }

    case SITE_CONTENT_KEYS.portalAgensi: {
      const parsed = PortalAgensiContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <SiteContentWindowHeader
          title={d.windowTitle}
          statusBadge={d.statusBadge}
          description={d.description}
        >
          <div className={styles.previewSlotBox}>
            <div>Search placeholder: {d.searchPlaceholder}</div>
            <div>Empty state: {d.emptyStateLabel}</div>
            <div>Outbound CTA: {d.outboundCtaLabel}</div>
          </div>
        </SiteContentWindowHeader>
      );
    }

    case SITE_CONTENT_KEYS.portalAsk: {
      const parsed = PortalAskContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <SiteContentWindowHeader
          title={d.windowTitle}
          statusBadge={d.statusBadge}
          description={d.description}
        >
          <div className={styles.previewSlotBox}>
            <div>
              Tabs: {d.qaTabLabel} | {d.jdTabLabel}
            </div>
            <div>Question placeholder: {d.questionPlaceholder}</div>
            <div>Empty thread hint: {d.emptyThreadHint}</div>
          </div>
          <ul className={styles.previewChipList} aria-label='Visitor lenses preview'>
            {d.visitorLenses.map(lens => (
              <li key={lens.id} className={styles.previewChip}>
                {lens.label}: {lens.description}
              </li>
            ))}
          </ul>
          <ul className={styles.previewChipList} aria-label='Starter questions preview'>
            {d.starterQuestions.map((question, idx) => (
              <li key={`${idx}-${question}`} className={styles.previewChip}>
                {question}
              </li>
            ))}
          </ul>
          <div className={styles.previewSlotBox}>
            <div>JD placeholder: {d.jdPlaceholder}</div>
            <div>Abstention notice: {d.abstentionNotice}</div>
            <div>Boundary notice: {d.boundaryFallbackNotice}</div>
            <div>
              Contact CTA: {d.contactCtaLabel} ({d.contactCtaHref})
            </div>
          </div>
        </SiteContentWindowHeader>
      );
    }

    case SITE_CONTENT_KEYS.portalCadence: {
      const parsed = PortalCadenceContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <SiteContentWindowHeader
          title={d.windowTitle}
          statusBadge={d.statusBadge}
          description={d.description}
        >
          <div className={styles.previewSlotBox}>
            <div>
              {d.goldenShowcaseHeading} · {d.goldenVerifiedBadgeLabel}
            </div>
            <div>{d.goldenReadOnlyNotice}</div>
          </div>
          <ul className={styles.previewChipList} aria-label='Execution mode badges preview'>
            <li>
              <StatusPill tone='accent' size='sm'>
                {d.modeBadgeGoldenLabel}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone='success' size='sm'>
                {d.modeBadgeCachedLabel}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone='info' size='sm'>
                {d.modeBadgeLiveLabel}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone='neutral' size='sm'>
                {d.modeBadgeFastLabel}
              </StatusPill>
            </li>
            <li>
              <StatusPill tone='warn' size='sm'>
                {d.modeBadgeFallbackLabel}
              </StatusPill>
            </li>
          </ul>
          <ul className={styles.previewChipList} aria-label='Inspector tabs preview'>
            <li className={styles.previewChip}>{d.tabPreviewLabel}</li>
            <li className={styles.previewChip}>{d.tabSpecLabel}</li>
            <li className={styles.previewChip}>{d.tabSourceLabel}</li>
            <li className={styles.previewChip}>{d.tabGateAuditLabel}</li>
            <li className={styles.previewChip}>{d.streamLogHeading}</li>
          </ul>
          <div className={styles.previewSlotBox}>
            Sandboxed artifact frame slot: {d.iframeTitle} (non-executing preview)
          </div>
        </SiteContentWindowHeader>
      );
    }

    case SITE_CONTENT_KEYS.portalContact: {
      const parsed = PortalContactContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return (
        <SiteContentWindowHeader
          title={d.windowTitle}
          statusBadge={d.statusBadge}
          description={d.description}
        >
          <RecursiveTuiForm
            definition={d.form}
            renderForm={({ className, children }) => <div className={className}>{children}</div>}
          />
        </SiteContentWindowHeader>
      );
    }

    case SITE_CONTENT_KEYS.adminAnalytics: {
      const parsed = AdminAnalyticsContentSchema.safeParse(metadata);
      if (!parsed.success) return null;
      const d = parsed.data;
      return <SiteContentWindowHeader title={d.windowTitle} description={d.description} />;
    }

    default:
      return (
        <p className={styles.previewNotice}>
          No UI preview is registered for custom site_content key <code>{contentKey}</code>.
        </p>
      );
  }
}

export function SiteContentPreviewCanvas({
  contentKey,
  metadata,
  viewport,
  careerDossiers,
  brandContactEmail,
}: SiteContentPreviewCanvasProps) {
  const rendered = renderKeyPreview(contentKey, metadata, careerDossiers, brandContactEmail);
  const scopedViewportMode = viewport === 'mobile' ? 'mobile-portrait' : 'desktop';

  return (
    <ViewportProvider mode={scopedViewportMode}>
      <div
        className={cx(
          styles.previewViewport,
          viewport === 'mobile' && styles.previewViewportMobile,
        )}
        data-preview-viewport={viewport}
        data-viewport={scopedViewportMode}
        data-preview-key={contentKey}
      >
        {rendered ?? (
          <output className={styles.previewNotice}>
            Preview waiting for valid metadata matching <code>{contentKey}</code>.
          </output>
        )}
      </div>
    </ViewportProvider>
  );
}
