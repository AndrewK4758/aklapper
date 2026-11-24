import type {
  RoadmapMilestone,
  RoadmapMilestoneStatus,
  TerminalCommandSpec,
} from '@aklapper/contracts';

import type { ZshCommandHandler } from './ZshP10kTerminal';

export interface ZshCommandRuntime {
  navigate?: (to: string) => void | Promise<void>;
  openTui?: () => void;
  milestones?: readonly RoadmapMilestone[];
  getUptimeSeconds?: () => number;
}

export function formatRoadmapMarker(status: RoadmapMilestoneStatus): string {
  switch (status) {
    case 'done':
      return '[x]';
    case 'active':
      return '[~]';
    case 'queued':
      return '[ ]';
  }
}

export function formatRoadmapMilestones(milestones: readonly RoadmapMilestone[]): string {
  return milestones
    .map(milestone => `${formatRoadmapMarker(milestone.status)} ${milestone.label}`)
    .join('\n');
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
        handlers[spec.name] = () => {
          if (spec.targetRoute && runtime.navigate) {
            void runtime.navigate(spec.targetRoute);
          }
          return { output: spec.output };
        };
        break;
      case 'tui':
        handlers[spec.name] = () => {
          runtime.openTui?.();
          return { output: spec.output };
        };
        break;
      case 'cd':
        handlers[spec.name] = args => {
          const target = (args[0] ?? '').replace(/^\/+|\/+$/g, '');
          if (target && spec.allowedRoutes.includes(target)) {
            if (runtime.navigate) {
              void runtime.navigate(`/${target}`);
            }
            return { output: spec.output.replace('{{target}}', target) };
          }
          const rawInput = args[0] ?? '(empty)';
          const errorOutput = (spec.errorTemplate ?? 'cd: no such route: {{input}}').replace(
            '{{input}}',
            rawInput,
          );
          return { status: 'error', output: errorOutput };
        };
        break;
      case 'roadmap':
        handlers[spec.name] = () => ({
          output: runtime.milestones ? formatRoadmapMilestones(runtime.milestones) : spec.output,
        });
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
