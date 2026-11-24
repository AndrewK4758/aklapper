import { z } from 'zod';

export const TerminalVcsStateSchema = z.enum(['clean', 'modified', 'untracked']);
export type TerminalVcsState = z.infer<typeof TerminalVcsStateSchema>;

export const TerminalEntryStatusSchema = z.enum(['ok', 'error']);
export type TerminalEntryStatus = z.infer<typeof TerminalEntryStatusSchema>;

export const TerminalInitialEntrySchema = z.object({
  command: z.string().min(1),
  output: z.string(),
  status: TerminalEntryStatusSchema,
  durationLabel: z.string().min(1),
  timestamp: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type TerminalInitialEntry = z.infer<typeof TerminalInitialEntrySchema>;

export const TerminalCommandKindSchema = z.enum([
  'static',
  'navigate',
  'cd',
  'tui',
  'roadmap',
  'uptime',
  'clear',
]);
export type TerminalCommandKind = z.infer<typeof TerminalCommandKindSchema>;

export const TerminalCommandSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  kind: TerminalCommandKindSchema,
  output: z.string(),
  targetRoute: z.string().nullable(),
  allowedRoutes: z.array(z.string()),
  errorTemplate: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type TerminalCommandSpec = z.infer<typeof TerminalCommandSpecSchema>;

export const TerminalDirectoryEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type TerminalDirectoryEntry = z.infer<typeof TerminalDirectoryEntrySchema>;

export function formatTerminalDirectoryListing(
  entries: ReadonlyArray<Pick<TerminalDirectoryEntry, 'name' | 'description'>>,
): string {
  if (entries.length === 0) {
    return '';
  }
  const longestName = entries.reduce((max, entry) => Math.max(max, entry.name.length), 0);
  const padWidth = longestName + 3;
  return entries.map(entry => `${entry.name.padEnd(padWidth)}# ${entry.description}`).join('\n');
}

export const TerminalProfileDataSchema = z.object({
  slug: z.string().min(1),
  bannerTitle: z.string().min(1),
  bannerMeta: z.string().min(1),
  osLabel: z.string().min(1),
  directory: z.string().min(1),
  vcsBranch: z.string().min(1),
  vcsState: TerminalVcsStateSchema,
  contextLabel: z.string().min(1),
  placeholder: z.string().min(1),
  quickCommands: z.array(z.string()),
  initialEntries: z.array(TerminalInitialEntrySchema),
  commands: z.array(TerminalCommandSpecSchema),
});
export type TerminalProfileData = z.infer<typeof TerminalProfileDataSchema>;
