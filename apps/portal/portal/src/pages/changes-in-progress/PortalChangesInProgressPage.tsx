import type { PortalMaintenanceLoaderData, RoadmapMilestoneStatus } from '@aklapper/core';
import {
  buildZshCommandHandlers,
  formatRoadmapMarker,
  MaintenanceProgressCard,
  OscStatusBadge,
  TerminalWorkspace,
  TuiWindow,
  ZshP10kTerminal,
} from '@aklapper/ui';
import { useMemo, useState } from 'react';

import styles from './PortalChangesInProgressPage.module.css';

export interface PortalChangesInProgressPageProps {
  data: PortalMaintenanceLoaderData;
}

function getMarkerClassName(status: RoadmapMilestoneStatus): string {
  switch (status) {
    case 'done':
      return styles.markerDone;
    case 'active':
      return styles.markerActive;
    case 'queued':
      return styles.markerQueued;
  }
}

export function PortalChangesInProgressPage({ data }: PortalChangesInProgressPageProps) {
  const { content, terminal, milestones } = data;
  const [bootMs] = useState<number>(() => Date.now());

  const commands = useMemo(
    () =>
      buildZshCommandHandlers(terminal.commands, {
        milestones,
        getUptimeSeconds: () => Math.max(0, Math.floor((Date.now() - bootMs) / 1000)),
      }),
    [bootMs, milestones, terminal.commands],
  );

  const primaryView = (
    <div className={styles.workspace}>
      <TuiWindow
        title={content.windowTitle}
        badge={
          <OscStatusBadge
            source={content.statusBadge.source}
            state={content.statusBadge.state}
            label={content.statusBadge.label}
          />
        }
      >
        <MaintenanceProgressCard
          heading={content.heading}
          lead={content.lead}
          progressPercent={content.progressPercent}
          progressAriaLabel={content.progressAriaLabel}
          metaLeft={content.metaLeft}
          metaRight={content.metaRight}
          className={styles.tuiGrid}
        >
          <ul className={styles.checklist}>
            {milestones.map(milestone => (
              <li key={milestone.slug} className={styles.checkItem}>
                <span className={getMarkerClassName(milestone.status)}>
                  {formatRoadmapMarker(milestone.status)}
                </span>
                <span>{milestone.label}</span>
              </li>
            ))}
          </ul>
        </MaintenanceProgressCard>
      </TuiWindow>

      <ZshP10kTerminal
        bannerTitle={terminal.bannerTitle}
        bannerMeta={terminal.bannerMeta}
        osLabel={terminal.osLabel}
        directory={terminal.directory}
        vcsBranch={terminal.vcsBranch}
        vcsState={terminal.vcsState}
        contextLabel={terminal.contextLabel}
        commands={commands}
        quickCommands={terminal.quickCommands}
        initialEntries={terminal.initialEntries}
        placeholder={terminal.placeholder}
      />
    </div>
  );

  return (
    <div className={styles.viewport}>
      <TerminalWorkspace
        terminal={terminal}
        disableMenuShortcut
        primaryPane={{
          title: 'tui :: changes-in-progress',
          content: primaryView,
        }}
      />
    </div>
  );
}
