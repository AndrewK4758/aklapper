import type { AskSource } from '@aklapper/core';

import { Collapsible } from '../elements/base/Collapsible';

import styles from './CitationSourceList.module.css';

export interface CitationSourceListProps {
  readonly heading: string;
  readonly sources: readonly AskSource[];
  readonly defaultOpen?: boolean;
  readonly testId?: string;
}

function formatNormalizedPercent(score: number): string {
  const clamped = Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0;
  return `${Math.round(clamped * 100)}%`;
}

export function CitationSourceList({
  heading,
  sources,
  defaultOpen = false,
  testId,
}: CitationSourceListProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <section className={styles.section} aria-label={heading} data-testid={testId}>
      <h4 className={styles.heading}>{heading}</h4>
      <div className={styles.list}>
        {sources.map((source, index) => {
          const pct = formatNormalizedPercent(source.score);
          const itemKey = source.id ?? `${source.docKey ?? source.title}-${index}`;
          return (
            <Collapsible.Root key={itemKey} defaultOpen={defaultOpen} className={styles.card}>
              <Collapsible.Trigger className={styles.trigger}>
                <span className={styles.triggerTitle}>{source.title}</span>
                <span className={styles.scoreBadge}>{pct}</span>
              </Collapsible.Trigger>
              <Collapsible.Panel className={styles.panel}>
                <div className={styles.metaRow}>
                  {source.sectionHeading ? (
                    <span className={styles.metaTag}>{source.sectionHeading}</span>
                  ) : null}
                  {source.category ? (
                    <span className={styles.metaTag}>{source.category}</span>
                  ) : null}
                  <span className={styles.metaTag}>Relevance {pct}</span>
                </div>
                <p className={styles.snippet}>{source.snippet}</p>
              </Collapsible.Panel>
            </Collapsible.Root>
          );
        })}
      </div>
    </section>
  );
}
