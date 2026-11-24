import type { PortalHomeContent, TerminalProfileData } from '@aklapper/core';
import {
  Button,
  OscStatusBadge,
  PaneLink,
  type TerminalFormConfig,
  TerminalWorkspace,
  TuiHeroCard,
  TuiWindow,
} from '@aklapper/ui';
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
            render={<PaneLink to={action.to} render={<Link to={action.to} />} />}
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
  return (
    <div className={styles.workspace}>
      <TerminalWorkspace
        terminal={terminal}
        terminalForms={terminalForms}
        navigate={onNavigate}
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
