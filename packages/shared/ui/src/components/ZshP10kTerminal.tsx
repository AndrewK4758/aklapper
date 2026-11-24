import {
  type KeyboardEvent,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { SolarForgeEmblem } from '../elements/SolarForgeEmblem';

import styles from './ZshP10kTerminal.module.css';

export type VcsState = 'clean' | 'modified' | 'untracked';

export interface ZshCommandResult {
  output: string;
  status?: 'ok' | 'error';
  clear?: boolean;
}

export type ZshCommandHandler = (args: readonly string[], raw: string) => ZshCommandResult;

export interface ZshTerminalHistoryItem {
  id: string;
  command: string;
  output: string;
  status: 'ok' | 'error';
  durationLabel: string;
  timestamp: string;
}

export interface ZshP10kTerminalProps {
  bannerTitle?: string;
  bannerMeta?: string;
  osLabel?: string;
  directory: string;
  vcsBranch: string;
  vcsState?: VcsState;
  contextLabel: string;
  commands: Readonly<Record<string, ZshCommandHandler>>;
  quickCommands?: readonly string[];
  initialEntries?: readonly Omit<ZshTerminalHistoryItem, 'id'>[];
  placeholder?: string;
  initialTime?: string;
}

function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

interface PromptHeaderProps {
  osLabel: string;
  directory: string;
  vcsBranch: string;
  vcsState: VcsState;
  status: 'ok' | 'error';
  durationLabel: string;
  contextLabel: string;
  timestamp: string;
}

function P10kPromptTop({
  osLabel,
  directory,
  vcsBranch,
  vcsState,
  status,
  durationLabel,
  contextLabel,
  timestamp,
}: PromptHeaderProps) {
  const segments = directory.split('/');
  const anchor = segments.pop() ?? directory;
  const prefix = segments.length > 0 ? `${segments.join('/')}/` : '';

  return (
    <div className={styles.promptTop} aria-hidden='true'>
      <span className={styles.frame}>╭─</span>
      <span className={styles.tailLeft}>░▒▓</span>
      <div className={styles.leftSegments}>
        <span className={`${styles.seg} ${styles.segOs}`}>{osLabel}</span>
        <span className={styles.arrowOsToDir} />
        <span className={`${styles.seg} ${styles.segDir}`}>
          {prefix}
          <strong className={styles.segDirAnchor}>{anchor}</strong>
        </span>
        <span className={styles.arrowDirToVcs} data-vcs-state={vcsState} />
        <span className={`${styles.seg} ${styles.segVcs}`} data-vcs-state={vcsState}>
          ⎇ {vcsBranch}
        </span>
        <span className={styles.arrowVcsEnd} data-vcs-state={vcsState} />
      </div>
      <span className={styles.gapLine} />
      <div className={styles.rightSegments}>
        <span className={styles.arrowStatusStart} data-status={status} />
        <span className={`${styles.seg} ${styles.segStatus}`} data-status={status}>
          {status === 'ok' ? '✔' : '✘'}
        </span>
        <span className={styles.arrowStatusToExec} data-status={status} />
        <span className={`${styles.seg} ${styles.segExec}`}>{durationLabel}</span>
        <span className={styles.arrowExecToCtx} />
        <span className={`${styles.seg} ${styles.segCtx}`}>{contextLabel}</span>
        <span className={styles.arrowCtxToTime} />
        <span className={`${styles.seg} ${styles.segTime}`}>{timestamp}</span>
      </div>
      <span className={styles.tailRight}>▓▒░</span>
      <span className={styles.frame}>─╮</span>
    </div>
  );
}

export function ZshP10kTerminal({
  bannerTitle = 'zsh 5.9 :: powerlevel10k // Solar Forge',
  bannerMeta = 'tty1 · nerdfont-rainbow',
  osLabel = '⚡',
  directory,
  vcsBranch,
  vcsState = 'clean',
  contextLabel,
  commands,
  quickCommands = [],
  initialEntries = [],
  placeholder = 'type a command (try: help, status)',
  initialTime = '00:00:00',
}: ZshP10kTerminalProps) {
  const [entries, setEntries] = useState<ZshTerminalHistoryItem[]>(() =>
    initialEntries.map((item, idx) => ({ ...item, id: `init-${idx}` })),
  );
  const [input, setInput] = useState('');
  const [lastStatus, setLastStatus] = useState<'ok' | 'error'>('ok');
  const [lastDuration, setLastDuration] = useState('12ms');
  const [clock, setClock] = useState(initialTime);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(initialEntries.length + 1);

  useEffect(() => {
    const immediate = setTimeout(() => {
      setClock(formatClock(new Date()));
    }, 0);
    const interval = setInterval(() => {
      setClock(formatClock(new Date()));
    }, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  const commandNames = useMemo(() => Object.keys(commands).sort(), [commands]);

  const suggestion = useMemo(() => {
    const trimmed = input.trimStart();
    if (!trimmed) return '';
    const match = commandNames.find(name => name.startsWith(trimmed) && name !== trimmed);
    return match ? match.slice(trimmed.length) : '';
  }, [commandNames, input]);

  const executeCommand = (rawInput: string) => {
    const trimmed = rawInput.trim();
    const nowLabel = formatClock(new Date());
    setClock(nowLabel);

    if (!trimmed) {
      return;
    }

    const startMs = typeof performance !== 'undefined' ? performance.now() : 0;
    const parts = trimmed.split(/\s+/);
    const cmdName = (parts[0] ?? '').toLowerCase();
    const args = parts.slice(1);
    const handler = commands[cmdName];

    let result: ZshCommandResult;
    if (handler) {
      result = handler(args, trimmed);
    } else {
      result = {
        status: 'error',
        output: `zsh: command not found: ${cmdName}\nType "help" to list available commands.`,
      };
    }

    const elapsedMs =
      typeof performance !== 'undefined' ? Math.max(1, Math.round(performance.now() - startMs)) : 1;
    const durationLabel = `${elapsedMs}ms`;
    const status = result.status ?? 'ok';

    setCmdHistory(prev => [trimmed, ...prev]);
    setHistoryCursor(-1);
    setLastStatus(status);
    setLastDuration(durationLabel);
    setInput('');

    if (result.clear) {
      setEntries([]);
      return;
    }

    const id = `cmd-${nextId.current++}`;
    setEntries(prev => [
      ...prev,
      {
        id,
        command: trimmed,
        output: result.output,
        status,
        durationLabel,
        timestamp: nowLabel,
      },
    ]);
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    executeCommand(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && suggestion) {
      event.preventDefault();
      setInput(prev => `${prev}${suggestion}`);
      return;
    }
    if (
      event.key === 'ArrowRight' &&
      suggestion &&
      event.currentTarget.selectionStart === input.length
    ) {
      event.preventDefault();
      setInput(prev => `${prev}${suggestion}`);
      return;
    }
    if (event.key === 'ArrowUp' && cmdHistory.length > 0) {
      event.preventDefault();
      const nextCursor = Math.min(historyCursor + 1, cmdHistory.length - 1);
      setHistoryCursor(nextCursor);
      setInput(cmdHistory[nextCursor] ?? '');
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (historyCursor <= 0) {
        setHistoryCursor(-1);
        setInput('');
      } else {
        const nextCursor = historyCursor - 1;
        setHistoryCursor(nextCursor);
        setInput(cmdHistory[nextCursor] ?? '');
      }
    }
  };

  const runQuickCommand = (cmd: string) => {
    executeCommand(cmd);
    inputRef.current?.focus();
  };

  return (
    <section className={styles.terminal} aria-label='Interactive Zsh Powerlevel10k Terminal'>
      <div className={styles.banner}>
        <span className={styles.bannerBrand}>
          <SolarForgeEmblem size={18} />
          <span>{bannerTitle}</span>
        </span>
        <span>{bannerMeta}</span>
      </div>

      <div ref={scrollRef} className={styles.history} role='log' aria-live='polite'>
        {entries.map(entry => (
          <div key={entry.id} className={styles.entry}>
            <div className={styles.promptBlock}>
              <P10kPromptTop
                osLabel={osLabel}
                directory={directory}
                vcsBranch={vcsBranch}
                vcsState={vcsState}
                status={entry.status}
                durationLabel={entry.durationLabel}
                contextLabel={contextLabel}
                timestamp={entry.timestamp}
              />
              <div className={styles.promptBottom}>
                <span className={styles.frame}>╰─</span>
                <span className={styles.promptChar} data-status={entry.status}>
                  ❯
                </span>
                <span className={styles.commandEcho}>{entry.command}</span>
                <span className={styles.frame}>─╯</span>
              </div>
            </div>
            {entry.output ? (
              <pre className={styles.output} data-status={entry.status}>
                {entry.output}
              </pre>
            ) : null}
          </div>
        ))}

        <form className={styles.promptBlock} onSubmit={handleSubmit}>
          <P10kPromptTop
            osLabel={osLabel}
            directory={directory}
            vcsBranch={vcsBranch}
            vcsState={vcsState}
            status={lastStatus}
            durationLabel={lastDuration}
            contextLabel={contextLabel}
            timestamp={clock}
          />
          <label className={styles.promptBottom}>
            <span className={styles.frame}>╰─</span>
            <span className={styles.promptChar} data-status={lastStatus}>
              ❯
            </span>
            <div className={styles.inputWrap}>
              {suggestion ? (
                <span className={styles.ghost} aria-hidden='true'>
                  <span className={styles.ghostTyped}>{input}</span>
                  {suggestion}
                </span>
              ) : null}
              <input
                ref={inputRef}
                type='text'
                className={styles.input}
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                aria-label='Zsh command input'
                autoComplete='off'
                autoCorrect='off'
                autoCapitalize='off'
                spellCheck={false}
              />
            </div>
            <span className={styles.frame}>─╯</span>
          </label>
        </form>
      </div>

      {quickCommands.length > 0 ? (
        <div className={styles.quickBar}>
          <span>run:</span>
          {quickCommands.map(cmd => (
            <button
              key={cmd}
              type='button'
              className={styles.quickChip}
              onClick={() => runQuickCommand(cmd)}
            >
              {cmd}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
