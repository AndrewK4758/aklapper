import type { CadenceRunResult, PortalCadenceContent } from '@aklapper/core';
import { StatusPill } from '@aklapper/ui';

import styles from './PortalCadencePage.module.css';

export interface CadenceGoldenStripProps {
  readonly content: PortalCadenceContent;
  readonly goldenRuns: readonly CadenceRunResult[];
  readonly activeRunId: string | null;
  readonly onSelectGolden: (run: CadenceRunResult) => void;
}

export function CadenceGoldenStrip({
  content,
  goldenRuns,
  activeRunId,
  onSelectGolden,
}: CadenceGoldenStripProps) {
  if (goldenRuns.length === 0) return null;

  return (
    <section
      className={styles.goldenSection}
      aria-label={content.goldenSelectorLabel}
      data-testid='cadence-golden-strip'
    >
      <div className={styles.goldenHeader}>
        <h2 className={styles.sectionTitle}>{content.goldenShowcaseHeading}</h2>
        <StatusPill tone='accent' size='sm'>
          {content.modeBadgeGoldenLabel} · $0
        </StatusPill>
      </div>
      <ul className={styles.goldenList}>
        {goldenRuns.map(run => {
          const isSelected = run.runId === activeRunId;
          const label = run.spec?.title ?? run.presetSlug ?? run.prompt;
          return (
            <li key={run.runId}>
              <button
                type='button'
                className={styles.goldenChip}
                data-active={isSelected ? 'true' : 'false'}
                data-testid={`cadence-golden-${run.presetSlug ?? run.runId}`}
                aria-pressed={isSelected}
                onClick={() => onSelectGolden(run)}
              >
                <span className={styles.goldenChipTitle}>{label}</span>
                <span className={styles.goldenChipMeta}>{content.goldenVerifiedBadgeLabel}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
