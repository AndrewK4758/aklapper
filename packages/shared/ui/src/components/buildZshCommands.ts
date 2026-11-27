import type { TerminalCommandSpec } from '@aklapper/core';

import { parseCliNavFlags, type TerminalNavTarget } from './terminalPaneNav';
import type { ZshCommandHandler } from './ZshP10kTerminal';

export interface ZshCommandRuntime {
  navigate?: (to: string) => void | Promise<void>;
  navigateView?: (to: string, target: TerminalNavTarget) => void | Promise<void>;
  openTui?: (target?: TerminalNavTarget) => void;
  getUptimeSeconds?: () => number;
}

export function buildZshCommandHandlers(
  commands: readonly TerminalCommandSpec[],
  runtime: ZshCommandRuntime = {},
): Readonly<Record<string, ZshCommandHandler>> {
  const handlers: Record<string, ZshCommandHandler> = {};

  for (const spec of commands) {
    switch (spec.kind) {
      case 'static':
        handlers[spec.name] = () => ({ output: spec.output });
        break;
      case 'navigate':
        handlers[spec.name] = args => {
          const { target } = parseCliNavFlags(args);
          if (spec.targetRoute) {
            if (runtime.navigateView) {
              void runtime.navigateView(spec.targetRoute, target);
            } else if (runtime.navigate) {
              void runtime.navigate(spec.targetRoute);
            }
          }
          return { output: spec.output };
        };
        break;
      case 'tui':
        handlers[spec.name] = args => {
          const { target } = parseCliNavFlags(args);
          if (target === 'in-pane') {
            runtime.openTui?.();
          } else {
            runtime.openTui?.(target);
          }
          return { output: spec.output };
        };
        break;
      case 'cd':
        handlers[spec.name] = args => {
          const { target: navTarget, positional } = parseCliNavFlags(args);
          const rawArg = positional[0] ?? '';
          const target = rawArg.replace(/^\/+|\/+$/g, '');
          if (target && spec.allowedRoutes.includes(target)) {
            if (runtime.navigateView) {
              void runtime.navigateView(`/${target}`, navTarget);
            } else if (runtime.navigate) {
              void runtime.navigate(`/${target}`);
            }
            return { output: spec.output.replace('{{target}}', target) };
          }
          const rawInput = positional[0] ?? '(empty)';
          const errorOutput = (spec.errorTemplate ?? 'cd: no such route: {{input}}').replace(
            '{{input}}',
            rawInput,
          );
          return { status: 'error', output: errorOutput };
        };
        break;
      case 'roadmap':
        handlers[spec.name] = () => ({ output: spec.output });
        break;
      case 'uptime':
        handlers[spec.name] = () => {
          const seconds = runtime.getUptimeSeconds ? runtime.getUptimeSeconds() : 0;
          return { output: spec.output.replace('{{seconds}}', String(seconds)) };
        };
        break;
      case 'clear':
        handlers[spec.name] = () => ({ output: '', clear: true });
        break;
    }
  }

  return handlers;
}
