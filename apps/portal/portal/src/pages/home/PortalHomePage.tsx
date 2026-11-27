import type { PortalHomeContent, TerminalProfileData } from '@aklapper/core';
import { trackTerminalCommand } from '@aklapper/core/analytics';
import {
  buildZshCommandHandlers,
  Button,
  OscStatusBadge,
  PaneLink,
  PortalHomeTerminalIntro,
  type TerminalFormConfig,
  TerminalWorkspace,
  TuiHeroCard,
  TuiWindow,
  usePaneNavigation,
  useViewportLayoutMode,
  ZshP10kTerminal,
} from '@aklapper/ui';
import { useMemo } from 'react';
import { Link } from 'react-router';

import styles from './PortalHomePage.module.css';

export interface PortalHomePageProps {
  content: PortalHomeContent;
  terminal: TerminalProfileData;
  terminalForms?: Readonly<Record<string, TerminalFormConfig>>;
  onNavigate?: (to: string) => void | Promise<void>;
}

export interface PortalLauncherTuiProps {
  content: PortalHomeContent;
  ttyNumber: number;
  isSinglePane: boolean;
  onClose: () => void;
}

export function PortalLauncherTui({
  content,
  ttyNumber,
  isSinglePane,
  onClose,
}: PortalLauncherTuiProps) {
  return (
    <TuiWindow
      title={isSinglePane ? content.tuiTitle : `${content.tuiTitle} · tty${ttyNumber}`}
      closeOnEscape={false}
      onClose={onClose}
      badge={
        <OscStatusBadge
          source={content.tuiBadge.source}
          state={content.tuiBadge.state}
          label={content.tuiBadge.label}
        />
      }
    >
      <TuiHeroCard
        heading={content.heading}
        description={content.description}
        actions={content.actions}
        actionsAriaLabel='Portal launch actions'
        className={styles.tuiBody}
        actionsClassName={styles.actions}
        renderAction={action => (
          <Button.Link
            key={action.to}
            render={<PaneLink to={action.to} render={<Link to={action.to} prefetch='intent' />} />}
            variant={action.variant}
          >
            <Button.Label>{action.label}</Button.Label>
          </Button.Link>
        )}
      />
    </TuiWindow>
  );
}

export function PortalHomePage({
  content,
  terminal,
  terminalForms,
  onNavigate,
}: PortalHomePageProps) {
  const layoutMode = useViewportLayoutMode();
  const paneNav = usePaneNavigation();
  const mobileCommands = useMemo(
    () =>
      buildZshCommandHandlers(terminal.commands, {
        navigate: onNavigate,
        openTui: () => {
          if (paneNav) {
            paneNav.push('tui');
          } else {
            void onNavigate?.('/cadence');
          }
        },
      }),
    [terminal.commands, onNavigate, paneNav],
  );

  const initialEntryCompanion = useMemo(
    () => (
      <PortalHomeTerminalIntro
        portrait={content.portrait}
        resumeSummary={content.resumeSummary}
        priorityPortrait={layoutMode === 'desktop'}
      />
    ),
    [content.portrait, content.resumeSummary, layoutMode],
  );

  if (layoutMode !== 'desktop') {
    return (
      <div className={styles.workspace}>
        <ZshP10kTerminal
          variant='viewport'
          showBanner={false}
          osLabel={terminal.osLabel}
          directory={terminal.directory}
          vcsBranch={terminal.vcsBranch}
          vcsState={terminal.vcsState}
          contextLabel={terminal.contextLabel}
          commands={mobileCommands}
          terminalForms={terminalForms}
          quickCommands={terminal.quickCommands}
          initialEntries={terminal.initialEntries}
          initialEntryCompanion={initialEntryCompanion}
          placeholder={terminal.placeholder}
          onCommandExecute={commandName => {
            trackTerminalCommand(commandName, '/');
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <TerminalWorkspace
        terminal={terminal}
        terminalForms={terminalForms}
        initialEntryCompanion={initialEntryCompanion}
        navigate={onNavigate}
        onCommandExecute={commandName => {
          trackTerminalCommand(commandName, '/');
        }}
        renderTui={({ ttyNumber, isSinglePane, closeTui }) => (
          <PortalLauncherTui
            content={content}
            ttyNumber={ttyNumber}
            isSinglePane={isSinglePane}
            onClose={closeTui}
          />
        )}
      />
    </div>
  );
}
