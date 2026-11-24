import type { AgensiSkill, PortalAgensiContent } from '@aklapper/core';
import { getActiveAnalyticsClient } from '@aklapper/core/analytics';
import {
  Button,
  Input,
  OscStatusBadge,
  Separator,
  Toggle,
  ToggleGroup,
  TuiWindow,
} from '@aklapper/ui';
import { useState } from 'react';

import styles from './PortalAgensiPage.module.css';

export interface PortalAgensiPageProps {
  content: PortalAgensiContent;
  skills: readonly AgensiSkill[];
  onClose: () => void;
}

export function PortalAgensiPage({ content, skills, onClose }: PortalAgensiPageProps) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pure render-time derivation (no useEffect).
  const allTags = Array.from(new Set(skills.flatMap(skill => skill.tags))).toSorted();
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSkills = skills.filter(skill => {
    const matchesTags = selectedTags.every(tag => skill.tags.includes(tag));
    if (!matchesTags) return false;
    if (!normalizedQuery) return true;
    const haystack = `${skill.name} ${skill.summary} ${skill.tags.join(' ')}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const handleOutboundClick = (slug: string) => {
    getActiveAnalyticsClient()?.track({
      type: 'interaction',
      name: 'agensi_outbound_click',
      path: '/agensi',
      metadata: { slug },
    });
  };

  return (
    <div className={styles.workspace}>
      <TuiWindow
        title={content.windowTitle}
        onClose={onClose}
        badge={
          <OscStatusBadge
            source={content.statusBadge.source}
            state={content.statusBadge.state}
            label={`${filteredSkills.length}/${skills.length} skills · ${content.statusBadge.label}`}
          />
        }
      >
        <p className={styles.intro}>{content.description}</p>
        <Separator.Root />

        <div className={styles.controls}>
          <Input.Group className={styles.searchGroup}>
            <Input.Prefix aria-hidden='true'>/</Input.Prefix>
            <Input.Root
              type='search'
              value={searchQuery}
              onChange={event => setSearchQuery(event.currentTarget.value)}
              placeholder={content.searchPlaceholder}
              aria-label='Search Agensi skills'
              data-testid='agensi-search-input'
            />
          </Input.Group>

          {allTags.length > 0 && (
            <div className={styles.filterRow}>
              <ToggleGroup.Root
                multiple
                value={selectedTags}
                onValueChange={nextValue => setSelectedTags(nextValue.map(String))}
                aria-label='Filter Agensi skills by tag'
                className={styles.tagGroup}
              >
                {allTags.map(tag => (
                  <Toggle.Root key={tag} value={tag} data-testid={`agensi-tag-${tag}`}>
                    <Toggle.Label>#{tag}</Toggle.Label>
                  </Toggle.Root>
                ))}
              </ToggleGroup.Root>
              {(selectedTags.length > 0 || searchQuery.length > 0) && (
                <Button
                  type='button'
                  variant='ghost'
                  size='xs'
                  onClick={() => {
                    setSelectedTags([]);
                    setSearchQuery('');
                  }}
                >
                  <Button.Label>Reset Filters</Button.Label>
                </Button>
              )}
            </div>
          )}
        </div>

        {filteredSkills.length === 0 ? (
          <output className={styles.emptyState} data-testid='agensi-empty-state'>
            <p>{content.emptyStateLabel}</p>
          </output>
        ) : (
          <ul className={styles.grid} data-testid='agensi-skill-grid'>
            {filteredSkills.map(skill => (
              <li
                key={skill.slug}
                className={styles.card}
                data-testid={`agensi-card-${skill.slug}`}
              >
                <div className={styles.cardHeader}>
                  <h2 className={styles.cardTitle}>{skill.name}</h2>
                  <span className={styles.cardSlug}>{skill.slug}</span>
                </div>
                <p className={styles.cardSummary}>{skill.summary}</p>
                <div className={styles.cardFooter}>
                  <div className={styles.cardTags}>
                    {skill.tags.map(tag => (
                      <span key={tag} className={styles.tagPill}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <Button.Link
                    href={skill.url}
                    target='_blank'
                    rel='noreferrer'
                    variant='primary'
                    size='sm'
                    onClick={() => handleOutboundClick(skill.slug)}
                    data-testid={`agensi-cta-${skill.slug}`}
                  >
                    <Button.Label>{content.outboundCtaLabel}</Button.Label>
                  </Button.Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </TuiWindow>
    </div>
  );
}
