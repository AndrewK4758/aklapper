import {
  type ContactActionResult,
  type ContactSubmissionSummary,
  type FlattenedFormStep,
  flattenFormSteps,
  formatCliFormHelp,
  type FormDefinition,
  type FormFieldsetHeader,
  parseCliFormInvocation,
  validateFormValues,
  validateFormField,
} from '@aklapper/core';

import { parseCliNavFlags, type TerminalNavTarget } from './terminalPaneNav';

export interface TerminalFormConfig {
  readonly definition: FormDefinition;
  readonly submit: (formData: FormData) => Promise<ContactActionResult>;
  readonly openTuiRoute?: (target?: TerminalNavTarget) => void;
}

export interface TerminalFormSessionState {
  readonly definition: FormDefinition;
  readonly steps: readonly FlattenedFormStep[];
  readonly queue: readonly number[];
  readonly queuePos: number;
  readonly phase: 'prompt' | 'review' | 'submitting';
  readonly textValues: Readonly<Record<string, string>>;
  readonly files: Readonly<Record<string, File | null>>;
  readonly announcedFieldsets: readonly string[];
}

export function formatTerminalBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function formatFieldsetHeaderLines(headers: readonly FormFieldsetHeader[]): string[] {
  const lines: string[] = [];
  for (const header of headers) {
    const indent = '  '.repeat(header.depth);
    const glyph = header.depth === 0 ? '┌─' : '├─';
    lines.push(`${indent}${glyph} ${header.legend}`);
    if (header.description) {
      lines.push(`${indent}│  ${header.description}`);
    }
  }
  return lines;
}

export function getActiveFormStep(session: TerminalFormSessionState): FlattenedFormStep | null {
  if (session.phase !== 'prompt') return null;
  const stepIndex = session.queue[session.queuePos];
  if (stepIndex === undefined) return null;
  return session.steps[stepIndex] ?? null;
}

export function getFormPromptBadge(session: TerminalFormSessionState): string {
  const cmd = session.definition.cliCommand;
  if (session.phase === 'submitting') {
    return `${cmd} :: transmitting`;
  }
  if (session.phase === 'review') {
    return `${cmd} :: review [y/e/c]`;
  }
  const step = getActiveFormStep(session);
  if (!step) return cmd;
  const req = step.field.required ? 'req' : 'opt';
  return `${cmd} [${step.index + 1}/${step.total}] ${step.field.name} (${req})`;
}

export function getFormPromptPlaceholder(session: TerminalFormSessionState): string {
  if (session.phase === 'submitting') {
    return 'submitting to PostgreSQL 19 ...';
  }
  if (session.phase === 'review') {
    return 'y to send · e <field> to edit · c to cancel';
  }
  const step = getActiveFormStep(session);
  if (!step) return '';
  if (step.field.fieldType === 'file') {
    const existing = session.files[step.field.name];
    return existing
      ? `Enter to keep ${existing.name} · "attach" to replace · "clear" to remove`
      : 'type "attach" (or "a"), drag & drop file, or Enter to skip';
  }
  if (step.field.fieldType === 'textarea') {
    return `${step.field.placeholder ?? 'Type message'} (Shift+Enter newline · Enter submit)`;
  }
  const optionalHint = step.field.required ? '' : ' (optional · Enter to skip)';
  return `${step.field.placeholder ?? step.field.label}${optionalHint}`;
}

export function formatStepPromptOutput(session: TerminalFormSessionState): {
  text: string;
  nextAnnounced: string[];
} {
  const step = getActiveFormStep(session);
  if (!step) return { text: '', nextAnnounced: [...session.announcedFieldsets] };

  const announced = new Set(session.announcedFieldsets);
  const newHeaders: FormFieldsetHeader[] = [];
  for (const header of step.enteredFieldsets) {
    if (!announced.has(header.id)) {
      announced.add(header.id);
      newHeaders.push(header);
    }
  }

  const lines = formatFieldsetHeaderLines(newHeaders);
  const reqTag = step.field.required ? '[required]' : '[optional]';
  const flag = step.field.cliFlag ?? `--${step.field.name}`;
  lines.push(`Step ${step.index + 1}/${step.total}: ${step.field.label} (${flag}) ${reqTag}`);
  if (step.field.description) {
    lines.push(`  ${step.field.description}`);
  }
  if (step.field.fieldType === 'file') {
    const attached = session.files[step.field.name];
    if (attached) {
      lines.push(
        `  Current attachment: ▸ ${attached.name} (${formatTerminalBytes(attached.size)})`,
      );
      lines.push('  Press Enter to keep, "attach" to replace, or "clear" to remove.');
    } else {
      lines.push(
        '  Type "attach" (or "a") to open file picker, drag & drop onto pane, or press Enter to skip.',
      );
    }
  } else if (step.field.fieldType === 'textarea') {
    lines.push('  Shift+Enter for newline · Enter to submit · :back for previous field');
  } else if (!step.field.required) {
    lines.push('  Press Enter to skip · :back for previous field');
  }

  return { text: lines.join('\n'), nextAnnounced: Array.from(announced) };
}

export function formatReviewSummary(session: TerminalFormSessionState): string {
  const lines: string[] = ['┌─ Review Transmission // Ready for PostgreSQL 19'];

  for (const { field } of session.steps) {
    if (field.fieldType === 'file') {
      const file = session.files[field.name];
      const display = file ? `${file.name} (${formatTerminalBytes(file.size)})` : '(none)';
      lines.push(`│  ${field.label.padEnd(10)} ${display}`);
    } else {
      const raw = (session.textValues[field.name] ?? '').trim();
      const display = raw
        ? raw.includes('\n')
          ? `\n│    ${raw.split('\n').join('\n│    ')}`
          : raw
        : '(skipped)';
      lines.push(`│  ${field.label.padEnd(10)} ${display}`);
    }
  }

  lines.push('└─ Confirm: [y] send · [e <field>] edit (e.g. "e email") · [c] cancel');
  return lines.join('\n');
}

export function formatReceiptOutput(submission: ContactSubmissionSummary): string {
  const lines: string[] = [
    '✓ TRANSMISSION COMMITTED // POSTGRES 19 (201 Created)',
    `  Receipt ID : ${submission.id}`,
    `  Sender     : ${submission.name} <${submission.email}>`,
  ];
  if (submission.phone) {
    lines.push(`  Phone      : ${submission.phone}`);
  }
  if (submission.attachmentName) {
    const sizeText =
      submission.attachmentSizeBytes !== null
        ? formatTerminalBytes(submission.attachmentSizeBytes)
        : '0 B';
    const shaPrefix = submission.attachmentSha256?.slice(0, 12) ?? '';
    lines.push(`  Attachment : ${submission.attachmentName} (${sizeText} · sha256:${shaPrefix}…)`);
  }
  lines.push(`  Committed  : ${submission.createdAt}`);
  return lines.join('\n');
}

export function buildSessionFormData(session: TerminalFormSessionState): FormData {
  const formData = new FormData();
  for (const { field } of session.steps) {
    if (field.fieldType === 'file') {
      const file = session.files[field.name];
      if (file) {
        formData.set(field.name, file);
      }
    } else {
      formData.set(field.name, session.textValues[field.name] ?? '');
    }
  }
  return formData;
}

function buildValidationValueMap(
  session: TerminalFormSessionState,
): Record<string, string | { name: string; size: number; type: string } | null> {
  const values: Record<string, string | { name: string; size: number; type: string } | null> = {};
  for (const { field } of session.steps) {
    if (field.fieldType === 'file') {
      const file = session.files[field.name];
      values[field.name] = file ? { name: file.name, size: file.size, type: file.type } : null;
    } else {
      values[field.name] = session.textValues[field.name] ?? '';
    }
  }
  return values;
}

export type StartTerminalFormOutcome =
  | { readonly kind: 'output'; readonly output: string; readonly status: 'ok' | 'error' }
  | {
      readonly kind: 'open-tui';
      readonly output: string;
      readonly navTarget: TerminalNavTarget;
    }
  | {
      readonly kind: 'submit-immediately';
      readonly session: TerminalFormSessionState;
      readonly output: string;
    }
  | {
      readonly kind: 'interactive';
      readonly session: TerminalFormSessionState;
      readonly output: string;
      readonly status: 'ok' | 'error';
      readonly initialInput: string;
    };

export function startTerminalFormSession(
  definition: FormDefinition,
  rawCommand: string,
): StartTerminalFormOutcome {
  const tokens = rawCommand.trim().split(/\s+/);
  const hasTuiFlag = tokens.includes('--tui');
  const navFlags = hasTuiFlag
    ? parseCliNavFlags(tokens.slice(1))
    : { target: 'in-pane' as const, positional: tokens.slice(1) };
  const sanitizedCommand = hasTuiFlag ? [tokens[0] ?? '', ...navFlags.positional].join(' ') : rawCommand;
  const parsed = parseCliFormInvocation(definition, sanitizedCommand);

  if (parsed.help) {
    return { kind: 'output', output: formatCliFormHelp(definition), status: 'ok' };
  }
  if (parsed.openTui) {
    return { kind: 'open-tui', output: 'opening /contact TUI ...', navTarget: navFlags.target };
  }
  if (parsed.unknownTokens.length > 0) {
    return {
      kind: 'output',
      status: 'error',
      output: `${definition.cliCommand}: unknown option(s): ${parsed.unknownTokens.join(', ')}\nRun "${definition.cliCommand} --help" for usage.`,
    };
  }

  const steps = flattenFormSteps(definition);
  const textValues: Record<string, string> = {};
  const files: Record<string, File | null> = {};
  const providedNames = Object.keys(parsed.providedFields);
  const invalidProvided = new Set<string>();
  const flagErrors: string[] = [];

  for (const step of steps) {
    if (step.field.fieldType === 'file') {
      files[step.field.name] = null;
      continue;
    }
    const provided = parsed.providedFields[step.field.name];
    if (provided !== undefined) {
      textValues[step.field.name] = provided;
      const errors = validateFormField(step.field, provided);
      if (errors.length > 0) {
        invalidProvided.add(step.field.name);
        flagErrors.push(`✖ ${step.field.label}: ${errors[0]}`);
      }
    } else {
      textValues[step.field.name] = '';
    }
  }

  const baseSession: TerminalFormSessionState = {
    definition,
    steps,
    queue: [],
    queuePos: 0,
    phase: 'prompt',
    textValues,
    files,
    announcedFieldsets: [],
  };

  // One-shot fast path: user passed flags, all provided flags are valid, no --file picker requested,
  // and all required fields pass client validation.
  if (providedNames.length > 0 && !parsed.requestedFilePicker && invalidProvided.size === 0) {
    const validation = validateFormValues(definition, buildValidationValueMap(baseSession));
    if (validation.valid) {
      return {
        kind: 'submit-immediately',
        session: { ...baseSession, phase: 'submitting' },
        output: 'Transmitting contact payload to PostgreSQL 19 ...',
      };
    }
  }

  // Interactive mode: prompt all fields when no flags given, or only remaining/invalid fields when partial flags given.
  const queue: number[] = [];
  for (const step of steps) {
    const wasProvided = parsed.providedFields[step.field.name] !== undefined;
    const isFileRequested = step.field.fieldType === 'file' && parsed.requestedFilePicker;
    if (providedNames.length === 0) {
      queue.push(step.index);
    } else if (!wasProvided || invalidProvided.has(step.field.name) || isFileRequested) {
      queue.push(step.index);
    }
  }

  const initialSession: TerminalFormSessionState = {
    ...baseSession,
    queue,
    queuePos: 0,
    phase: queue.length > 0 ? 'prompt' : 'review',
  };

  const introLines: string[] = [`${definition.title} (terminal mode · Ctrl+C to cancel)`];
  if (parsed.requestedFilePicker) {
    introLines.push(
      'Note: browsers cannot read disk paths from CLI flags — attach your file at the File step or drag & drop it onto this pane.',
    );
  }
  if (flagErrors.length > 0) {
    introLines.push(...flagErrors);
  }

  const { text: stepText, nextAnnounced } = formatStepPromptOutput(initialSession);
  if (stepText) {
    introLines.push('', stepText);
  }

  const firstStep = getActiveFormStep(initialSession);
  const initialInput =
    firstStep && firstStep.field.fieldType !== 'file'
      ? (initialSession.textValues[firstStep.field.name] ?? '')
      : '';

  return {
    kind: 'interactive',
    session: { ...initialSession, announcedFieldsets: nextAnnounced },
    output: introLines.join('\n'),
    status: flagErrors.length > 0 ? 'error' : 'ok',
    initialInput,
  };
}

export type StepInputOutcome =
  | {
      readonly kind: 'continue';
      readonly session: TerminalFormSessionState;
      readonly output: string;
      readonly status: 'ok' | 'error';
      readonly nextInput: string;
    }
  | {
      readonly kind: 'open-file-picker';
      readonly session: TerminalFormSessionState;
      readonly output: string;
    }
  | {
      readonly kind: 'submit';
      readonly session: TerminalFormSessionState;
      readonly output: string;
    }
  | {
      readonly kind: 'cancel';
      readonly output: string;
    };

function advanceAfterField(
  session: TerminalFormSessionState,
  confirmLine: string,
): StepInputOutcome {
  const nextPos = session.queuePos + 1;
  if (nextPos < session.queue.length) {
    const nextSession: TerminalFormSessionState = { ...session, queuePos: nextPos };
    const { text, nextAnnounced } = formatStepPromptOutput(nextSession);
    const nextStep = getActiveFormStep(nextSession);
    const nextInput =
      nextStep && nextStep.field.fieldType !== 'file'
        ? (nextSession.textValues[nextStep.field.name] ?? '')
        : '';
    return {
      kind: 'continue',
      session: { ...nextSession, announcedFieldsets: nextAnnounced },
      output: `${confirmLine}\n\n${text}`,
      status: 'ok',
      nextInput,
    };
  }

  const reviewSession: TerminalFormSessionState = { ...session, phase: 'review' };
  return {
    kind: 'continue',
    session: reviewSession,
    output: `${confirmLine}\n\n${formatReviewSummary(reviewSession)}`,
    status: 'ok',
    nextInput: '',
  };
}

export function processTerminalFormInput(
  session: TerminalFormSessionState,
  rawInput: string,
): StepInputOutcome {
  const trimmed = rawInput.trim();
  const lower = trimmed.toLowerCase();

  if (session.phase === 'review') {
    if (lower === '' || lower === 'y' || lower === 'yes' || lower === 'send') {
      return {
        kind: 'submit',
        session: { ...session, phase: 'submitting' },
        output: 'Transmitting contact payload to PostgreSQL 19 ...',
      };
    }
    if (lower === 'c' || lower === 'cancel' || lower === 'n' || lower === 'no') {
      return { kind: 'cancel', output: 'Transmission cancelled.' };
    }
    if (lower === ':back' || lower === 'back') {
      const lastIndex = Math.max(0, session.steps.length - 1);
      const backSession: TerminalFormSessionState = {
        ...session,
        queue: [lastIndex],
        queuePos: 0,
        phase: 'prompt',
      };
      const { text, nextAnnounced } = formatStepPromptOutput(backSession);
      const targetStep = getActiveFormStep(backSession);
      const nextInput =
        targetStep && targetStep.field.fieldType !== 'file'
          ? (backSession.textValues[targetStep.field.name] ?? '')
          : '';
      return {
        kind: 'continue',
        session: { ...backSession, announcedFieldsets: nextAnnounced },
        output: text,
        status: 'ok',
        nextInput,
      };
    }

    const editMatch = /^(?:e|edit)\s+(.+)$/i.exec(trimmed);
    if (editMatch) {
      const query = (editMatch[1] ?? '').trim().toLowerCase().replace(/^--/, '');
      const matched = session.steps.find(
        s => s.field.name.toLowerCase() === query || s.field.label.toLowerCase() === query,
      );
      if (!matched) {
        const names = session.steps.map(s => s.field.name).join(', ');
        return {
          kind: 'continue',
          session,
          output: `✖ Unknown field "${query}". Editable fields: ${names}`,
          status: 'error',
          nextInput: '',
        };
      }
      const editSession: TerminalFormSessionState = {
        ...session,
        queue: [matched.index],
        queuePos: 0,
        phase: 'prompt',
      };
      const { text, nextAnnounced } = formatStepPromptOutput(editSession);
      const nextInput =
        matched.field.fieldType !== 'file'
          ? (editSession.textValues[matched.field.name] ?? '')
          : '';
      return {
        kind: 'continue',
        session: { ...editSession, announcedFieldsets: nextAnnounced },
        output: text,
        status: 'ok',
        nextInput,
      };
    }

    return {
      kind: 'continue',
      session,
      output: 'Enter "y" to send, "e <field>" to edit (e.g. "e email"), or "c" to cancel.',
      status: 'error',
      nextInput: '',
    };
  }

  const step = getActiveFormStep(session);
  if (!step) {
    return { kind: 'cancel', output: 'Transmission session ended.' };
  }

  if (lower === ':back') {
    if (session.queuePos === 0) {
      return {
        kind: 'continue',
        session,
        output: 'Already at the first field (press Ctrl+C to cancel).',
        status: 'error',
        nextInput:
          step.field.fieldType !== 'file' ? (session.textValues[step.field.name] ?? '') : '',
      };
    }
    const prevSession: TerminalFormSessionState = { ...session, queuePos: session.queuePos - 1 };
    const prevStep = getActiveFormStep(prevSession);
    const { text, nextAnnounced } = formatStepPromptOutput(prevSession);
    const nextInput =
      prevStep && prevStep.field.fieldType !== 'file'
        ? (prevSession.textValues[prevStep.field.name] ?? '')
        : '';
    return {
      kind: 'continue',
      session: { ...prevSession, announcedFieldsets: nextAnnounced },
      output: `↩ Back to ${prevStep?.field.label ?? 'previous field'}\n${text}`,
      status: 'ok',
      nextInput,
    };
  }

  if (step.field.fieldType === 'file') {
    if (lower === 'a' || lower === 'attach') {
      return {
        kind: 'open-file-picker',
        session,
        output: 'Opening file picker ...',
      };
    }
    if (lower === 'clear' || lower === 'remove') {
      const clearedSession: TerminalFormSessionState = {
        ...session,
        files: { ...session.files, [step.field.name]: null },
      };
      return {
        kind: 'continue',
        session: clearedSession,
        output: 'Cleared attached file. Type "attach" to pick another or press Enter to skip.',
        status: 'ok',
        nextInput: '',
      };
    }
    if (trimmed === '') {
      const existing = session.files[step.field.name] ?? null;
      const errors = validateFormField(
        step.field,
        existing ? { name: existing.name, size: existing.size, type: existing.type } : null,
      );
      if (errors.length > 0) {
        return {
          kind: 'continue',
          session,
          output: `✖ ${errors[0]}`,
          status: 'error',
          nextInput: '',
        };
      }
      const confirmLine = existing
        ? `✓ ${step.field.label}: ${existing.name} (${formatTerminalBytes(existing.size)})`
        : `· ${step.field.label}: (skipped)`;
      return advanceAfterField(session, confirmLine);
    }

    return {
      kind: 'continue',
      session,
      output:
        'Type "attach" (or "a") to pick a file, "clear" to remove, drag & drop onto pane, or press Enter to continue.',
      status: 'error',
      nextInput: '',
    };
  }

  const errors = validateFormField(step.field, rawInput);
  if (errors.length > 0) {
    return {
      kind: 'continue',
      session,
      output: `✖ ${errors[0]}`,
      status: 'error',
      nextInput: rawInput,
    };
  }

  const normalized = trimmed;
  const updatedSession: TerminalFormSessionState = {
    ...session,
    textValues: { ...session.textValues, [step.field.name]: normalized },
  };
  const confirmLine = normalized
    ? `✓ ${step.field.label}: ${normalized}`
    : `· ${step.field.label}: (skipped)`;
  return advanceAfterField(updatedSession, confirmLine);
}

export function attachFileToTerminalForm(
  session: TerminalFormSessionState,
  file: File,
): {
  readonly session: TerminalFormSessionState;
  readonly output: string;
  readonly status: 'ok' | 'error';
  readonly nextInput: string;
} {
  const fileStep = session.steps.find(s => s.field.fieldType === 'file');
  if (!fileStep) {
    return {
      session,
      output: '✖ Active form does not accept file attachments.',
      status: 'error',
      nextInput: '',
    };
  }

  const errors = validateFormField(fileStep.field, {
    name: file.name,
    size: file.size,
    type: file.type,
  });
  if (errors.length > 0) {
    return {
      session,
      output: `✖ ${fileStep.field.label}: ${errors[0]}`,
      status: 'error',
      nextInput: '',
    };
  }

  const updatedSession: TerminalFormSessionState = {
    ...session,
    files: { ...session.files, [fileStep.field.name]: file },
  };
  const attachLine = `▸ attached ${file.name} (${formatTerminalBytes(file.size)})`;

  // If currently on the file step, automatically advance to the next step / review summary.
  const activeStep = getActiveFormStep(updatedSession);
  if (activeStep && activeStep.field.name === fileStep.field.name) {
    const advanced = advanceAfterField(updatedSession, attachLine);
    if (advanced.kind === 'continue') {
      return {
        session: advanced.session,
        output: advanced.output,
        status: advanced.status,
        nextInput: advanced.nextInput,
      };
    }
  }

  return {
    session: updatedSession,
    output: attachLine,
    status: 'ok',
    nextInput: '',
  };
}

export function resolveTerminalFormSubmitResult(
  session: TerminalFormSessionState,
  result: ContactActionResult,
): {
  readonly session: TerminalFormSessionState | null;
  readonly output: string;
  readonly status: 'ok' | 'error';
  readonly nextInput: string;
} {
  if (result.ok) {
    return {
      session: null,
      output: formatReceiptOutput(result.submission),
      status: 'ok',
      nextInput: '',
    };
  }

  const lines: string[] = [`[${result.source}] ${result.formError}`];
  const failingIndices: number[] = [];

  for (const [fieldName, messages] of Object.entries(result.fieldErrors)) {
    const firstMsg = messages[0];
    if (firstMsg) {
      lines.push(`✖ ${fieldName}: ${firstMsg}`);
    }
    const matched = session.steps.find(s => s.field.name === fieldName);
    if (matched && !failingIndices.includes(matched.index)) {
      failingIndices.push(matched.index);
    }
  }

  if (failingIndices.length > 0) {
    const recoverySession: TerminalFormSessionState = {
      ...session,
      queue: failingIndices,
      queuePos: 0,
      phase: 'prompt',
    };
    const { text, nextAnnounced } = formatStepPromptOutput(recoverySession);
    const firstStep = getActiveFormStep(recoverySession);
    const nextInput =
      firstStep && firstStep.field.fieldType !== 'file'
        ? (recoverySession.textValues[firstStep.field.name] ?? '')
        : '';
    return {
      session: { ...recoverySession, announcedFieldsets: nextAnnounced },
      output: `${lines.join('\n')}\n\nRe-enter the rejected field(s) — all other answers are preserved:\n${text}`,
      status: 'error',
      nextInput,
    };
  }

  const reviewSession: TerminalFormSessionState = { ...session, phase: 'review' };
  return {
    session: reviewSession,
    output: `${lines.join('\n')}\n\n${formatReviewSummary(reviewSession)}`,
    status: 'error',
    nextInput: '',
  };
}
