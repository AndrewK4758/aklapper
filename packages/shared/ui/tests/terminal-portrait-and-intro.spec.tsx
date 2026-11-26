import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  DEFAULT_PORTAL_HOME_PORTRAIT,
  DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
  type TerminalProfileData,
} from '@aklapper/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PortalHomeTerminalIntro,
  resetTerminalIntroBranchTelemetryForTest,
  TerminalWorkspace,
  ZshP10kTerminal,
} from '../src/index';
import {
  DEFAULT_PORTRAIT_HEIGHT,
  DEFAULT_PORTRAIT_PATH,
  DEFAULT_PORTRAIT_SRC,
  DEFAULT_PORTRAIT_WIDTH,
  TerminalPortrait,
} from '../src/terminal-portrait';

const SAMPLE_TERMINAL: TerminalProfileData = {
  slug: 'portal-home',
  bannerTitle: 'Solar Forge Terminal // tty1',
  bannerMeta: 'tty1',
  osLabel: '⚡',
  directory: '~/andrew-k.us',
  vcsBranch: 'main',
  vcsState: 'clean',
  contextLabel: 'guest@andrew-k.us',
  placeholder: 'type a command',
  quickCommands: ['ls', 'tui', 'clear'],
  initialEntries: [
    {
      command: 'ls',
      output: 'tui       # TUI version\ncadence   # Agentic workflow example',
      status: 'ok',
      durationLabel: '8ms',
      timestamp: '09:00:00',
      sortOrder: 0,
    },
  ],
  commands: [
    {
      name: 'ls',
      description: 'list sections',
      kind: 'static',
      output: 'tui       # TUI version\ncadence   # Agentic workflow example',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'whoami',
      description: 'print active identity',
      kind: 'static',
      output: 'guest@andrew-k.us (tty1)',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'clear',
      description: 'clear scrollback',
      kind: 'clear',
      output: '',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
  ],
};

afterEach(() => {
  resetTerminalIntroBranchTelemetryForTest();
});

describe('@aklapper/ui TerminalPortrait, PortalHomeTerminalIntro, and terminal companion slot', () => {
  it('bundles a valid <45 KB greyscale WebP portrait asset via @aklapper/ui/terminal-portrait', () => {
    const assetPath = resolve(import.meta.dirname, '../src/assets/andrew-klapper-portrait.webp');
    expect(existsSync(assetPath)).toBe(true);
    const bytes = readFileSync(assetPath);
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('ascii')).toBe('WEBP');
    expect(statSync(assetPath).size).toBeLessThan(45 * 1024);

    expect(DEFAULT_PORTRAIT_PATH).toBe('/images/andrew-klapper-portrait.webp');
    expect(DEFAULT_PORTRAIT_WIDTH).toBe(440);
    expect(DEFAULT_PORTRAIT_HEIGHT).toBe(520);
    expect(DEFAULT_PORTRAIT_SRC.length).toBeGreaterThan(0);
  });

  it('renders terminal and profile variants with intrinsic dimensions and resolves default path to bundled asset', () => {
    const { container, rerender } = render(
      <TerminalPortrait
        src={DEFAULT_PORTRAIT_PATH}
        alt='Greyscale terminal portrait of Andrew Klapper'
        width={440}
        height={520}
        caption='andrew@andrew-k.us :: tty1'
        ttyLabel='tty1'
        variant='terminal'
        priority
      />,
    );

    const figure = container.querySelector('[data-terminal-portrait="true"]');
    expect(figure?.getAttribute('data-variant')).toBe('terminal');
    expect(figure?.getAttribute('data-size')).toBe('md');
    const img = screen.getByRole('img', {
      name: 'Greyscale terminal portrait of Andrew Klapper',
    }) as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(DEFAULT_PORTRAIT_SRC);
    expect(img.getAttribute('width')).toBe('440');
    expect(img.getAttribute('height')).toBe('520');
    expect(img.getAttribute('decoding')).toBe('async');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(screen.getByText('andrew@andrew-k.us :: tty1')).toBeTruthy();
    expect(screen.getByText('tty1')).toBeTruthy();

    rerender(
      <TerminalPortrait
        src='/images/custom-override.webp'
        alt='Editorial profile portrait'
        variant='profile'
        size='lg'
      />,
    );
    expect(figure?.getAttribute('data-variant')).toBe('profile');
    expect(figure?.getAttribute('data-size')).toBe('lg');
    const overrideImg = screen.getByRole('img', { name: 'Editorial profile portrait' });
    expect(overrideImg.getAttribute('src')).toBe('/images/custom-override.webp');
    expect(overrideImg.getAttribute('loading')).toBe('lazy');
  });

  it('degrades to AK monogram fallback on image error with BOUNDARY_FAULT log and recovers purely on src change', () => {
    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    try {
      const { container, rerender } = render(
        <TerminalPortrait
          src='/images/missing-portrait.webp'
          alt='Greyscale terminal portrait of Andrew Klapper'
        />,
      );

      const brokenImg = container.querySelector('img');
      expect(brokenImg).not.toBeNull();
      fireEvent.error(brokenImg!);

      expect(container.querySelector('img')).toBeNull();
      const fallback = container.querySelector('[data-portrait-fallback="true"]');
      expect(fallback).not.toBeNull();
      expect(fallback?.getAttribute('role')).toBe('img');
      expect(fallback?.textContent).toContain('AK');
      expect(warnLogs.join('\n')).toContain('portal.home.portrait_load_fallback');
      expect(warnLogs.join('\n')).toContain('BOUNDARY_FAULT');

      rerender(
        <TerminalPortrait
          src='   '
          alt='Greyscale terminal portrait of Andrew Klapper'
        />,
      );
      expect(container.querySelector('[data-portrait-fallback="true"]')).toBeNull();
      expect(container.querySelector('img')?.getAttribute('src')).toBe(DEFAULT_PORTRAIT_SRC);

      rerender(
        <TerminalPortrait
          src={`  ${DEFAULT_PORTRAIT_PATH}  `}
          alt='Greyscale terminal portrait of Andrew Klapper'
        />,
      );
      expect(container.querySelector('[data-portrait-fallback="true"]')).toBeNull();
      expect(container.querySelector('img')?.getAttribute('src')).toBe(DEFAULT_PORTRAIT_SRC);

      // Hostile external or WHATWG-whitespace-obfuscated custom src fails closed to monogram fallback
      for (const hostileSrc of [
        'https://evil.example.invalid/tracker.webp',
        '/\t/attacker.example/pixel.webp',
      ]) {
        rerender(
          <TerminalPortrait
            src={hostileSrc}
            alt='Greyscale terminal portrait of Andrew Klapper'
          />,
        );
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('[data-portrait-fallback="true"]')).not.toBeNull();
      }
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('renders PortalHomeTerminalIntro with public links, highlights, non-linking services guidance, aria-live off, and zero forms', () => {
    const { container } = render(
      <PortalHomeTerminalIntro
        portrait={DEFAULT_PORTAL_HOME_PORTRAIT}
        resumeSummary={DEFAULT_PORTAL_HOME_RESUME_SUMMARY}
        priorityPortrait
      />,
    );

    const section = container.querySelector('[data-portal-home-intro="true"]');
    expect(section?.getAttribute('aria-live')).toBe('off');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('a[href="/about"]')).toBeNull();

    expect(screen.getByText('Senior Full-Stack & Systems Engineer · Marietta, GA')).toBeTruthy();

    const emailLink = screen.getByRole('link', { name: 'andrew@andrew-k.us' });
    expect(emailLink.getAttribute('href')).toBe('mailto:andrew@andrew-k.us');

    const githubLink = screen.getByRole('link', { name: 'github.com/AndrewK4758' });
    expect(githubLink.getAttribute('href')).toBe('https://github.com/AndrewK4758');
    expect(githubLink.getAttribute('target')).toBe('_blank');
    expect(githubLink.getAttribute('rel')).toBe('noopener noreferrer');

    for (const token of [
      'Build Technology Group',
      'Gitasy',
      'CADENCE',
      'Ghostty Union',
      'Gemma 4 fine-tuning',
      'Woodstock Developers Group',
    ]) {
      expect(container.textContent).toContain(token);
    }
    for (const cmd of ['cadence', 'chat', 'agensi', 'about', 'contact']) {
      expect(screen.getByText(cmd, { selector: 'code' })).toBeTruthy();
    }
  });

  it('renders companion inside init-0 before active prompt, preserves scrollTop 0 on mount, clears on clear/Ctrl+L, and emits branch telemetry', () => {
    const debugLogs: string[] = [];
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation((msg: unknown) => {
      debugLogs.push(String(msg));
    });
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus');

    try {
      const { container } = render(
        <ZshP10kTerminal
          directory='~/andrew-k.us'
          vcsBranch='main'
          contextLabel='guest@andrew-k.us'
          ariaLabel='Interactive Terminal tty1'
          focusOnMount
          isActive
          initialEntries={SAMPLE_TERMINAL.initialEntries}
          initialEntryCompanion={
            <PortalHomeTerminalIntro
              portrait={DEFAULT_PORTAL_HOME_PORTRAIT}
              resumeSummary={DEFAULT_PORTAL_HOME_RESUME_SUMMARY}
              priorityPortrait
            />
          }
          commands={{
            ls: () => ({ output: 'tui       # TUI version' }),
            whoami: () => ({ output: 'guest@andrew-k.us (tty1)' }),
            clear: () => ({ output: '', clear: true }),
          }}
        />,
      );

      // Focus called with preventScroll on initial mount
      expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

      // Companion appears strictly inside init-0 before active Form.Root
      const companion = container.querySelector('[data-terminal-companion="true"]') as HTMLElement;
      const activeForm = container.querySelector('form') as HTMLElement;
      expect(companion).not.toBeNull();
      expect(activeForm).not.toBeNull();
      expect(
        companion.compareDocumentPosition(activeForm) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // Scroll viewport stays at scrollTop 0 on initial mount
      const viewport = container.querySelector('[role="log"]') as HTMLElement;
      Object.defineProperty(viewport, 'scrollHeight', { value: 1200, configurable: true });
      expect(viewport.scrollTop).toBe(0);

      // Clicking a link inside companion does not steal focus back to input
      const emailLink = screen.getByRole('link', { name: 'andrew@andrew-k.us' });
      focusSpy.mockClear();
      fireEvent.pointerUp(emailLink);
      expect(focusSpy).not.toHaveBeenCalled();

      // Branch telemetry recorded tty1-with-companion
      expect(debugLogs.join('\n')).toContain('portal.home.terminal_intro_mount_branch');
      expect(debugLogs.join('\n')).toContain('"branch":"tty1-with-companion"');

      // Submitting a command scrolls viewport to scrollHeight
      const input = screen.getByLabelText('Terminal command input');
      fireEvent.change(input, { target: { value: 'whoami' } });
      fireEvent.submit(activeForm);
      expect(viewport.scrollTop).toBe(1200);
      expect(screen.getByText('guest@andrew-k.us (tty1)')).toBeTruthy();

      // Running clear dismisses init-0 and companion, emitting companion-cleared
      fireEvent.change(input, { target: { value: 'clear' } });
      fireEvent.submit(activeForm);
      expect(container.querySelector('[data-terminal-companion="true"]')).toBeNull();
      expect(debugLogs.join('\n')).toContain('"branch":"companion-cleared"');

      // Subsequent ls outputs plain listing without re-injecting companion
      fireEvent.change(input, { target: { value: 'ls' } });
      fireEvent.submit(activeForm);
      expect(container.querySelector('[data-terminal-companion="true"]')).toBeNull();
      expect(screen.getByText(/tui\s+# TUI version/)).toBeTruthy();
    } finally {
      debugSpy.mockRestore();
      focusSpy.mockRestore();
    }
  });

  it('scopes initialEntryCompanion strictly to tty1 and omits it from tty2 splits in TerminalWorkspace', () => {
    const debugLogs: string[] = [];
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation((msg: unknown) => {
      debugLogs.push(String(msg));
    });

    try {
      const { container } = render(
        <TerminalWorkspace
          terminal={SAMPLE_TERMINAL}
          initialEntryCompanion={
            <PortalHomeTerminalIntro
              portrait={DEFAULT_PORTAL_HOME_PORTRAIT}
              resumeSummary={DEFAULT_PORTAL_HOME_RESUME_SUMMARY}
            />
          }
        />,
      );

      expect(container.querySelectorAll('[data-terminal-companion="true"]')).toHaveLength(1);
      const tty1 = container.querySelector('[data-pane-tty="tty1"]') as HTMLElement;
      expect(tty1.querySelector('[data-terminal-companion="true"]')).not.toBeNull();

      // Split right creates tty2 with zero companion
      fireEvent.keyDown(window, {
        key: '}',
        code: 'BracketRight',
        ctrlKey: true,
        shiftKey: true,
      });

      const tty2 = container.querySelector('[data-pane-tty="tty2"]') as HTMLElement;
      expect(tty2).not.toBeNull();
      expect(tty2.querySelector('[data-terminal-companion="true"]')).toBeNull();
      expect(container.querySelectorAll('[data-terminal-companion="true"]')).toHaveLength(1);

      expect(debugLogs.join('\n')).toContain('"branch":"tty1-with-companion"');
      expect(debugLogs.join('\n')).toContain('"branch":"tty-without-companion"');
    } finally {
      debugSpy.mockRestore();
    }
  });
});
