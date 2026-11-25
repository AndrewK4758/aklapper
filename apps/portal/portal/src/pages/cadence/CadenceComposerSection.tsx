import type { CadencePreset, PortalCadenceContent } from '@aklapper/core';
import { Button, Select, Switch } from '@aklapper/ui';
import type { FormEvent } from 'react';

import styles from './PortalCadencePage.module.css';

export const CUSTOM_PRESET_VALUE = '__custom__';

export interface CadenceComposerSectionProps {
  readonly content: PortalCadenceContent;
  readonly presets: readonly CadencePreset[];
  readonly activePresetSlug: string;
  readonly activePreset: CadencePreset | null;
  readonly promptText: string;
  readonly fastMode: boolean;
  readonly isPipelineBusy: boolean;
  readonly canSubmit: boolean;
  readonly onPresetChange: (slug: string) => void;
  readonly onPromptChange: (value: string) => void;
  readonly onFastModeChange: (checked: boolean) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function CadenceComposerSection({
  content,
  presets,
  activePresetSlug,
  activePreset,
  promptText,
  fastMode,
  isPipelineBusy,
  canSubmit,
  onPresetChange,
  onPromptChange,
  onFastModeChange,
  onSubmit,
}: CadenceComposerSectionProps) {
  const selectItems: Record<string, string> = {
    ...Object.fromEntries(presets.map(preset => [preset.slug, preset.title])),
    [CUSTOM_PRESET_VALUE]: content.customPresetLabel,
  };

  return (
    <>
      <div className={styles.selectorRow}>
        <div className={styles.selectField}>
          <label className={styles.composerLabel} htmlFor='cadence-preset-trigger'>
            {content.presetSelectLabel}
          </label>
          <Select.Root
            value={activePresetSlug}
            items={selectItems}
            onValueChange={val => {
              if (val) onPresetChange(String(val));
            }}
          >
            <Select.Trigger id='cadence-preset-trigger' data-testid='cadence-preset-select'>
              <Select.Value placeholder={content.presetSelectLabel} />
              <Select.Icon aria-hidden='true'>▾</Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner alignItemWithTrigger={false} sideOffset={4}>
                <Select.Popup>
                  <Select.List>
                    {presets.map(preset => (
                      <Select.Item
                        key={preset.slug}
                        value={preset.slug}
                        data-testid={`cadence-preset-${preset.slug}`}
                      >
                        <Select.ItemIndicator>✓</Select.ItemIndicator>
                        <Select.ItemText>{preset.title}</Select.ItemText>
                      </Select.Item>
                    ))}
                    <Select.Separator />
                    <Select.Item value={CUSTOM_PRESET_VALUE} data-testid='cadence-preset-custom'>
                      <Select.ItemIndicator>✓</Select.ItemIndicator>
                      <Select.ItemText>{content.customPresetLabel}</Select.ItemText>
                    </Select.Item>
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
          <p className={styles.presetPrompt}>
            {activePreset
              ? `${activePreset.expectedKind}: ${activePreset.starterPrompt}`
              : content.promptPlaceholder}
          </p>
        </div>
      </div>

      <form className={styles.composer} onSubmit={onSubmit}>
        <label className={styles.composerLabel} htmlFor='cadence-prompt-input'>
          {content.promptLabel}
        </label>
        <textarea
          id='cadence-prompt-input'
          name='prompt'
          rows={3}
          className={styles.textarea}
          value={promptText}
          onChange={event => onPromptChange(event.currentTarget.value)}
          placeholder={content.promptPlaceholder}
          data-testid='cadence-prompt-input'
        />
        <div className={styles.composerActions}>
          <div className={styles.modeControlGroup}>
            <Switch.Label>
              <Switch.Root
                checked={fastMode}
                onCheckedChange={onFastModeChange}
                aria-label={content.fastModeLabel}
                data-testid='cadence-fast-mode-switch'
              >
                <Switch.Thumb />
              </Switch.Root>
              <span>
                {content.fastModeLabel} (
                {fastMode ? content.modeBadgeFastLabel : content.modeBadgeLiveLabel})
              </span>
            </Switch.Label>
            <span className={styles.isolationHint}>{content.fastModeHint}</span>
          </div>
          <Button
            type='submit'
            variant='primary'
            disabled={!canSubmit}
            data-testid='cadence-run-submit'
          >
            <Button.Label>
              {isPipelineBusy ? content.runningRunLabel : content.submitRunLabel}
            </Button.Label>
          </Button>
        </div>
      </form>
    </>
  );
}
