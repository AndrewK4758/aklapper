import { matchTerminalReadlineShortcut, type TerminalReadlineAction } from '@aklapper/core';
import {
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { Button, Form, Input, ScrollArea, Separator, Toolbar } from '../elements/base';
import { SolarForgeEmblem } from '../elements/SolarForgeEmblem';
import { MAX_TERMINAL_HISTORY_ENTRIES, trimCommandHistory } from './routeWorkspaceSnapshot';
import {
  dispatchTerminalAccessoryAction,
  type TerminalAccessoryAction,
  TerminalAccessoryBar,
} from './TerminalAccessoryBar';
import {
  formatTerminalClock,
  getTerminalClockSnapshot,
  subscribeTerminalClock,
} from './terminalClockStore';
import {
  attachFileToTerminalForm,
  buildSessionFormData,
  getActiveFormStep,
  getFormPromptBadge,
  getFormPromptPlaceholder,
  processTerminalFormInput,
  resolveTerminalFormSubmitResult,
  startTerminalFormSession,
  type TerminalFormConfig,
  type TerminalFormSessionState,
} from './terminalFormSession';
import {
  TerminalReadlineRegistryContext,
  type ZshTerminalHandle,
} from './terminalReadlineRegistryContext';
import { useHydrated } from './useHydrated';
import { useViewportContext } from './ViewportProvider';

import styles from './ZshP10kTerminal.module.css';

export type VcsState = 'clean' | 'modified' | 'untracked';
export type TerminalVariant = 'framed' | 'viewport';

export interface ZshCommandResult {
  output: string;
  status?: 'ok' | 'error';
  clear?: boolean;
}

export type ZshCommandHandler = (args: readonly string[], raw: string) => ZshCommandResult;

export interface ZshTerminalHistoryItem {
  id: string;
  promptLabel?: string;
  command: string;
  output: string;
  status: 'ok' | 'error';
  durationLabel: string;
  timestamp: string;
}

export type TerminalIntroMountBranch =
  | 'tty1-with-companion'
  | 'tty-without-companion'
  | 'companion-cleared';

const lastTerminalIntroBranchByLabel = new Map<string, TerminalIntroMountBranch>();

export function resetTerminalIntroBranchTelemetryForTest(): void {
  lastTerminalIntroBranchByLabel.clear();
}

function emitTerminalIntroMountBranch(
  terminalLabel: string,
  branch: TerminalIntroMountBranch,
): void {
  if (typeof window === 'undefined') return;
  if (lastTerminalIntroBranchByLabel.get(terminalLabel) === branch) {
    return;
  }
  if (lastTerminalIntroBranchByLabel.size >= 64) {
    lastTerminalIntroBranchByLabel.clear();
  }
  lastTerminalIntroBranchByLabel.set(terminalLabel, branch);
  console.debug(
    JSON.stringify({
      event: 'portal.home.terminal_intro_mount_branch',
      seam_type: 'RULE_DIVERGENCE',
      terminalLabel,
      branch,
    }),
  );
}

export interface ZshP10kTerminalProps {
  variant?: TerminalVariant;
  showBanner?: boolean;
  bannerTitle?: string;
  bannerMeta?: string;
  bannerActions?: ReactNode;
  osLabel?: string;
  directory: string;
  vcsBranch: string;
  vcsState?: VcsState;
  contextLabel: string;
  commands: Readonly<Record<string, ZshCommandHandler>>;
  terminalForms?: Readonly<Record<string, TerminalFormConfig>>;
  quickCommands?: readonly string[];
  initialEntries?: readonly Omit<ZshTerminalHistoryItem, 'id'>[];
  initialEntryCompanion?: ReactNode;
  initialCommandHistory?: readonly string[];
  maxCommandHistory?: number;
  onCommandHistoryChange?: (history: readonly string[]) => void;
  placeholder?: string;
  initialTime?: string;
  focusOnMount?: boolean;
  isActive?: boolean;
  focusToken?: number;
  inputLabel?: string;
  ariaLabel?: string;
  onFocusPane?: () => void;
  onEscape?: () => void;
}

function scheduleCaret(inputEl: HTMLInputElement | HTMLTextAreaElement, position: number): void {
  queueMicrotask(() => {
    inputEl.setSelectionRange(position, position);
  });
}

const PROMPT_TAIL_WIDTH = 24;
const PROMPT_TAIL_HEIGHT = 16;
const PROMPT_TAIL_BAND_WIDTH = 8;

function isLeftTailDotLit(x: number, y: number): boolean {
  if (x < PROMPT_TAIL_BAND_WIDTH) {
    return (y % 2 === 0 && x % 4 === 0) || (y % 2 === 1 && x % 4 === 2);
  }
  if (x < PROMPT_TAIL_BAND_WIDTH * 2) {
    return (x + y) % 2 === 0;
  }
  const localX = x - PROMPT_TAIL_BAND_WIDTH * 2;
  return !((y % 2 === 0 && localX % 4 === 2) || (y % 2 === 1 && localX % 4 === 0));
}

function buildPromptTailPath(direction: 'left' | 'right'): string {
  const commands: string[] = [];
  for (let y = 0; y < PROMPT_TAIL_HEIGHT; y++) {
    let x = 0;
    while (x < PROMPT_TAIL_WIDTH) {
      const sampleX = direction === 'left' ? x : PROMPT_TAIL_WIDTH - 1 - x;
      if (!isLeftTailDotLit(sampleX, y)) {
        x++;
        continue;
      }
      const runStart = x;
      while (x < PROMPT_TAIL_WIDTH) {
        const nextSampleX = direction === 'left' ? x : PROMPT_TAIL_WIDTH - 1 - x;
        if (!isLeftTailDotLit(nextSampleX, y)) {
          break;
        }
        x++;
      }
      commands.push(`M${runStart} ${y}h${x - runStart}v1h-${x - runStart}z`);
    }
  }
  return commands.join('');
}

const LEFT_TAIL_PATH = buildPromptTailPath('left');
const RIGHT_TAIL_PATH = buildPromptTailPath('right');

interface PromptFadeTailProps {
  direction: 'left' | 'right';
}

function PromptFadeTail({ direction }: PromptFadeTailProps) {
  return (
    <svg
      className={direction === 'left' ? styles.tailLeft : styles.tailRight}
      viewBox={`0 0 ${PROMPT_TAIL_WIDTH} ${PROMPT_TAIL_HEIGHT}`}
      preserveAspectRatio='none'
      shapeRendering='crispEdges'
      aria-hidden='true'
      focusable='false'
      data-prompt-tail={direction}
    >
      <path d={direction === 'left' ? LEFT_TAIL_PATH : RIGHT_TAIL_PATH} fill='currentColor' />
    </svg>
  );
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

function PromptHeader({
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
      <PromptFadeTail direction='left' />
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
      <PromptFadeTail direction='right' />
      <span className={styles.frame}>─╮</span>
    </div>
  );
}

export function ZshP10kTerminal({
  variant = 'framed',
  showBanner,
  bannerTitle = 'Solar Forge Terminal // tty1',
  bannerMeta = 'tty1 · interactive shell',
  bannerActions,
  osLabel = '⚡',
  directory,
  vcsBranch,
  vcsState = 'clean',
  contextLabel,
  commands,
  terminalForms,
  quickCommands = [],
  initialEntries = [],
  initialEntryCompanion,
  initialCommandHistory,
  maxCommandHistory = MAX_TERMINAL_HISTORY_ENTRIES,
  onCommandHistoryChange,
  placeholder = 'type a command (try: help, status)',
  initialTime = '00:00:00',
  focusOnMount = false,
  isActive = true,
  focusToken = 0,
  inputLabel = 'Terminal command input',
  ariaLabel = 'Interactive Terminal',
  onFocusPane,
  onEscape,
}: ZshP10kTerminalProps) {
  const shouldShowBanner = showBanner ?? variant !== 'viewport';
  const isHydrated = useHydrated();
  const { isMobile } = useViewportContext();
  const [inputFocused, setInputFocused] = useState(false);
  const [entries, setEntries] = useState<ZshTerminalHistoryItem[]>(() =>
    initialEntries.map((item, idx) => ({ ...item, id: `init-${idx}` })),
  );
  const [input, setInput] = useState('');
  const [lastStatus, setLastStatus] = useState<'ok' | 'error'>('ok');
  const [lastDuration, setLastDuration] = useState('12ms');
  const clock = useSyncExternalStore(
    subscribeTerminalClock,
    getTerminalClockSnapshot,
    () => initialTime,
  );
  const [cmdHistory, setCmdHistory] = useState<string[]>(() =>
    initialCommandHistory && initialCommandHistory.length > 0
      ? [...trimCommandHistory(initialCommandHistory, maxCommandHistory)]
      : [],
  );
  const [hydratedHistorySynced, setHydratedHistorySynced] = useState(
    () => (initialCommandHistory?.length ?? 0) > 0,
  );
  const [hasLocalCommand, setHasLocalCommand] = useState(false);
  const [historyCursor, setHistoryCursor] = useState<number>(-1);

  if (
    !hydratedHistorySynced &&
    !hasLocalCommand &&
    initialCommandHistory &&
    initialCommandHistory.length > 0
  ) {
    setHydratedHistorySynced(true);
    setCmdHistory([...trimCommandHistory(initialCommandHistory, maxCommandHistory)]);
  }
  const [formSession, setFormSession] = useState<TerminalFormSessionState | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const prevEntriesLengthRef = useRef(entries.length);
  const nextId = useRef(initialEntries.length + 1);
  const submitSeqRef = useRef(0);

  const hasInitCompanionEntry = Boolean(
    initialEntryCompanion && entries.some(entry => entry.id === 'init-0'),
  );
  const introMountBranch: TerminalIntroMountBranch = initialEntryCompanion
    ? hasInitCompanionEntry
      ? 'tty1-with-companion'
      : 'companion-cleared'
    : 'tty-without-companion';
  emitTerminalIntroMountBranch(ariaLabel, introMountBranch);

  const activeFormStep = formSession ? getActiveFormStep(formSession) : null;
  const isTextareaStep = activeFormStep?.field.fieldType === 'textarea';
  const isFileStep = activeFormStep?.field.fieldType === 'file';
  const isFormActive = formSession !== null;
  const isSubmittingForm = formSession?.phase === 'submitting';
  const activeFormConfig = formSession
    ? terminalForms?.[formSession.definition.cliCommand.toLowerCase()]
    : undefined;
  const fileStepField = formSession?.steps.find(step => step.field.fieldType === 'file')?.field;
  const formFileAccept =
    fileStepField?.fieldType === 'file' ? fileStepField.accept?.join(',') : undefined;
  const activePromptBadge = formSession ? getFormPromptBadge(formSession) : null;
  const activePlaceholder = formSession ? getFormPromptPlaceholder(formSession) : placeholder;
  const textareaRows = isTextareaStep ? Math.min(8, Math.max(2, input.split('\n').length)) : 2;
  const showDragOver = isDragOver && formSession !== null && !isSubmittingForm;

  useEffect(() => {
    const prevLength = prevEntriesLengthRef.current;
    prevEntriesLengthRef.current = entries.length;
    if (entries.length > prevLength && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  useEffect(() => {
    if ((focusOnMount || isFormActive) && isActive) {
      const focusOptions: FocusOptions | undefined =
        Boolean(initialEntryCompanion) && !hasLocalCommand ? { preventScroll: true } : undefined;
      if (isTextareaStep) {
        textareaRef.current?.focus(focusOptions);
      } else {
        inputRef.current?.focus(focusOptions);
      }
    }
  }, [
    focusOnMount,
    isActive,
    focusToken,
    isFormActive,
    isTextareaStep,
    initialEntryCompanion,
    hasLocalCommand,
  ]);

  const commandNames = useMemo(() => {
    const merged = new Set<string>(Object.keys(commands));
    if (terminalForms) {
      for (const name of Object.keys(terminalForms)) {
        merged.add(name);
      }
    }
    return Array.from(merged).sort();
  }, [commands, terminalForms]);

  const suggestion = useMemo(() => {
    if (formSession !== null) return '';
    const trimmed = input.trimStart();
    if (!trimmed) return '';
    const match = commandNames.find(name => name.startsWith(trimmed) && name !== trimmed);
    return match ? match.slice(trimmed.length) : '';
  }, [commandNames, formSession, input]);

  const appendEntry = useCallback((item: Omit<ZshTerminalHistoryItem, 'id'>) => {
    const id = `cmd-${nextId.current++}`;
    setEntries(prev => [...prev, { ...item, id }]);
  }, []);

  const focusActiveInput = () => {
    if (isTextareaStep) {
      textareaRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  };

  const runFormSubmission = async (
    session: TerminalFormSessionState,
    config: TerminalFormConfig,
    startedAtMs: number,
  ) => {
    const seq = ++submitSeqRef.current;
    let result: Awaited<ReturnType<TerminalFormConfig['submit']>>;
    try {
      result = await config.submit(buildSessionFormData(session));
    } catch (error) {
      result = {
        ok: false,
        source: 'server',
        formError:
          error instanceof Error
            ? `Network error while transmitting contact form: ${error.message}`
            : 'Network error while transmitting contact form.',
        fieldErrors: {},
      };
    }

    if (seq !== submitSeqRef.current) {
      return;
    }

    const elapsedMs =
      typeof performance !== 'undefined'
        ? Math.max(1, Math.round(performance.now() - startedAtMs))
        : 1;
    const durationLabel = `${elapsedMs}ms`;
    const nowLabel = formatTerminalClock(new Date());
    const resolved = resolveTerminalFormSubmitResult(session, result);

    setLastStatus(resolved.status);
    setLastDuration(durationLabel);
    setFormSession(resolved.session);
    setInput(resolved.nextInput);
    setIsDragOver(false);

    appendEntry({
      promptLabel: `${session.definition.cliCommand} :: ${result.ok ? 'receipt' : result.source}`,
      command: result.ok ? 'POST /contact → 201 Created' : 'POST /contact → rejected',
      output: resolved.output,
      status: resolved.status,
      durationLabel,
      timestamp: nowLabel,
    });
  };

  const submitFormInput = (rawValue: string) => {
    if (!formSession || formSession.phase === 'submitting') {
      return;
    }

    const nowLabel = formatTerminalClock(new Date());
    const startMs = typeof performance !== 'undefined' ? performance.now() : 0;
    const promptLabel = getFormPromptBadge(formSession);
    const outcome = processTerminalFormInput(formSession, rawValue);
    const elapsedMs =
      typeof performance !== 'undefined' ? Math.max(1, Math.round(performance.now() - startMs)) : 1;
    const durationLabel = `${elapsedMs}ms`;

    setLastDuration(durationLabel);

    if (outcome.kind === 'open-file-picker') {
      fileInputRef.current?.click();
      setLastStatus('ok');
      setInput('');
      appendEntry({
        promptLabel,
        command: rawValue.trim() || 'attach',
        output: outcome.output,
        status: 'ok',
        durationLabel,
        timestamp: nowLabel,
      });
      return;
    }

    if (outcome.kind === 'cancel') {
      submitSeqRef.current++;
      setLastStatus('error');
      setFormSession(null);
      setInput('');
      setIsDragOver(false);
      appendEntry({
        promptLabel,
        command: rawValue.trim() || 'c',
        output: outcome.output,
        status: 'error',
        durationLabel,
        timestamp: nowLabel,
      });
      return;
    }

    if (outcome.kind === 'submit') {
      setLastStatus('ok');
      setFormSession(outcome.session);
      setInput('');
      appendEntry({
        promptLabel,
        command: rawValue.trim() || 'y',
        output: outcome.output,
        status: 'ok',
        durationLabel,
        timestamp: nowLabel,
      });
      if (activeFormConfig) {
        void runFormSubmission(outcome.session, activeFormConfig, startMs);
      }
      return;
    }

    setLastStatus(outcome.status);
    setFormSession(outcome.session);
    setInput(outcome.nextInput);
    appendEntry({
      promptLabel,
      command: rawValue.trim().length > 0 ? rawValue : '(enter)',
      output: outcome.output,
      status: outcome.status,
      durationLabel,
      timestamp: nowLabel,
    });
  };

  const handleAttachFile = useCallback(
    (file: File) => {
      if (!formSession || formSession.phase === 'submitting') {
        return;
      }

      const nowLabel = formatTerminalClock(new Date());
      const promptLabel = getFormPromptBadge(formSession);
      const wasOnFileStep = getActiveFormStep(formSession)?.field.fieldType === 'file';
      const outcome = attachFileToTerminalForm(formSession, file);

      setLastStatus(outcome.status);
      setLastDuration('1ms');
      setFormSession(outcome.session);
      if (wasOnFileStep) {
        setInput(outcome.nextInput);
      }

      appendEntry({
        promptLabel,
        command: `attach ${file.name}`,
        output: outcome.output,
        status: outcome.status,
        durationLabel: '1ms',
        timestamp: nowLabel,
      });
    },
    [appendEntry, formSession],
  );

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (file) {
      handleAttachFile(file);
    }
    focusActiveInput();
  };

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const executeCommand = (rawInput: string) => {
    const trimmed = rawInput.trim();
    const nowLabel = formatTerminalClock(new Date());

    if (!trimmed) {
      return;
    }

    const startMs = typeof performance !== 'undefined' ? performance.now() : 0;
    const parts = trimmed.split(/\s+/);
    const cmdName = (parts[0] ?? '').toLowerCase();
    const args = parts.slice(1);
    const formConfig = terminalForms?.[cmdName];

    if (formConfig) {
      const outcome = startTerminalFormSession(formConfig.definition, trimmed);
      const elapsedMs =
        typeof performance !== 'undefined'
          ? Math.max(1, Math.round(performance.now() - startMs))
          : 1;
      const durationLabel = `${elapsedMs}ms`;

      const nextHistory = [...trimCommandHistory([trimmed, ...cmdHistory], maxCommandHistory)];
      setHasLocalCommand(true);
      setCmdHistory(nextHistory);
      onCommandHistoryChange?.(nextHistory);
      setHistoryCursor(-1);
      setLastDuration(durationLabel);

      if (outcome.kind === 'output') {
        setLastStatus(outcome.status);
        setInput('');
        appendEntry({
          command: trimmed,
          output: outcome.output,
          status: outcome.status,
          durationLabel,
          timestamp: nowLabel,
        });
        return;
      }

      if (outcome.kind === 'open-tui') {
        setLastStatus('ok');
        setInput('');
        appendEntry({
          command: trimmed,
          output: outcome.output,
          status: 'ok',
          durationLabel,
          timestamp: nowLabel,
        });
        formConfig.openTuiRoute?.(outcome.navTarget);
        return;
      }

      if (outcome.kind === 'submit-immediately') {
        setLastStatus('ok');
        setFormSession(outcome.session);
        setInput('');
        appendEntry({
          command: trimmed,
          output: outcome.output,
          status: 'ok',
          durationLabel,
          timestamp: nowLabel,
        });
        void runFormSubmission(outcome.session, formConfig, startMs);
        return;
      }

      setLastStatus(outcome.status);
      setFormSession(outcome.session);
      setInput(outcome.initialInput);
      appendEntry({
        command: trimmed,
        output: outcome.output,
        status: outcome.status,
        durationLabel,
        timestamp: nowLabel,
      });
      return;
    }

    const handler = commands[cmdName];

    let result: ZshCommandResult;
    if (handler) {
      result = handler(args, trimmed);
    } else {
      result = {
        status: 'error',
        output: `command not found: ${cmdName}\nType "help" to list available commands.`,
      };
    }

    const elapsedMs =
      typeof performance !== 'undefined' ? Math.max(1, Math.round(performance.now() - startMs)) : 1;
    const durationLabel = `${elapsedMs}ms`;
    const status = result.status ?? 'ok';

    const nextHistory = [...trimCommandHistory([trimmed, ...cmdHistory], maxCommandHistory)];
    setHasLocalCommand(true);
    setCmdHistory(nextHistory);
    onCommandHistoryChange?.(nextHistory);
    setHistoryCursor(-1);
    setLastStatus(status);
    setLastDuration(durationLabel);
    setInput('');

    if (result.clear) {
      setEntries([]);
      return;
    }

    appendEntry({
      command: trimmed,
      output: result.output,
      status,
      durationLabel,
      timestamp: nowLabel,
    });
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (formSession) {
      submitFormInput(input);
      return;
    }
    executeCommand(input);
  };

  const navigateHistoryOlder = () => {
    if (cmdHistory.length === 0) return;
    const nextCursor = Math.min(historyCursor + 1, cmdHistory.length - 1);
    setHistoryCursor(nextCursor);
    setInput(cmdHistory[nextCursor] ?? '');
  };

  const navigateHistoryNewer = () => {
    if (historyCursor <= 0) {
      setHistoryCursor(-1);
      setInput('');
    } else {
      const nextCursor = historyCursor - 1;
      setHistoryCursor(nextCursor);
      setInput(cmdHistory[nextCursor] ?? '');
    }
  };

  const readlineRegistry = useContext(TerminalReadlineRegistryContext);

  const hasActiveTextSelection = (selStart: number, selEnd: number): boolean => {
    if (selStart !== selEnd) {
      return true;
    }
    const docSelection =
      typeof window !== 'undefined' ? (window.getSelection()?.toString() ?? '') : '';
    return docSelection.length > 0;
  };

  const applyReadlineAction = (
    action: TerminalReadlineAction,
    targetEl?: HTMLInputElement | HTMLTextAreaElement | null,
  ) => {
    if (action === 'clear') {
      setEntries([]);
      if (!isSubmittingForm) {
        focusActiveInput();
      }
      return;
    }

    if (formSession !== null || isSubmittingForm) {
      return;
    }

    const el = targetEl ?? (isTextareaStep ? textareaRef.current : inputRef.current);
    const selStart = el?.selectionStart ?? input.length;
    const selEnd = el?.selectionEnd ?? input.length;

    switch (action) {
      case 'kill-to-start':
        setInput(input.slice(selStart));
        if (el) {
          scheduleCaret(el, 0);
        }
        focusActiveInput();
        return;
      case 'kill-to-end':
        setInput(input.slice(0, selStart));
        if (el) {
          scheduleCaret(el, selStart);
        }
        focusActiveInput();
        return;
      case 'delete-word-back': {
        const before = input.slice(0, selStart).replace(/\S+\s*$/, '');
        const after = input.slice(selEnd);
        setInput(`${before}${after}`);
        if (el) {
          scheduleCaret(el, before.length);
        }
        focusActiveInput();
        return;
      }
      case 'history-prev':
        navigateHistoryOlder();
        focusActiveInput();
        return;
      case 'history-next':
        navigateHistoryNewer();
        focusActiveInput();
        return;
    }
  };

  const handleTerminalSectionRef = (node: HTMLElement | null) => {
    if (!node || !readlineRegistry) {
      return;
    }
    const handle: ZshTerminalHandle = {
      executeReadlineAction: action => {
        applyReadlineAction(action);
      },
      containsTarget: target => target instanceof Node && node.contains(target),
    };
    return readlineRegistry.registerHandle(readlineRegistry.paneId, handle);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const keyLower = event.key.toLowerCase();
    const isCtrlOnly = event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey;
    const selStart = el.selectionStart ?? input.length;
    const selEnd = el.selectionEnd ?? input.length;

    if (formSession !== null) {
      if (isCtrlOnly && keyLower === 'l') {
        event.preventDefault();
        applyReadlineAction('clear', el);
        return;
      }
      if (isCtrlOnly && keyLower === 'c') {
        if (hasActiveTextSelection(selStart, selEnd)) {
          return;
        }
        event.preventDefault();
        submitSeqRef.current++;
        const nowLabel = formatTerminalClock(new Date());
        appendEntry({
          promptLabel: getFormPromptBadge(formSession),
          command: `${input}^C`,
          output: 'Transmission cancelled.',
          status: 'error',
          durationLabel: '0ms',
          timestamp: nowLabel,
        });
        setFormSession(null);
        setInput('');
        setLastStatus('error');
        setIsDragOver(false);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      if (
        isTextareaStep &&
        event.key === 'Enter' &&
        !event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        submitFormInput(input);
      }
      return;
    }

    const readlineAction = matchTerminalReadlineShortcut(event);
    if (readlineAction) {
      event.preventDefault();
      applyReadlineAction(readlineAction, el);
      return;
    }

    if (isCtrlOnly) {
      switch (keyLower) {
        case 'c': {
          if (hasActiveTextSelection(selStart, selEnd)) {
            return;
          }
          event.preventDefault();
          const nowLabel = formatTerminalClock(new Date());
          if (input.length > 0) {
            appendEntry({
              command: `${input}^C`,
              output: '',
              status: 'error',
              durationLabel: '0ms',
              timestamp: nowLabel,
            });
            setLastStatus('error');
          }
          setInput('');
          setHistoryCursor(-1);
          return;
        }
        case 'a':
          event.preventDefault();
          el.setSelectionRange(0, 0);
          return;
        case 'e':
          event.preventDefault();
          if (suggestion && selStart === input.length && selEnd === input.length) {
            const completed = `${input}${suggestion}`;
            setInput(completed);
            scheduleCaret(el, completed.length);
          } else {
            el.setSelectionRange(input.length, input.length);
          }
          return;
      }
    }

    if (event.key === 'Escape') {
      if (input.length > 0) {
        event.preventDefault();
        setInput('');
        setHistoryCursor(-1);
        return;
      }
      if (onEscape) {
        event.preventDefault();
        onEscape();
      }
      return;
    }

    if (event.key === 'Tab' && suggestion) {
      event.preventDefault();
      setInput(prev => `${prev}${suggestion}`);
      return;
    }
    if (
      event.key === 'ArrowRight' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      suggestion &&
      selStart === input.length &&
      selEnd === input.length
    ) {
      event.preventDefault();
      setInput(prev => `${prev}${suggestion}`);
      return;
    }
    if (
      event.key === 'ArrowUp' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      cmdHistory.length > 0
    ) {
      event.preventDefault();
      navigateHistoryOlder();
      return;
    }
    if (event.key === 'ArrowDown' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      navigateHistoryNewer();
    }
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!formSession || isSubmittingForm) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!formSession || isSubmittingForm) {
      return;
    }
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!formSession || isSubmittingForm) {
      return;
    }
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleAttachFile(file);
    }
  };

  const handleSurfacePointerDown = () => {
    onFocusPane?.();
  };

  const handleSurfacePointerUp = (event: PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea')) {
      return;
    }
    const selection = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (selection) {
      return;
    }
    focusActiveInput();
  };

  const runQuickCommand = (cmd: string) => {
    if (formSession !== null) {
      return;
    }
    onFocusPane?.();
    executeCommand(cmd);
    focusActiveInput();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drag-and-drop dropzone on terminal landmark; keyboard parity via attach button
    <section
      ref={handleTerminalSectionRef}
      className={styles.terminal}
      data-terminal-root='true'
      data-hydrated={isHydrated ? 'true' : 'false'}
      data-variant={variant}
      data-active={isActive ? 'true' : 'false'}
      data-form-mode={formSession ? formSession.definition.cliCommand : undefined}
      data-drag-over={showDragOver ? 'true' : 'false'}
      aria-label={ariaLabel}
      onPointerDown={handleSurfacePointerDown}
      onPointerUp={handleSurfacePointerUp}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type='file'
        className={styles.hiddenFileInput}
        accept={formFileAccept}
        tabIndex={-1}
        aria-hidden='true'
        onChange={handleFileInputChange}
      />

      {shouldShowBanner ? (
        <>
          <div className={styles.banner}>
            <span className={styles.bannerBrand}>
              <SolarForgeEmblem size={18} />
              <span>{bannerTitle}</span>
            </span>
            <div className={styles.bannerRight}>
              <span>{bannerMeta}</span>
              {bannerActions}
            </div>
          </div>

          <Separator.Root className={styles.divider} />
        </>
      ) : null}

      <ScrollArea.Root className={styles.historyRoot}>
        <ScrollArea.Viewport
          ref={scrollRef}
          className={styles.historyViewport}
          role='log'
          aria-live='polite'
        >
          <ScrollArea.Content className={styles.history}>
            {entries.map(entry => {
              const showCompanion = entry.id === 'init-0' && Boolean(initialEntryCompanion);
              return (
                <div key={entry.id} className={styles.entry}>
                  <div className={styles.promptBlock}>
                    <PromptHeader
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
                      {entry.promptLabel ? (
                        <span className={styles.formBadge}>{entry.promptLabel}</span>
                      ) : null}
                      <span className={styles.promptChar} data-status={entry.status}>
                        ❯
                      </span>
                      <span className={styles.commandEcho}>{entry.command}</span>
                      <span className={styles.frame}>─╯</span>
                    </div>
                  </div>
                  {showCompanion ? (
                    <div className={styles.entryBodyWithCompanion} data-terminal-companion='true'>
                      {entry.output ? (
                        <pre className={styles.output} data-status={entry.status}>
                          {entry.output}
                        </pre>
                      ) : null}
                      <div className={styles.entryCompanion} aria-live='off'>
                        {initialEntryCompanion}
                      </div>
                    </div>
                  ) : entry.output ? (
                    <pre className={styles.output} data-status={entry.status}>
                      {entry.output}
                    </pre>
                  ) : null}
                </div>
              );
            })}

            <Form.Root className={styles.promptBlock} onSubmit={handleSubmit}>
              <PromptHeader
                osLabel={osLabel}
                directory={directory}
                vcsBranch={vcsBranch}
                vcsState={vcsState}
                status={lastStatus}
                durationLabel={lastDuration}
                contextLabel={contextLabel}
                timestamp={clock}
              />
              <div
                className={styles.promptBottom}
                data-multiline={isTextareaStep ? 'true' : 'false'}
              >
                <span className={styles.frame}>╰─</span>
                {activePromptBadge ? (
                  <span className={styles.formBadge} data-phase={formSession?.phase}>
                    {activePromptBadge}
                  </span>
                ) : null}
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
                  {isTextareaStep ? (
                    <textarea
                      ref={textareaRef}
                      rows={textareaRows}
                      className={styles.textarea}
                      value={input}
                      disabled={isSubmittingForm}
                      onChange={event => setInput(event.target.value)}
                      onFocus={() => {
                        setInputFocused(true);
                        onFocusPane?.();
                      }}
                      onBlur={() => setInputFocused(false)}
                      onKeyDown={handleKeyDown}
                      placeholder={activePlaceholder}
                      aria-label={inputLabel}
                      data-terminal-input='true'
                      data-form-field={activeFormStep?.field.name}
                      autoComplete='off'
                      autoCorrect='off'
                      autoCapitalize='off'
                      spellCheck={false}
                    />
                  ) : (
                    <Input.Root
                      ref={inputRef}
                      type='text'
                      className={styles.input}
                      value={input}
                      disabled={isSubmittingForm}
                      onChange={event => setInput(event.target.value)}
                      onFocus={() => {
                        setInputFocused(true);
                        onFocusPane?.();
                      }}
                      onBlur={() => setInputFocused(false)}
                      onKeyDown={handleKeyDown}
                      placeholder={activePlaceholder}
                      aria-label={inputLabel}
                      data-terminal-input='true'
                      data-form-field={activeFormStep?.field.name}
                      autoComplete='off'
                      autoCorrect='off'
                      autoCapitalize='off'
                      spellCheck={false}
                    />
                  )}
                  {isFileStep && !isSubmittingForm ? (
                    <Button.Root
                      type='button'
                      size='xs'
                      className={styles.inlineAction}
                      onClick={handleOpenFilePicker}
                    >
                      <Button.Label>[attach file]</Button.Label>
                    </Button.Root>
                  ) : null}
                </div>
                <span className={styles.frame}>─╯</span>
              </div>
            </Form.Root>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation='vertical'>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>

      <TerminalAccessoryBar
        visible={isMobile && inputFocused}
        quickCommands={isFormActive ? [] : quickCommands}
        onAction={(action: TerminalAccessoryAction) => {
          dispatchTerminalAccessoryAction(
            action,
            isTextareaStep ? textareaRef.current : inputRef.current,
            runQuickCommand,
          );
        }}
      />

      {quickCommands.length > 0 ? (
        <>
          <Separator.Root className={styles.divider} />
          <Toolbar.Root className={styles.quickBar} aria-label='Quick terminal commands'>
            <span>run:</span>
            <Toolbar.Group className={styles.quickGroup}>
              {quickCommands.map(cmd => (
                <Button.Root
                  key={cmd}
                  type='button'
                  size='xs'
                  className={styles.quickChip}
                  disabled={isFormActive}
                  onClick={() => runQuickCommand(cmd)}
                >
                  <Button.Label>{cmd}</Button.Label>
                </Button.Root>
              ))}
            </Toolbar.Group>
          </Toolbar.Root>
        </>
      ) : null}
    </section>
  );
}
