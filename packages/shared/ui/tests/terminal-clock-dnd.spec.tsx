import { CONTACT_FORM_DEFINITION, type ContactActionResult } from '@aklapper/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ZshP10kTerminal } from '../src';
import {
  formatTerminalClock,
  getTerminalClockSnapshot,
  subscribeTerminalClock,
} from '../src/components/terminalClockStore';

function renderTerminalProps(
  submit: (fd: FormData) => Promise<ContactActionResult> = () =>
    Promise.resolve({
      ok: true,
      submission: {
        id: 'sub-1',
        name: 'Ada',
        email: 'ada@example.com',
        phone: null,
        attachmentName: null,
        attachmentSizeBytes: null,
        attachmentSha256: null,
        createdAt: '2026-06-01T14:30:00.000Z',
      },
    }),
) {
  return {
    directory: '~/andrew-k.us',
    vcsBranch: 'main',
    contextLabel: 'visitor@andrew-k.us',
    initialTime: '00:00:00',
    commands: {
      help: () => ({ output: 'help text' }),
    },
    terminalForms: {
      contact: {
        definition: CONTACT_FORM_DEFINITION,
        submit,
      },
    },
  };
}

describe('ZshP10kTerminal external clock store and JSX drag-and-drop', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hydrates SSR initialTime without mismatch, shares one interval across mounted terminals, and stops on last unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 1, 14, 30, 0));

    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const props = renderTerminalProps();
    const ssrHtml = renderToString(<ZshP10kTerminal {...props} />);
    expect(ssrHtml).toContain('00:00:00');
    expect(setIntervalSpy).not.toHaveBeenCalled();

    const container = document.createElement('div');
    document.body.appendChild(container);
    container.innerHTML = ssrHtml;

    let root: ReturnType<typeof hydrateRoot> | null = null;
    act(() => {
      root = hydrateRoot(container, <ZshP10kTerminal {...props} />);
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(container.textContent).toContain('14:30:00');
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    const second = render(<ZshP10kTerminal {...props} />);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    expect(container.textContent).toContain('14:30:01');
    expect(second.container.textContent).toContain('14:30:01');
    expect(getTerminalClockSnapshot()).toBe(formatTerminalClock(new Date(2026, 5, 1, 14, 30, 1)));

    const unsubProbe = subscribeTerminalClock(() => undefined);
    unsubProbe();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    second.unmount();
    expect(clearIntervalSpy).not.toHaveBeenCalled();

    act(() => {
      root?.unmount();
    });
    container.remove();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('attaches dropped files during an active form session without child dragleave flicker', () => {
    const props = renderTerminalProps();
    const { container } = render(<ZshP10kTerminal {...props} />);

    const section = container.querySelector('section') as HTMLElement;
    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'contact' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(section.getAttribute('data-form-mode')).toBe('contact');

    const dataTransfer = { dropEffect: 'none' };
    fireEvent.dragOver(section, { dataTransfer });
    expect(section.getAttribute('data-drag-over')).toBe('true');
    expect(dataTransfer.dropEffect).toBe('copy');

    fireEvent(
      section,
      new MouseEvent('dragleave', { bubbles: true, cancelable: true, relatedTarget: input }),
    );
    expect(section.getAttribute('data-drag-over')).toBe('true');

    fireEvent(
      section,
      new MouseEvent('dragleave', {
        bubbles: true,
        cancelable: true,
        relatedTarget: document.body,
      }),
    );
    expect(section.getAttribute('data-drag-over')).toBe('false');

    fireEvent.dragOver(section, { dataTransfer });
    expect(section.getAttribute('data-drag-over')).toBe('true');

    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.drop(section, { dataTransfer: { files: [file] } });
    expect(section.getAttribute('data-drag-over')).toBe('false');
    expect(screen.getByText(/attached notes\.txt/i)).toBeTruthy();
  });

  it('ignores drag-and-drop when no form session is active or submission is in flight', () => {
    const pendingSubmit = Promise.withResolvers<ContactActionResult>();
    const submit = vi.fn<(fd: FormData) => Promise<ContactActionResult>>(
      () => pendingSubmit.promise,
    );
    const props = renderTerminalProps(submit);
    const { container } = render(<ZshP10kTerminal {...props} />);

    const section = container.querySelector('section') as HTMLElement;
    const file = new File(['hello'], 'ignored.txt', { type: 'text/plain' });

    fireEvent.dragOver(section, { dataTransfer: { dropEffect: 'none' } });
    expect(section.getAttribute('data-drag-over')).toBe('false');
    fireEvent.drop(section, { dataTransfer: { files: [file] } });
    expect(screen.queryByText(/attached ignored\.txt/i)).toBeNull();

    const input = screen.getByLabelText('Terminal command input') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        value:
          'contact --name "Ada" --email "ada@example.com" --message "Submitting in flight test."',
      },
    });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(submit).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(section, { dataTransfer: { dropEffect: 'none' } });
    expect(section.getAttribute('data-drag-over')).toBe('false');
    fireEvent.drop(section, { dataTransfer: { files: [file] } });
    expect(section.getAttribute('data-drag-over')).toBe('false');
    expect(screen.queryByText(/attached ignored\.txt/i)).toBeNull();
  });
});
