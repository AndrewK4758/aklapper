import {
  OscStatusBadge,
  TuiWindow,
  type ZshCommandHandler,
  ZshP10kTerminal,
  type ZshTerminalHistoryItem,
} from '@aklapper/ui';
import { useEffect, useMemo, useRef } from 'react';

import styles from './changes-in-progress.module.css';

const INITIAL_ENTRIES: readonly Omit<ZshTerminalHistoryItem, 'id'>[] = [
  {
    command: 'status',
    output:
      'andrew-k.us :: Solar Forge v2 rebuild is actively underway.\n' +
      'Navigation is temporarily offline while services migrate to Cloud Run + GKE Autopilot.\n' +
      'Type "help" at the ❯ prompt below to inspect the rebuild status.',
    status: 'ok',
    durationLabel: '8ms',
    timestamp: '00:00:00',
  },
];

const QUICK_COMMANDS = ['help', 'status', 'roadmap', 'stack', 'whoami', 'clear'] as const;

export function ChangesInProgressView() {
  const bootMs = useRef<number>(0);

  useEffect(() => {
    bootMs.current = Date.now();
  }, []);

  const commands = useMemo<Readonly<Record<string, ZshCommandHandler>>>(
    () => ({
      help: () => ({
        output: [
          'Available commands (maintenance tty1):',
          '  status    — current rebuild & deployment status',
          '  roadmap   — active Solar Forge v2 milestones',
          '  stack     — runtime & cloud architecture summary',
          '  whoami    — active session identity',
          '  uname     — print platform kernel banner',
          '  uptime    — show browser session uptime',
          '  clear     — clear terminal scrollback',
        ].join('\n'),
      }),
      status: () => ({
        output: [
          'STATE    : CHANGES IN PROGRESS (maintenance mode)',
          'HOST     : andrew-k.us',
          'RUNTIME  : Google Cloud Run (us-central1, scale-to-0)',
          'PROGRESS : [██████████████░░░░░░] 72%',
          'NOTICE   : Full portal navigation will unlock as soon as v2 rollout completes.',
        ].join('\n'),
      }),
      roadmap: () => ({
        output: [
          '[x] Solar Forge 4-layer CSS variable theme & animated emblem',
          '[x] React Router 8 + Fastify 5 SSR server deployed on Cloud Run',
          '[~] Interactive zsh + Powerlevel10k command shell & TUI desktop',
          '[ ] GKE Autopilot scale-from-zero Go microservices & CADENCE sandbox',
        ].join('\n'),
      }),
      stack: () => ({
        output: [
          'Frontend : React 19 · React Router 8 SSR · Vite 8 · CSS Modules + @layer tokens',
          'Backend  : Go microservices + Fastify 5 Node 24/26 native TS · PostgreSQL 19 · Qdrant',
          'Infra    : Cloud Run (edge SSR) + GKE Autopilot (scale-to-0 workloads)',
        ].join('\n'),
      }),
      whoami: () => ({
        output: 'visitor@andrew-k.us (read-only maintenance tty1)',
      }),
      uname: () => ({
        output: 'SolarForge 2.0.0 andrew-k.us x86_64 CloudRun/Linux',
      }),
      uptime: () => {
        const started = bootMs.current || Date.now();
        const secs = Math.max(0, Math.floor((Date.now() - started) / 1000));
        return { output: `up ${secs}s · 1 user · load average: 0.00, 0.00, 0.00` };
      },
      clear: () => ({ output: '', clear: true }),
    }),
    [],
  );

  return (
    <div className={styles.workspace}>
      <TuiWindow
        title='tui :: andrew-k.us // changes in progress'
        badge={
          <OscStatusBadge source='solar-forge-v2' state='scaling' label='CHANGES IN PROGRESS' />
        }
      >
        <div className={styles.tuiGrid}>
          <h1>Changes in Progress</h1>
          <p className={styles.lead}>
            andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI
            platform. Site navigation is temporarily disabled while the new architecture rolls out.
          </p>
          <progress
            className={styles.progress}
            value={72}
            max={100}
            aria-label='Solar Forge v2 rebuild progress'
          />
          <ul className={styles.checklist}>
            <li className={styles.checkItem}>
              <span className={styles.markerDone}>[x]</span>
              <span>Solar Forge 4-layer CSS variable theme &amp; animated reticle emblem</span>
            </li>
            <li className={styles.checkItem}>
              <span className={styles.markerDone}>[x]</span>
              <span>React Router 8 + Fastify 5 SSR migrated from App Engine to Cloud Run</span>
            </li>
            <li className={styles.checkItem}>
              <span className={styles.markerActive}>[~]</span>
              <span>Interactive zsh + Powerlevel10k command prompt &amp; TUI workspace</span>
            </li>
            <li className={styles.checkItem}>
              <span className={styles.markerQueued}>[ ]</span>
              <span>Scale-from-zero Go microservices &amp; CADENCE live sandbox rollout</span>
            </li>
          </ul>
          <div className={styles.metaRow}>
            <span>mode: maintenance (no navigation)</span>
            <span>progress: 72% · drag titlebar or type below</span>
          </div>
        </div>
      </TuiWindow>

      <ZshP10kTerminal
        bannerTitle='zsh 5.9 :: p10k // andrew-k.us (maintenance)'
        bannerMeta='tty1 · type "help" or press Tab'
        directory='~/andrew-k.us'
        vcsBranch='portfolio_v2 !wip'
        vcsState='modified'
        contextLabel='visitor@andrew-k.us'
        commands={commands}
        quickCommands={QUICK_COMMANDS}
        initialEntries={INITIAL_ENTRIES}
        placeholder='type a command: help, status, roadmap, stack, clear'
      />
    </div>
  );
}

export default function ChangesInProgressRoute() {
  return <ChangesInProgressView />;
}
