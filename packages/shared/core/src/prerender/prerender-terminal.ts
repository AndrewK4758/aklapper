import {
  formatTerminalDirectoryListing,
  type TerminalProfileData,
  TerminalProfileDataSchema,
} from '../terminal.ts';
import {
  PORTAL_HOME_DIRECTORY_LISTING,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_PROFILE_SLUGS,
} from './prerender-terminal-commands.ts';

export {
  PORTAL_HOME_DIRECTORY_LISTING,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_PROFILE_SLUGS,
};

export const TERMINAL_PROFILE_SEEDS = [
  {
    slug: TERMINAL_PROFILE_SLUGS.portalHome,
    bannerTitle: 'Solar Forge Terminal // tty1',
    bannerMeta:
      'tty1 · type "about", "tui", "cadence", "chat", "agensi", or "contact" · Tab autocomplete',
    osLabel: '⚡',
    directory: '~/projects/aklapper',
    vcsBranch: 'portfolio_v2',
    vcsState: 'clean' as const,
    contextLabel: 'guest@andrew-k.us',
    placeholder: 'type a command (help, ls, about, tui, cadence, chat, agensi, contact, cd ...)',
    quickCommands: [
      'help',
      'ls',
      'about',
      'tui',
      'cadence',
      'chat',
      'agensi',
      'contact',
      'status',
      'clear',
    ],
  },
  {
    slug: TERMINAL_PROFILE_SLUGS.adminOps,
    bannerTitle: 'Solar Forge Ops Terminal // admin',
    bannerMeta: 'ops tty · type "help" or press Tab',
    osLabel: '⚡',
    directory: '~/admin.andrew-k.us',
    vcsBranch: 'ops-isolated',
    vcsState: 'clean' as const,
    contextLabel: 'admin@andrew-k.us',
    placeholder: 'type an ops command (help, analytics, cms, inbox, quotas, ops, status, clear)',
    quickCommands: ['help', 'analytics', 'cms', 'inbox', 'quotas', 'ops', 'status'],
  },
] as const;

export const TERMINAL_INITIAL_ENTRY_SEEDS = [
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    command: 'ls',
    output: PORTAL_HOME_DIRECTORY_LISTING,
    status: 'ok' as const,
    durationLabel: '6ms',
    timestampLabel: '00:00:00',
    sortOrder: 0,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    command: 'status',
    output: 'admin.andrew-k.us :: isolated ops console ready · split panes enabled.',
    status: 'ok' as const,
    durationLabel: '3ms',
    timestampLabel: '00:00:00',
    sortOrder: 0,
  },
] as const;

export function resolveTerminalLsOutput(
  commandName: string,
  fallbackOutput: string,
  directoryListing: string | null,
): string {
  if (directoryListing !== null && commandName.trim() === 'ls') {
    return directoryListing;
  }
  return fallbackOutput;
}

export function buildSeedTerminalProfile(slug: string): TerminalProfileData {
  const profile = TERMINAL_PROFILE_SEEDS.find(item => item.slug === slug);
  if (!profile) {
    throw new Error(`Missing seed terminal profile: slug="${slug}"`);
  }

  const directoryEntries = TERMINAL_DIRECTORY_ENTRY_SEEDS.filter(
    entry => entry.profileSlug === slug && entry.enabled,
  ).toSorted((a, b) => a.sortOrder - b.sortOrder);
  const directoryListing =
    directoryEntries.length > 0 ? formatTerminalDirectoryListing(directoryEntries) : null;

  return TerminalProfileDataSchema.parse({
    slug: profile.slug,
    bannerTitle: profile.bannerTitle,
    bannerMeta: profile.bannerMeta,
    osLabel: profile.osLabel,
    directory: profile.directory,
    vcsBranch: profile.vcsBranch,
    vcsState: profile.vcsState,
    contextLabel: profile.contextLabel,
    placeholder: profile.placeholder,
    quickCommands: [...profile.quickCommands],
    initialEntries: TERMINAL_INITIAL_ENTRY_SEEDS.filter(entry => entry.profileSlug === slug)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(entry => ({
        command: entry.command,
        output: resolveTerminalLsOutput(entry.command, entry.output, directoryListing),
        status: entry.status,
        durationLabel: entry.durationLabel,
        timestamp: entry.timestampLabel,
        sortOrder: entry.sortOrder,
      })),
    commands: TERMINAL_COMMAND_SEEDS.filter(cmd => cmd.profileSlug === slug)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        kind: cmd.kind,
        output: resolveTerminalLsOutput(cmd.name, cmd.output, directoryListing),
        targetRoute: cmd.targetRoute,
        allowedRoutes: [...cmd.allowedRoutes],
        errorTemplate: cmd.errorTemplate,
        sortOrder: cmd.sortOrder,
      })),
  });
}
