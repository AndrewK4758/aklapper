import {
  OscStatusBadge,
  SfButton,
  TuiWindow,
  type ZshCommandHandler,
  ZshP10kTerminal,
  type ZshTerminalHistoryItem,
} from '@aklapper/ui';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';

import styles from './home.module.css';

const INITIAL_ENTRIES: readonly Omit<ZshTerminalHistoryItem, 'id'>[] = [
  {
    command: 'ls -la',
    output: [
      'drwxr-xr-x  guest  solar-forge  menu/                 # Interactive module launcher',
      'drwxr-xr-x  guest  solar-forge  cadence/              # Sandboxed artifact builder',
      '-rw-r--r--  guest  solar-forge  changes-in-progress   # Production maintenance preview',
    ].join('\n'),
    status: 'ok',
    durationLabel: '6ms',
    timestamp: '00:00:00',
  },
];

const QUICK_COMMANDS = ['help', 'ls', 'menu', 'cadence', 'status', 'clear'] as const;

export default function PortalGreeterRoute() {
  const navigate = useNavigate();

  const commands = useMemo<Readonly<Record<string, ZshCommandHandler>>>(
    () => ({
      help: () => ({
        output: [
          'Available zsh commands:',
          '  ls         — list portal routes & modules',
          '  menu       — open /menu TUI workspace',
          '  cadence    — open /cadence artifact sandbox',
          '  cd <route> — navigate to /menu, /cadence, or /changes-in-progress',
          '  status     — inspect cluster & service state',
          '  whoami     — display active terminal session',
          '  clear      — clear terminal scrollback',
        ].join('\n'),
      }),
      ls: () => ({
        output: 'menu/   cadence/   changes-in-progress',
      }),
      menu: () => {
        void navigate('/menu');
        return { output: 'opening /menu ...' };
      },
      cadence: () => {
        void navigate('/cadence');
        return { output: 'opening /cadence ...' };
      },
      cd: args => {
        const target = (args[0] ?? '').replace(/^\/+|\/+$/g, '');
        if (target === 'menu' || target === 'cadence' || target === 'changes-in-progress') {
          void navigate(`/${target}`);
          return { output: `cd /${target}` };
        }
        return {
          status: 'error',
          output: `cd: no such route: ${args[0] ?? '(empty)'}\nTry: cd menu | cd cadence | cd changes-in-progress`,
        };
      },
      status: () => ({
        output: 'gke-autopilot: 0 pods (scale-to-0) · portal-ssr: online · theme: solar-forge',
      }),
      whoami: () => ({
        output: 'guest@andrew-k.us (tty1)',
      }),
      clear: () => ({ output: '', clear: true }),
    }),
    [navigate],
  );

  return (
    <div className={styles.workspace}>
      <ZshP10kTerminal
        bannerTitle='zsh 5.9 :: powerlevel10k // Solar Forge tty1'
        bannerMeta='local dev · type commands or use TUI below'
        directory='~/projects/aklapper'
        vcsBranch='portfolio_v2'
        vcsState='clean'
        contextLabel='guest@andrew-k.us'
        commands={commands}
        quickCommands={QUICK_COMMANDS}
        initialEntries={INITIAL_ENTRIES}
        placeholder='type a command (help, ls, menu, cadence, cd ...)'
      />

      <TuiWindow
        title='tui :: solar-forge launcher'
        badge={<OscStatusBadge source='gke-autopilot' state='idle' label='0 pods (scale-to-0)' />}
      >
        <div className={styles.tuiBody}>
          <h1 id='greeter-heading'>Solar Forge Agentic Terminal — tty1</h1>
          <p>
            Type directly into the zsh + Powerlevel10k prompt above or use this draggable TUI window
            to launch the clean menu, wake real GKE Autopilot scale-from-zero Go microservices on
            demand, and build live sandboxed artifacts with CADENCE.
          </p>
          <div className={styles.actions}>
            <Link to='/menu'>
              <SfButton variant='primary'>Enter as Guest → /menu</SfButton>
            </Link>
            <Link to='/cadence'>
              <SfButton variant='default'>Open CADENCE → /cadence</SfButton>
            </Link>
            <Link to='/changes-in-progress'>
              <SfButton variant='default'>Preview Changes in Progress</SfButton>
            </Link>
          </div>
        </div>
      </TuiWindow>
    </div>
  );
}
