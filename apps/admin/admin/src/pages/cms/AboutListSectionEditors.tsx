import { PORTAL_NAVIGABLE_ROUTE_PATHS } from '@aklapper/core';
import { Button } from '@aklapper/ui';

import type { AboutSubEditorProps } from './AboutSectionEditors';

import styles from './SiteContentEditor.module.css';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const target = index + delta;
  if (target < 0 || target >= list.length) return null;
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item === undefined) return null;
  next.splice(target, 0, item);
  return next;
}

export function AboutSkillGroupsEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: AboutSubEditorProps) {
  const groups: Record<string, unknown>[] = Array.isArray(value) ? value.filter(isRecord) : [];
  const rootError = issuesByPath[fieldKey]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <legend className={styles.subCardTitle}>{label}</legend>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(
              [fieldKey],
              [...groups, { category: `Category ${groups.length + 1}`, skills: ['New Skill'] }],
            );
          }}
        >
          <Button.Label>+ Add Skill Group</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}

      {groups.map((group, index) => {
        const category = typeof group['category'] === 'string' ? group['category'] : '';
        const skills: string[] = Array.isArray(group['skills'])
          ? group['skills'].filter((item): item is string => typeof item === 'string')
          : [];
        const catErr = issuesByPath[`${fieldKey}.${index}.category`]?.[0];
        const skillsErr = issuesByPath[`${fieldKey}.${index}.skills`]?.[0];

        return (
          <div key={index} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Skill Group #{index + 1}</span>
              <div className={styles.toolbarGroup}>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === 0}
                  onClick={() => {
                    const moved = moveItem(groups, index, -1);
                    if (moved) onChange([fieldKey], moved);
                  }}
                >
                  <Button.Label>Up</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === groups.length - 1}
                  onClick={() => {
                    const moved = moveItem(groups, index, 1);
                    if (moved) onChange([fieldKey], moved);
                  }}
                >
                  <Button.Label>Down</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={groups.length <= 1}
                  onClick={() => {
                    onChange(
                      [fieldKey],
                      groups.filter((_, idx) => idx !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-category`}>
                Skill Group {index + 1} Category
              </label>
              <input
                id={`${fieldKey}-${index}-category`}
                className={styles.input}
                value={category}
                aria-invalid={Boolean(catErr)}
                onChange={event => {
                  onChange([fieldKey, index, 'category'], event.target.value);
                }}
              />
              {catErr ? <p className={styles.fieldError}>{catErr}</p> : null}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.subCardHeader}>
                <span className={styles.fieldLabel}>Skills ({skills.length})</span>
                <Button.Root
                  type='button'
                  variant='secondary'
                  size='xs'
                  onClick={() => {
                    onChange([fieldKey, index, 'skills'], [...skills, 'New Skill']);
                  }}
                >
                  <Button.Label>+ Add Skill</Button.Label>
                </Button.Root>
              </div>
              {skillsErr ? <p className={styles.fieldError}>{skillsErr}</p> : null}
              {skills.map((skill, sIdx) => (
                <div key={sIdx} className={styles.inlineGrid2}>
                  <input
                    aria-label={`Skill Group ${index + 1} Skill ${sIdx + 1}`}
                    className={styles.input}
                    value={skill}
                    onChange={event => {
                      onChange([fieldKey, index, 'skills', sIdx], event.target.value);
                    }}
                  />
                  <Button.Root
                    type='button'
                    variant='ghost'
                    size='xs'
                    disabled={skills.length <= 1}
                    onClick={() => {
                      onChange(
                        [fieldKey, index, 'skills'],
                        skills.filter((_, idx) => idx !== sIdx),
                      );
                    }}
                  >
                    <Button.Label>Remove</Button.Label>
                  </Button.Root>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function AboutServicesEditor({
  fieldKey,
  label,
  value,
  issuesByPath,
  onChange,
}: AboutSubEditorProps) {
  const services: Record<string, unknown>[] = Array.isArray(value) ? value.filter(isRecord) : [];
  const rootError = issuesByPath[fieldKey]?.[0];

  return (
    <fieldset className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <legend className={styles.subCardTitle}>{label}</legend>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          onClick={() => {
            onChange(
              [fieldKey],
              [
                ...services,
                {
                  id: `service-${services.length + 1}`,
                  title: 'New Platform Service',
                  to: '/chat',
                  badge: 'Interactive',
                  summary: 'Describe what visitors can accomplish in this workspace service.',
                  ctaLabel: 'Open Service →',
                },
              ],
            );
          }}
        >
          <Button.Label>+ Add Service Card</Button.Label>
        </Button.Root>
      </div>
      {rootError ? <p className={styles.fieldError}>{rootError}</p> : null}

      {services.map((service, index) => {
        const id = typeof service['id'] === 'string' ? service['id'] : '';
        const title = typeof service['title'] === 'string' ? service['title'] : '';
        const to = typeof service['to'] === 'string' ? service['to'] : '/chat';
        const badge = typeof service['badge'] === 'string' ? service['badge'] : '';
        const summary = typeof service['summary'] === 'string' ? service['summary'] : '';
        const ctaLabel = typeof service['ctaLabel'] === 'string' ? service['ctaLabel'] : '';

        const idErr = issuesByPath[`${fieldKey}.${index}.id`]?.[0];
        const titleErr = issuesByPath[`${fieldKey}.${index}.title`]?.[0];
        const toErr = issuesByPath[`${fieldKey}.${index}.to`]?.[0];
        const badgeErr = issuesByPath[`${fieldKey}.${index}.badge`]?.[0];
        const summaryErr = issuesByPath[`${fieldKey}.${index}.summary`]?.[0];
        const ctaErr = issuesByPath[`${fieldKey}.${index}.ctaLabel`]?.[0];

        return (
          <div key={index} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Service Card #{index + 1}</span>
              <div className={styles.toolbarGroup}>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === 0}
                  onClick={() => {
                    const moved = moveItem(services, index, -1);
                    if (moved) onChange([fieldKey], moved);
                  }}
                >
                  <Button.Label>Up</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={index === services.length - 1}
                  onClick={() => {
                    const moved = moveItem(services, index, 1);
                    if (moved) onChange([fieldKey], moved);
                  }}
                >
                  <Button.Label>Down</Button.Label>
                </Button.Root>
                <Button.Root
                  type='button'
                  variant='ghost'
                  size='xs'
                  disabled={services.length <= 1}
                  onClick={() => {
                    onChange(
                      [fieldKey],
                      services.filter((_, idx) => idx !== index),
                    );
                  }}
                >
                  <Button.Label>Remove</Button.Label>
                </Button.Root>
              </div>
            </div>

            <div className={styles.inlineGrid3}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-id`}>
                  Service {index + 1} ID
                </label>
                <input
                  id={`${fieldKey}-${index}-id`}
                  className={styles.input}
                  value={id}
                  aria-invalid={Boolean(idErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'id'], event.target.value);
                  }}
                />
                {idErr ? <p className={styles.fieldError}>{idErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-title`}>
                  Service {index + 1} Title
                </label>
                <input
                  id={`${fieldKey}-${index}-title`}
                  className={styles.input}
                  value={title}
                  aria-invalid={Boolean(titleErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'title'], event.target.value);
                  }}
                />
                {titleErr ? <p className={styles.fieldError}>{titleErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-to`}>
                  Service {index + 1} Route
                </label>
                <select
                  id={`${fieldKey}-${index}-to`}
                  className={styles.select}
                  value={to}
                  aria-invalid={Boolean(toErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'to'], event.target.value);
                  }}
                >
                  {PORTAL_NAVIGABLE_ROUTE_PATHS.map(routePath => (
                    <option key={routePath} value={routePath}>
                      {routePath}
                    </option>
                  ))}
                </select>
                {toErr ? <p className={styles.fieldError}>{toErr}</p> : null}
              </div>
            </div>

            <div className={styles.inlineGrid2}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-badge`}>
                  Service {index + 1} Badge
                </label>
                <input
                  id={`${fieldKey}-${index}-badge`}
                  className={styles.input}
                  value={badge}
                  aria-invalid={Boolean(badgeErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'badge'], event.target.value);
                  }}
                />
                {badgeErr ? <p className={styles.fieldError}>{badgeErr}</p> : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-ctaLabel`}>
                  Service {index + 1} CTA Label
                </label>
                <input
                  id={`${fieldKey}-${index}-ctaLabel`}
                  className={styles.input}
                  value={ctaLabel}
                  aria-invalid={Boolean(ctaErr)}
                  onChange={event => {
                    onChange([fieldKey, index, 'ctaLabel'], event.target.value);
                  }}
                />
                {ctaErr ? <p className={styles.fieldError}>{ctaErr}</p> : null}
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel} htmlFor={`${fieldKey}-${index}-summary`}>
                Service {index + 1} Summary
              </label>
              <textarea
                id={`${fieldKey}-${index}-summary`}
                className={styles.textarea}
                value={summary}
                aria-invalid={Boolean(summaryErr)}
                onChange={event => {
                  onChange([fieldKey, index, 'summary'], event.target.value);
                }}
              />
              {summaryErr ? <p className={styles.fieldError}>{summaryErr}</p> : null}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
