import type { PortalCadenceLoaderData } from '@aklapper/contracts';
import { loadPortalCadenceDataWithPrerender } from '@aklapper/db';
import { OscStatusBadge, SandboxedArtifactFrame, Separator, Tabs, TuiWindow } from '@aklapper/ui';
import { type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { buildPortalPageMeta } from '../seo';

import styles from './cadence.module.css';

export async function loader(): Promise<PortalCadenceLoaderData> {
  return loadPortalCadenceDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'CADENCE Builder // andrew-k.us',
    description:
      loaderData?.content.description ??
      'Quota-gated prompt-to-artifact sandbox wired for live GKE Autopilot scale-from-zero execution.',
  });
}

export default function PortalCadenceRoute() {
  const { content, presets } = useLoaderData() as PortalCadenceLoaderData;
  const navigate = useNavigate();
  const defaultSlug = presets[0]?.slug;

  return (
    <div className={styles.workspace}>
      <TuiWindow
        title={content.windowTitle}
        onClose={() => void navigate('/')}
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
