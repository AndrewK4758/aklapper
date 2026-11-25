import type { CadenceExecutionMode, CadenceRunResult, PortalCadenceContent } from '@aklapper/core';
import { StatusPill, type StatusPillTone } from '@aklapper/ui';

import styles from './PortalCadencePage.module.css';

export interface CadenceHistoryStripProps {
  readonly content: PortalCadenceContent;
  readonly runs: readonly CadenceRunResult[];
  readonly activeRunId: string | null;
  readonly onSelectRun: (runId: string) => void;
}

function modePillInfo(
  mode: CadenceExecutionMode | undefined,
  content: PortalCadenceContent,
): { readonly label: string; readonly tone: StatusPillTone } {
  switch (mode) {
    case 'golden':
      return { label: content.modeBadgeGoldenLabel, tone: 'accent' };
    case 'cached':
      return { label: content.modeBadgeCachedLabel, tone: 'success' };
    case 'live':
      return { label: content.modeBadgeLiveLabel, tone: 'info' };
    case 'fallback':
      return { label: content.modeBadgeFallbackLabel, tone: 'warn' };
    default:
      return { label: content.modeBadgeFastLabel, tone: 'neutral' };
  }
}

export function CadenceHistoryStrip({
  content,
  runs,
  activeRunId,
  onSelectRun,
}: CadenceHistoryStripProps) {
  if (runs.length === 0) return null;

  return (
    <section className={styles.historySection} data-testid='cadence-run-history'>
      <h2 className={styles.sectionTitle}>
        {content.recentRunsHeading} ({runs.length})
      </h2>
      <ul className={styles.historyList}>
        {runs.map(run => {
          const pill = modePillInfo(run.executionMode, content);
          return (
            <li key={run.runId}>
              <button
                type='button'
                className={styles.historyItem}
                data-active={run.runId === activeRunId ? 'true' : 'false'}
                onClick={() => onSelectRun(run.runId)}
              >
                <span className={styles.historyPrompt}>{run.prompt}</span>
                <span className={styles.historyMeta}>
                  <StatusPill tone={pill.tone} size='sm'>
                    {pill.label}
                  </StatusPill>
                  <span>
                    {run.runStatus ?? 'ready'} · {run.gateVerdict} · {run.tokensIn ?? 0}/
                    {run.tokensOut ?? 0}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
