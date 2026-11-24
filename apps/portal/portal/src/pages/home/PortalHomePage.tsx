import type { PortalHomeContent, TerminalProfileData } from '@aklapper/contracts';
import {
  Button,
  OscStatusBadge,
  type TerminalFormConfig,
  TerminalWorkspace,
  Toolbar,
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
      <div className={styles.tuiBody}>
        <h1>{content.heading}</h1>
        <p>{content.description}</p>
        <Toolbar.Root className={styles.actions} aria-label='Portal launch actions'>
          {content.actions.map(action => (
            <Button.Link key={action.to} render={<Link to={action.to} />} variant={action.variant}>
              <Button.Label>{action.label}</Button.Label>
            </Button.Link>
          ))}
        </Toolbar.Root>
      </div>
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
