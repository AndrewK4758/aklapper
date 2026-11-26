import { Button } from '@aklapper/ui';

import styles from './SiteContentEditor.module.css';

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function reorderList<T>(items: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const target = index + delta;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  if (moved === undefined) return null;
  next.splice(target, 0, moved);
  return next;
}

interface ListOrderControlsProps {
  readonly index: number;
  readonly length: number;
  readonly onMove: (delta: -1 | 1) => void;
  readonly onRemove: () => void;
}

function ListOrderControls({ index, length, onMove, onRemove }: ListOrderControlsProps) {
  return (
    <div className={styles.toolbarGroup}>
      <Button.Root
        type='button'
        variant='ghost'
        size='xs'
        disabled={index === 0}
        onClick={() => {
          onMove(-1);
        }}
      >
        <Button.Label>Up</Button.Label>
      </Button.Root>
      <Button.Root
        type='button'
        variant='ghost'
        size='xs'
        disabled={index === length - 1}
        onClick={() => {
          onMove(1);
        }}
      >
        <Button.Label>Down</Button.Label>
      </Button.Root>
      <Button.Root
        type='button'
        variant='ghost'
        size='xs'
        disabled={length <= 1}
        onClick={onRemove}
      >
        <Button.Label>Remove</Button.Label>
      </Button.Root>
    </div>
  );
}

export interface HomeHighlightsListProps {
  readonly fieldKey: string;
  readonly heading: string;
  readonly highlights: readonly string[];
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function HomeHighlightsListEditor({
  fieldKey,
  heading,
  highlights,
  issuesByPath,
  onChange,
}: HomeHighlightsListProps) {
  const headingErr = issuesByPath[`${fieldKey}.highlightsHeading`]?.[0];
  const listErr = issuesByPath[`${fieldKey}.highlights`]?.[0];

  return (
    <div className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-highlightsHeading`}>
            Highlights Heading
          </label>
          <input
            id={`${fieldKey}-highlightsHeading`}
            className={styles.input}
            value={heading}
            aria-invalid={Boolean(headingErr)}
            onChange={event => {
              onChange([fieldKey, 'highlightsHeading'], event.target.value);
            }}
          />
          {headingErr ? <p className={styles.fieldError}>{headingErr}</p> : null}
        </div>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          disabled={highlights.length >= 12}
          onClick={() => {
            onChange([fieldKey, 'highlights'], [...highlights, 'New highlight summary']);
          }}
        >
          <Button.Label>+ Add Highlight</Button.Label>
        </Button.Root>
      </div>
      {listErr ? <p className={styles.fieldError}>{listErr}</p> : null}
      {highlights.map((item, idx) => {
        const itemErr = issuesByPath[`${fieldKey}.highlights.${idx}`]?.[0];
        return (
          <div key={idx} className={styles.fieldGroup}>
            <div className={styles.subCardHeader}>
              <label className={styles.fieldLabel} htmlFor={`${fieldKey}-highlight-${idx}`}>
                Highlight #{idx + 1}
              </label>
              <ListOrderControls
                index={idx}
                length={highlights.length}
                onMove={delta => {
                  const next = reorderList(highlights, idx, delta);
                  if (next) onChange([fieldKey, 'highlights'], next);
                }}
                onRemove={() => {
                  onChange(
                    [fieldKey, 'highlights'],
                    highlights.filter((_, i) => i !== idx),
                  );
                }}
              />
            </div>
            <input
              id={`${fieldKey}-highlight-${idx}`}
              className={styles.input}
              value={item}
              aria-invalid={Boolean(itemErr)}
              onChange={event => {
                onChange([fieldKey, 'highlights', idx], event.target.value);
              }}
            />
            {itemErr ? <p className={styles.fieldError}>{itemErr}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export interface HomeServicesListProps {
  readonly fieldKey: string;
  readonly heading: string;
  readonly services: readonly Record<string, unknown>[];
  readonly issuesByPath: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (path: readonly (string | number)[], value: unknown) => void;
}

export function HomeServicesListEditor({
  fieldKey,
  heading,
  services,
  issuesByPath,
  onChange,
}: HomeServicesListProps) {
  const headingErr = issuesByPath[`${fieldKey}.servicesHeading`]?.[0];
  const listErr = issuesByPath[`${fieldKey}.services`]?.[0];

  return (
    <div className={styles.subCard}>
      <div className={styles.subCardHeader}>
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={`${fieldKey}-servicesHeading`}>
            Services Heading
          </label>
          <input
            id={`${fieldKey}-servicesHeading`}
            className={styles.input}
            value={heading}
            aria-invalid={Boolean(headingErr)}
            onChange={event => {
              onChange([fieldKey, 'servicesHeading'], event.target.value);
            }}
          />
          {headingErr ? <p className={styles.fieldError}>{headingErr}</p> : null}
        </div>
        <Button.Root
          type='button'
          variant='secondary'
          size='xs'
          disabled={services.length >= 10}
          onClick={() => {
            onChange(
              [fieldKey, 'services'],
              [...services, { command: 'command', summary: 'Describe this portal service.' }],
            );
          }}
        >
          <Button.Label>+ Add Service</Button.Label>
        </Button.Root>
      </div>
      {listErr ? <p className={styles.fieldError}>{listErr}</p> : null}
      {services.map((svc, idx) => {
        const cmdErr = issuesByPath[`${fieldKey}.services.${idx}.command`]?.[0];
        const sumErr = issuesByPath[`${fieldKey}.services.${idx}.summary`]?.[0];
        return (
          <div key={idx} className={styles.subCard}>
            <div className={styles.subCardHeader}>
              <span className={styles.fieldLabel}>Service #{idx + 1}</span>
              <ListOrderControls
                index={idx}
                length={services.length}
                onMove={delta => {
                  const next = reorderList(services, idx, delta);
                  if (next) onChange([fieldKey, 'services'], next);
                }}
                onRemove={() => {
                  onChange(
                    [fieldKey, 'services'],
                    services.filter((_, i) => i !== idx),
                  );
                }}
              />
            </div>
            <div className={styles.inlineGrid2}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-svc-${idx}-cmd`}>
                  Command
                </label>
                <input
                  id={`${fieldKey}-svc-${idx}-cmd`}
                  className={styles.input}
                  value={asString(svc['command'])}
                  aria-invalid={Boolean(cmdErr)}
                  onChange={event => {
                    onChange([fieldKey, 'services', idx, 'command'], event.target.value);
                  }}
                />
                {cmdErr ? <p className={styles.fieldError}>{cmdErr}</p> : null}
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor={`${fieldKey}-svc-${idx}-sum`}>
                  Summary
                </label>
                <input
                  id={`${fieldKey}-svc-${idx}-sum`}
                  className={styles.input}
                  value={asString(svc['summary'])}
                  aria-invalid={Boolean(sumErr)}
                  onChange={event => {
                    onChange([fieldKey, 'services', idx, 'summary'], event.target.value);
                  }}
                />
                {sumErr ? <p className={styles.fieldError}>{sumErr}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
