import type { CadencePreset, PortalCadenceContent } from '@aklapper/contracts';
import { OscStatusBadge, SandboxedArtifactFrame, Separator, Tabs, TuiWindow } from '@aklapper/ui';

import styles from './PortalCadencePage.module.css';

export interface PortalCadencePageProps {
  content: PortalCadenceContent;
  presets: readonly CadencePreset[];
  onClose: () => void;
}

export function PortalCadencePage({ content, presets, onClose }: PortalCadencePageProps) {
  const defaultSlug = presets[0]?.slug;

  return (
    <div className={styles.workspace}>
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
        <p>{content.description}</p>
        <Separator.Root />
        {defaultSlug ? (
          <Tabs.Root defaultValue={defaultSlug}>
            <Tabs.List>
              {presets.map(preset => (
                <Tabs.Tab key={preset.slug} value={preset.slug}>
                  {preset.title}
                </Tabs.Tab>
              ))}
              <Tabs.Indicator />
            </Tabs.List>
            {presets.map(preset => (
              <Tabs.Panel key={preset.slug} value={preset.slug} className={styles.presetPanel}>
                <p className={styles.presetPrompt}>{preset.starterPrompt}</p>
                <SandboxedArtifactFrame
                  title={content.iframeTitle}
                  srcDoc={preset.starterArtifactHtml}
                />
              </Tabs.Panel>
            ))}
          </Tabs.Root>
        ) : (
          <SandboxedArtifactFrame title={content.iframeTitle} srcDoc='' />
        )}
      </TuiWindow>
    </div>
  );
}
