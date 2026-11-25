import {
  ADMIN_CHROME_SHORTCUT_HINT,
  type AdminAnalyticsContent,
  type AdminChromeContent,
  type AdminHomeContent,
  buildSplitHelpLines,
  buildTailoredCadenceArtifactHtml,
  CONTACT_FORM_DEFINITION,
  formatTerminalDirectoryListing,
  type MenuItem,
  PORTAL_CHROME_SHORTCUT_HINT,
  PORTAL_READLINE_HELP_LINES,
  type PortalAgensiContent,
  type PortalCadenceContent,
  type PortalChromeContent,
  type PortalContactContent,
  type PortalHomeContent,
  type PortalMaintenanceContent,
  type PortalMenuContent,
  type TerminalProfileData,
  TerminalProfileDataSchema,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import { type AppDatabase, createDb, createDbPool } from './client.ts';
import { resolveTerminalLsOutput, SITE_CONTENT_KEYS, TERMINAL_PROFILE_SLUGS } from './queries.ts';
import {
  agensiSkills,
  cadencePresets,
  careerDossiers,
  menuItems,
  quotaPolicies,
  roadmapMilestones,
  siteContent,
  terminalCommands,
  terminalDirectoryEntries,
  terminalInitialEntries,
  terminalProfiles,
} from './schema.ts';
import { seedAdminUserFromEnv, type SeedAdminUserResult } from './seed-admin.ts';
import { CAREER_DOSSIER_SEEDS, PORTAL_ASK_SEED } from './seed-dossiers.ts';

export const DEFAULT_MENU_ITEMS: readonly MenuItem[] = [
  {
    slug: 'cadence',
    keyShortcut: '1',
    title: 'CADENCE Builder',
    description:
      'Prompt-to-artifact showcase backed by live GKE scale-from-zero pods and Qdrant recall',
    targetK8sDeploy: 'svc-cadence-demo',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 1,
    enabled: true,
  },
  {
    slug: 'ask',
    keyShortcut: '2',
    title: 'Ask Portfolio / JD Match',
    description: 'Grounded Qdrant RAG dossier search with strict abstention',
    targetK8sDeploy: 'svc-ai-ask',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 2,
    enabled: true,
  },
  {
    slug: 'agensi',
    keyShortcut: '3',
    title: 'Agensi Storefront',
    description:
      'Published commercial skills and CADENCE marketplace catalog at agensi.io/creators/aklapper',
    targetK8sDeploy: null,
    namespace: null,
    adminOnly: false,
    sortOrder: 3,
    enabled: true,
  },
  {
    slug: 'contact',
    keyShortcut: '4',
    title: 'Contact & Outreach',
    description: 'Direct message handler backed by scale-to-zero Go microservice',
    targetK8sDeploy: 'svc-contact',
    namespace: 'portfolio-public',
    adminOnly: false,
    sortOrder: 4,
    enabled: true,
  },
  {
    slug: 'admin-ops',
    keyShortcut: '9',
    title: 'Admin Telemetry & CADENCE Runner',
    description: 'Isolated cadence-admin namespace operations and first-party analytics',
    targetK8sDeploy: 'cadence-admin-runner',
    namespace: 'cadence-admin',
    adminOnly: true,
    sortOrder: 9,
    enabled: true,
  },
];

const STARTER_CADENCE_ARTIFACT_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><style>
:root{--a-bg:#121110;--a-fg:#e8e2d5;--a-accent:#ffd300;--a-pad:16px;--a-font:monospace}
body{margin:0;padding:var(--a-pad);background:var(--a-bg);color:var(--a-fg);font-family:var(--a-font),monospace}
strong{color:var(--a-accent)}
</style></head>
<body><strong>CADENCE Sandbox Ready</strong><p>Submit a prompt to spin up svc-cadence-demo on GKE.</p></body>
</html>`;

const STARTER_K8S_TELEMETRY_ARTIFACT_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><style>
:root{--a-bg:#121110;--a-panel:#1c1a17;--a-fg:#e8e2d5;--a-accent:#ffd300;--a-green:#22c55e;--a-pad:16px;--a-font:monospace}
body{margin:0;padding:var(--a-pad);background:var(--a-bg);color:var(--a-fg);font-family:var(--a-font),monospace}
.card{border:1px solid var(--a-accent);background:var(--a-panel);padding:12px}
.ok{color:var(--a-green)}
</style></head>
<body><div class="card"><strong>GKE Autopilot // portfolio-public</strong><p class="ok">svc-cadence-demo · scale-to-0 ready</p><p>Submit a prompt to synthesize a live telemetry widget.</p></div></body>
</html>`;

export const PORTAL_CHROME_SEED: PortalChromeContent = {
  pageTitle: 'andrew-k.us — Andrew Klapper',
  brandLabel: 'Andrew Klapper Portfolio',
  brandContactEmail: 'andrew@andrew-k.us',
  shortcutHint: PORTAL_CHROME_SHORTCUT_HINT,
  statusBadge: {
    source: 'gke-autopilot',
    state: 'idle',
    label: 'Idle (on-demand services)',
  },
  footerText: 'Andrew Klapper · Personal Portfolio',
  footerLinkLabel: 'agensi.io/creators/aklapper',
  footerLinkUrl: 'https://agensi.io/creators/aklapper',
  maintenanceModeDefault: false,
};

const PORTAL_HOME_SEED: PortalHomeContent = {
  tuiTitle: 'Portfolio Launcher',
  tuiBadge: {
    source: 'gke-autopilot',
    state: 'idle',
    label: 'Idle (on-demand services)',
  },
  heading: 'Andrew Klapper — Portfolio',
  description:
    'Explore interactive demos, ask questions about my work and experience, browse published Agensi skills, or send a direct message. Use the launcher below or the terminal above to navigate.',
  actions: [
    { label: 'Open Menu → /menu', to: '/menu', variant: 'primary' },
    { label: 'CADENCE Builder → /cadence', to: '/cadence', variant: 'default' },
    { label: 'Ask Portfolio → /ask', to: '/ask', variant: 'default' },
    { label: 'Agensi Storefront → /agensi', to: '/agensi', variant: 'default' },
    { label: 'Contact → /contact', to: '/contact', variant: 'default' },
    {
      label: 'Maintenance Preview → /changes-in-progress',
      to: '/changes-in-progress',
      variant: 'default',
    },
  ],
};

const PORTAL_MENU_SEED: PortalMenuContent = {
  heading: 'Module Menu',
  description:
    'Select a section below to open it. On-demand services start only when you run an interactive workflow.',
  localTargetLabel: 'local',
};

const PORTAL_AGENSI_SEED: PortalAgensiContent = {
  windowTitle: 'Agensi Storefront — Published Skills',
  statusBadge: {
    source: 'agensi-catalog',
    state: 'ready',
    label: 'Catalog live',
  },
  description:
    'Published AI agent skills, engineering workflows, and operational blueprints available on agensi.io/creators/aklapper.',
  searchPlaceholder: 'Filter skills by name, summary, or tag...',
  emptyStateLabel: 'No skills match the current search or tag filters.',
  outboundCtaLabel: 'View on Agensi →',
};

const PORTAL_CADENCE_SEED: PortalCadenceContent = {
  windowTitle: 'CADENCE Builder — Artifact Sandbox',
  statusBadge: {
    source: 'svc-cadence-demo',
    state: 'idle',
    label: 'On-demand',
  },
  description:
    'Quota-gated prompt builder that generates and previews sandboxed artifacts on demand.',
  iframeTitle: 'CADENCE Artifact Preview',
};

const PORTAL_CONTACT_SEED: PortalContactContent = {
  windowTitle: 'Contact — Send a Message',
  statusBadge: {
    source: 'postgres-19',
    state: 'ready',
    label: 'Ready',
  },
  description:
    'Send a direct message to Andrew Klapper. All fields are validated before submission.',
  form: CONTACT_FORM_DEFINITION,
};

const PORTAL_MAINTENANCE_SEED: PortalMaintenanceContent = {
  windowTitle: 'andrew-k.us — Maintenance',
  statusBadge: {
    source: 'site-maintenance',
    state: 'scaling',
    label: 'Maintenance in Progress',
  },
  heading: 'Site Updates in Progress',
  lead: 'andrew-k.us is currently being updated. Site navigation is temporarily unavailable while updates are deployed.',
  progressPercent: 72,
  progressAriaLabel: 'Site update progress',
  metaLeft: 'Status: Maintenance mode (navigation disabled)',
  metaRight: 'Progress: 72% · terminal available below',
};

const ADMIN_CHROME_SEED: AdminChromeContent = {
  pageTitle: 'admin.andrew-k.us — Admin Console',
  brandLabel: 'admin.andrew-k.us',
  shortcutHint: ADMIN_CHROME_SHORTCUT_HINT,
  statusBadge: {
    source: 'cadence-admin',
    state: 'gate',
    label: 'Passkey authentication required',
  },
};

const ADMIN_HOME_SEED: AdminHomeContent = {
  heading: 'Admin Operations Console',
  description:
    'Private operations console for managing site content, contact messages, usage quotas, visitor analytics, and background services.',
  actions: [{ label: 'Open Analytics', to: '/analytics', variant: 'primary' }],
};

const ADMIN_ANALYTICS_SEED: AdminAnalyticsContent = {
  windowTitle: 'First-Party Visitor Analytics',
  description: 'Overview of page views, web performance metrics, and outbound Agensi link clicks.',
};

const SITE_CONTENT_SEEDS: ReadonlyArray<{
  key: string;
  markdownBody: string;
  metadataJson: Record<string, unknown>;
}> = [
  {
    key: SITE_CONTENT_KEYS.portalChrome,
    markdownBody: 'Portal global shell chrome and maintenance default.',
    metadataJson: PORTAL_CHROME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalHome,
    markdownBody: 'Portal tty1 greeter TUI launcher content.',
    metadataJson: PORTAL_HOME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalMenu,
    markdownBody: 'Portal launch menu heading and copy.',
    metadataJson: PORTAL_MENU_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalAgensi,
    markdownBody: 'Portal Agensi commercial skills storefront copy and filter labels.',
    metadataJson: PORTAL_AGENSI_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalAsk,
    markdownBody: 'Portal Ask Portfolio grounded RAG Q&A and Job Description matcher copy.',
    metadataJson: PORTAL_ASK_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalCadence,
    markdownBody: 'Portal CADENCE sandbox builder header and copy.',
    metadataJson: PORTAL_CADENCE_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalContact,
    markdownBody: 'Portal contact form TUI content and recursive JSON schema.',
    metadataJson: PORTAL_CONTACT_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalMaintenance,
    markdownBody: 'Portal standalone changes-in-progress maintenance screen.',
    metadataJson: PORTAL_MAINTENANCE_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.adminChrome,
    markdownBody: 'Admin global shell chrome and passkey badge.',
    metadataJson: ADMIN_CHROME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.adminHome,
    markdownBody: 'Admin operations console overview copy.',
    metadataJson: ADMIN_HOME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.adminAnalytics,
    markdownBody: 'Admin first-party visitor analytics overview copy.',
    metadataJson: ADMIN_ANALYTICS_SEED,
  },
];

const TERMINAL_PROFILE_SEEDS = [
  {
    slug: TERMINAL_PROFILE_SLUGS.portalHome,
    bannerTitle: 'Solar Forge Terminal // tty1',
    bannerMeta: 'tty1 · type "menu", "ask", "agensi", "cadence", or "contact" · Tab autocomplete',
    osLabel: '⚡',
    directory: '~/projects/aklapper',
    vcsBranch: 'portfolio_v2',
    vcsState: 'clean' as const,
    contextLabel: 'guest@andrew-k.us',
    placeholder: 'type a command (help, ls, menu, ask, agensi, cadence, contact, cd ...)',
    quickCommands: [
      'help',
      'ls',
      'menu',
      'tui',
      'cadence',
      'ask',
      'agensi',
      'contact',
      'status',
      'clear',
    ],
  },
  {
    slug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    bannerTitle: 'Solar Forge Terminal // andrew-k.us (maintenance)',
    bannerMeta: 'tty1 · type "help" or press Tab',
    osLabel: '⚡',
    directory: '~/andrew-k.us',
    vcsBranch: 'portfolio_v2 !wip',
    vcsState: 'modified' as const,
    contextLabel: 'visitor@andrew-k.us',
    placeholder: 'type a command: help, status, roadmap, stack, clear',
    quickCommands: ['help', 'status', 'roadmap', 'stack', 'whoami', 'clear'],
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

const TERMINAL_DIRECTORY_ENTRY_SEEDS = [
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'menu',
    description: 'Site menu',
    sortOrder: 1,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'tui',
    description: 'TUI version',
    sortOrder: 2,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'cadence',
    description: 'Agentic workflow example',
    sortOrder: 3,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'ask',
    description: 'Ask about my work',
    sortOrder: 4,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'agensi',
    description: 'Published AI skills',
    sortOrder: 5,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'contact',
    description: 'Connect with me',
    sortOrder: 6,
    enabled: true,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'changes-in-progress',
    description: 'Maintenance preview',
    sortOrder: 7,
    enabled: true,
  },
] as const;

const PORTAL_HOME_DIRECTORY_LISTING = formatTerminalDirectoryListing(
  TERMINAL_DIRECTORY_ENTRY_SEEDS.filter(
    entry => entry.profileSlug === TERMINAL_PROFILE_SLUGS.portalHome && entry.enabled,
  ).toSorted((a, b) => a.sortOrder - b.sortOrder),
);

const TERMINAL_INITIAL_ENTRY_SEEDS = [
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
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    command: 'status',
    output: [
      'andrew-k.us :: Solar Forge v2 rebuild is actively underway.',
      'Navigation is temporarily offline while services migrate to Cloud Run + GKE Autopilot.',
      'Type "help" at the ❯ prompt below to inspect the rebuild status.',
    ].join('\n'),
    status: 'ok' as const,
    durationLabel: '8ms',
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

const TERMINAL_COMMAND_SEEDS = [
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'help',
    description: 'list available portal commands',
    kind: 'static' as const,
    output: [
      'Available terminal commands:',
      '  ls         — list portal routes & workspaces',
      '  menu       — open /menu module launcher',
      '  tui        — open TUI launcher in a split pane',
      '  cadence    — open /cadence artifact sandbox',
      '  ask        — open /ask grounded RAG & JD match',
      '  agensi     — open /agensi commercial skills storefront',
      '  contact    — run inline terminal contact form (or "contact --tui" / "--help")',
      '  cd <route> — navigate to /menu, /cadence, /ask, /agensi, /contact, or /changes-in-progress',
      '  status     — inspect cluster & service state',
      '  whoami     — display active terminal session',
      '  clear      — clear terminal scrollback',
      '',
      ...PORTAL_READLINE_HELP_LINES,
      ...buildSplitHelpLines({ includeTui: true }),
    ].join('\n'),
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 1,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'ls',
    description: 'list portal routes & workspaces',
    kind: 'static' as const,
    output: PORTAL_HOME_DIRECTORY_LISTING,
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 2,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'menu',
    description: 'open /menu module launcher',
    kind: 'navigate' as const,
    output: 'opening /menu ...',
    targetRoute: '/menu',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 3,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'tui',
    description: 'open TUI launcher in current pane (--split / --tab)',
    kind: 'tui' as const,
    output: 'opening TUI launcher ... (Esc back · q exit · --split / --tab)',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 4,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'cadence',
    description: 'open /cadence artifact sandbox',
    kind: 'navigate' as const,
    output: 'opening /cadence ...',
    targetRoute: '/cadence',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 5,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'ask',
    description: 'open /ask grounded RAG & JD match',
    kind: 'navigate' as const,
    output: 'opening /ask ...',
    targetRoute: '/ask',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 6,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'agensi',
    description: 'open /agensi published skills storefront',
    kind: 'navigate' as const,
    output: 'opening /agensi ...',
    targetRoute: '/agensi',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 7,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'contact',
    description: 'run inline terminal contact form (or "contact --tui" / "--help")',
    kind: 'navigate' as const,
    output: 'opening /contact ...',
    targetRoute: '/contact',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 8,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'cd',
    description: 'navigate to /menu, /cadence, /ask, /agensi, /contact, or /changes-in-progress',
    kind: 'cd' as const,
    output: 'cd /{{target}}',
    targetRoute: null,
    allowedRoutes: ['menu', 'cadence', 'ask', 'agensi', 'contact', 'changes-in-progress'],
    errorTemplate:
      'cd: no such route: {{input}}\nTry: cd menu | cd cadence | cd ask | cd agensi | cd contact | cd changes-in-progress',
    sortOrder: 9,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'status',
    description: 'inspect cluster & service state',
    kind: 'static' as const,
    output: 'gke-autopilot: 0 pods (scale-to-0) · portal-ssr: online · theme: solar-forge',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 10,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'whoami',
    description: 'display active terminal session',
    kind: 'static' as const,
    output: 'guest@andrew-k.us (tty1)',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 11,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'clear',
    description: 'clear terminal scrollback',
    kind: 'clear' as const,
    output: '',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 12,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'help',
    description: 'list available maintenance commands',
    kind: 'static' as const,
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
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 1,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'status',
    description: 'current rebuild & deployment status',
    kind: 'static' as const,
    output: [
      'STATE    : CHANGES IN PROGRESS (maintenance mode)',
      'HOST     : andrew-k.us',
      'RUNTIME  : Google Cloud Run (us-central1, scale-to-0)',
      'PROGRESS : [██████████████░░░░░░] 72%',
      'NOTICE   : Full portal navigation will unlock as soon as v2 rollout completes.',
    ].join('\n'),
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 2,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'roadmap',
    description: 'active Solar Forge v2 milestones',
    kind: 'roadmap' as const,
    output: '',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 3,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'stack',
    description: 'runtime & cloud architecture summary',
    kind: 'static' as const,
    output: [
      'Frontend : React 19 · React Router 8 SSR · Vite 8 · CSS Modules + @layer tokens',
      'Backend  : Go microservices + Fastify 5 Node 24/26 native TS · PostgreSQL 19 · Qdrant',
      'Infra    : Cloud Run (edge SSR) + GKE Autopilot (scale-to-0 workloads)',
    ].join('\n'),
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 4,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'whoami',
    description: 'active session identity',
    kind: 'static' as const,
    output: 'visitor@andrew-k.us (read-only maintenance tty1)',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 5,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'uname',
    description: 'print platform kernel banner',
    kind: 'static' as const,
    output: 'SolarForge 2.0.0 andrew-k.us x86_64 CloudRun/Linux',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 6,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'uptime',
    description: 'show browser session uptime',
    kind: 'uptime' as const,
    output: 'up {{seconds}}s · 1 user · load average: 0.00, 0.00, 0.00',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 7,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalMaintenance,
    name: 'clear',
    description: 'clear terminal scrollback',
    kind: 'clear' as const,
    output: '',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 8,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'help',
    description: 'list available ops commands',
    kind: 'static' as const,
    output: [
      'Available admin ops commands:',
      '  help      — list available ops commands',
      '  home      — open Operations Overview (/)',
      '  analytics — open Telemetry & CWV Dashboard (/analytics)',
      '  cms       — open Postgres 19 CMS (/cms)',
      '  inbox     — open Contact Inbox & Attachments (/inbox)',
      '  quotas    — open Quota Policies & Buckets (/quotas)',
      '  ops       — open Cluster SSE & Sandbox Audit (/ops)',
      '  status    — print isolated ops status',
      '  whoami    — print active ops identity',
      '  clear     — clear terminal scrollback',
      ...buildSplitHelpLines({ includeTui: false }),
    ].join('\n'),
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 1,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'home',
    description: 'open Operations Overview (/)',
    kind: 'navigate' as const,
    output: 'opening / ...',
    targetRoute: '/',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 2,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'analytics',
    description: 'open Telemetry & CWV Dashboard (/analytics)',
    kind: 'navigate' as const,
    output: 'opening /analytics ...',
    targetRoute: '/analytics',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 3,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'cms',
    description: 'open Postgres 19 CMS (/cms)',
    kind: 'navigate' as const,
    output: 'opening /cms ...',
    targetRoute: '/cms',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 4,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'inbox',
    description: 'open Contact Inbox (/inbox)',
    kind: 'navigate' as const,
    output: 'opening /inbox ...',
    targetRoute: '/inbox',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 5,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'quotas',
    description: 'open Quota Policies & Rate-Limit Buckets (/quotas)',
    kind: 'navigate' as const,
    output: 'opening /quotas ...',
    targetRoute: '/quotas',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 6,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'ops',
    description: 'open Cluster SSE & Sandbox Ops (/ops)',
    kind: 'navigate' as const,
    output: 'opening /ops ...',
    targetRoute: '/ops',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 7,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'status',
    description: 'print isolated ops status',
    kind: 'static' as const,
    output:
      'SURFACE : admin.andrew-k.us (noindex, nofollow, noarchive)\nAUTH    : WebAuthn passkey gate · Postgres 19 telemetry active',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 8,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'whoami',
    description: 'print active ops identity',
    kind: 'static' as const,
    output: 'admin@andrew-k.us (isolated ops shell)',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 9,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.adminOps,
    name: 'clear',
    description: 'clear terminal scrollback',
    kind: 'clear' as const,
    output: '',
    targetRoute: null,
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 10,
  },
] as const;

const ROADMAP_MILESTONE_SEEDS = [
  {
    slug: 'solar-forge-theme',
    status: 'done' as const,
    label: 'Solar Forge 4-layer CSS variable theme & animated reticle emblem',
    sortOrder: 1,
    enabled: true,
  },
  {
    slug: 'cloud-run-ssr',
    status: 'done' as const,
    label: 'React Router 8 + Fastify 5 SSR migrated from App Engine to Cloud Run',
    sortOrder: 2,
    enabled: true,
  },
  {
    slug: 'terminal-tui-workspace',
    status: 'active' as const,
    label: 'Interactive Solar Forge terminal & draggable TUI workspace',
    sortOrder: 3,
    enabled: true,
  },
  {
    slug: 'gke-go-cadence',
    status: 'queued' as const,
    label: 'Scale-from-zero Go microservices & CADENCE live sandbox rollout',
    sortOrder: 4,
    enabled: true,
  },
] as const;

const CADENCE_PRESET_SEEDS = [
  {
    slug: 'solar-forge-starter',
    title: 'Solar Forge Sandbox Starter',
    starterPrompt:
      'Build a responsive Solar Forge diagnostic card with live status telemetry and keyboard shortcuts.',
    expectedKind: 'diagnostic-card',
    starterArtifactHtml: STARTER_CADENCE_ARTIFACT_HTML,
    sortOrder: 1,
  },
  {
    slug: 'k8s-pod-telemetry',
    title: 'GKE Pod Telemetry Widget',
    starterPrompt:
      'Build a GKE Autopilot scale-from-zero pod monitor card showing cold-start latency, replica count, and health status.',
    expectedKind: 'pod-telemetry',
    starterArtifactHtml: STARTER_K8S_TELEMETRY_ARTIFACT_HTML,
    sortOrder: 2,
  },
  {
    slug: 'chord-pipeline-monitor',
    title: 'CHORD Pipeline Latency Monitor',
    starterPrompt:
      'Build an interactive CHORD pipeline monitor tracking triage, spec, build, and gate stage latencies and replica readiness.',
    expectedKind: 'pipeline-monitor',
    starterArtifactHtml: buildTailoredCadenceArtifactHtml({
      prompt:
        'Build an interactive CHORD pipeline monitor tracking triage, spec, build, and gate stage latencies and replica readiness.',
      preset: {
        slug: 'chord-pipeline-monitor',
        title: 'CHORD Pipeline Latency Monitor',
        expectedKind: 'pipeline-monitor',
      },
    }),
    sortOrder: 3,
  },
  {
    slug: 'qdrant-rag-inspector',
    title: 'Qdrant Grounded RAG Inspector',
    starterPrompt:
      'Create a grounded Qdrant retrieval inspector visualizing cosine similarity thresholds, citation cards, and fail-closed abstention.',
    expectedKind: 'rag-inspector',
    starterArtifactHtml: buildTailoredCadenceArtifactHtml({
      prompt:
        'Create a grounded Qdrant retrieval inspector visualizing cosine similarity thresholds, citation cards, and fail-closed abstention.',
      preset: {
        slug: 'qdrant-rag-inspector',
        title: 'Qdrant Grounded RAG Inspector',
        expectedKind: 'rag-inspector',
      },
    }),
    sortOrder: 4,
  },
  {
    slug: 'zero-trust-gate-panel',
    title: 'Zero-Trust Gate Audit Panel',
    starterPrompt:
      'Generate a zero-trust sandbox gate verification card displaying HMAC auth checks, cookie isolation, and 48 KiB HTML policy status.',
    expectedKind: 'security-gate',
    starterArtifactHtml: buildTailoredCadenceArtifactHtml({
      prompt:
        'Generate a zero-trust sandbox gate verification card displaying HMAC auth checks, cookie isolation, and 48 KiB HTML policy status.',
      preset: {
        slug: 'zero-trust-gate-panel',
        title: 'Zero-Trust Gate Audit Panel',
        expectedKind: 'security-gate',
      },
    }),
    sortOrder: 5,
  },
] as const;

const RETIRED_PLACEHOLDER_SKILL_SLUGS = [
  'cadence-sdlc',
  'gke-scale-to-zero-go',
  'grounded-qdrant-rag',
  'solar-forge-react-ssr',
  'pg19-quota-guardrails',
] as const;

const AGENSI_SKILL_SEEDS = [
  {
    slug: 'cadence-governed-agentic-sdlc-framework',
    name: 'CADENCE: Governed Agentic SDLC Framework',
    summary:
      'Complete 7-phase, provider-neutral agentic SDLC framework with 12 specialist roles, CHORD behavioral specs, strict BDD/TDD, zero-spec /tmp fault-injection review, expand/contract migrations, and 4 human approval gates.',
    tags: [
      'agents-orchestration',
      'code-quality-review',
      'testing-debugging',
      'workflow-automation',
      'security',
      'sdlc',
      'tdd',
      'architecture',
      'specifications',
    ],
    url: 'https://agensi.io/skills/cadence-governed-agentic-sdlc-framework',
    sortOrder: 1,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
  {
    slug: 'cadence-triage-risk-classifier',
    name: 'CADENCE Triage & Risk Classifier',
    summary:
      'Classifies engineering tasks across 4 axes, runs bounded 20-file codebase recon, catches hidden sibling callers, and initializes structured ticket specs before coding starts.',
    tags: [
      'agents-orchestration',
      'workflow-automation',
      'code-quality-review',
      'triage',
      'planning',
      'software-engineering',
    ],
    url: 'https://agensi.io/skills/cadence-triage-risk-classifier',
    sortOrder: 2,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
  {
    slug: 'local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
    name: 'Local GPU Coprocessor Offload for Coding Agents (FastMCP)',
    summary:
      'Strictly read-only local GPU FastMCP server (AST semantic search, 30-line fast-path log compaction with /tmp raw escape hatches, and deterministic + LLM pre-PR diff review) to slash frontier token costs.',
    tags: [
      'llm-ops',
      'agents-orchestration',
      'testing-debugging',
      'code-quality-review',
      'local-llm',
      'mcp',
      'llama-cpp',
      'ollama',
    ],
    url: 'https://agensi.io/skills/local-gpu-coprocessor-offload-for-coding-agents-fastmcp',
    sortOrder: 3,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
  {
    slug: 'cadence-safe-database-migration-author-expand-contract',
    name: 'CADENCE Safe Database Migration Author (Expand/Contract)',
    summary:
      'Zero-downtime expand/contract database migration author and auditor for EF Core, Alembic, Prisma, Drizzle, Room, and raw SQL with DDL/DML separation, idempotency guards, and rollback proof.',
    tags: [
      'data-databases',
      'apis-backend',
      'code-quality-review',
      'devops-cloud',
      'migrations',
      'sql',
      'zero-downtime',
    ],
    url: 'https://agensi.io/skills/cadence-safe-database-migration-author-expand-contract',
    sortOrder: 4,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
  {
    slug: 'cadence-chord-specification-spec-challenger',
    name: 'CADENCE CHORD Specification & Spec Challenger',
    summary:
      'Produces unranked multi-option design exploration, 6W×4L + CHORD behavioral specs, observability seams, Gherkin test plans, evidence manifests, and a 7-check Pre-Gate-1 Spec Challenger before coding.',
    tags: [
      'agents-orchestration',
      'code-quality-review',
      'technical-documentation',
      'testing-debugging',
      'architecture',
      'specifications',
      'bdd',
    ],
    url: 'https://agensi.io/skills/cadence-chord-specification-spec-challenger',
    sortOrder: 5,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
  {
    slug: 'cadence-adversarial-pre-pr-review-gate',
    name: 'CADENCE Adversarial Pre-PR Review Gate',
    summary:
      'Three-lens pre-PR review combining contract review, a zero-spec Cold Breaker that runs disposable /tmp fault-injection probes across 7 break vectors, and a security/concurrency audit.',
    tags: [
      'code-quality-review',
      'security',
      'testing-debugging',
      'code-review',
      'adversarial-testing',
      'pre-pr',
      'concurrency',
    ],
    url: 'https://agensi.io/skills/cadence-adversarial-pre-pr-review-gate',
    sortOrder: 6,
    creatorHandle: 'aklapper',
    isPublished: true,
    source: 'seed' as const,
  },
] as const;

const QUOTA_POLICY_SEEDS = [
  {
    role: 'guest' as const,
    maxTurnsPerSession: 10,
    maxTokensPerRun: 4_000,
    maxDailyGlobalTokens: 100_000,
  },
  {
    role: 'admin' as const,
    maxTurnsPerSession: 100,
    maxTokensPerRun: 32_000,
    maxDailyGlobalTokens: 2_000_000,
  },
] as const;

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

export const ADMIN_OPS_TERMINAL_PROFILE: TerminalProfileData = buildSeedTerminalProfile(
  TERMINAL_PROFILE_SLUGS.adminOps,
);

export {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  AGENSI_SKILL_SEEDS,
  CADENCE_PRESET_SEEDS,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
  PORTAL_MAINTENANCE_SEED,
  PORTAL_MENU_SEED,
  ROADMAP_MILESTONE_SEEDS,
  seedAdminUserFromEnv,
  type SeedAdminUserResult,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_INITIAL_ENTRY_SEEDS,
  TERMINAL_PROFILE_SEEDS,
};

export interface SeedDatabaseOptions {
  mode?: 'upsert' | 'bootstrap';
  pruneMissingMilestones?: boolean;
  env?: Record<string, string | undefined>;
}

function resolveSeedOptions(
  optionsOrEnv?: SeedDatabaseOptions | Record<string, string | undefined>,
): {
  mode: 'upsert' | 'bootstrap';
  pruneMissingMilestones: boolean;
  env: Record<string, string | undefined>;
} {
  if (!optionsOrEnv) {
    return { mode: 'upsert', pruneMissingMilestones: false, env: process.env };
  }
  const maybeOpts = optionsOrEnv as SeedDatabaseOptions;
  if (
    'mode' in maybeOpts ||
    'pruneMissingMilestones' in maybeOpts ||
    (typeof maybeOpts.env === 'object' && maybeOpts.env !== null)
  ) {
    return {
      mode: maybeOpts.mode === 'bootstrap' ? 'bootstrap' : 'upsert',
      pruneMissingMilestones: Boolean(maybeOpts.pruneMissingMilestones),
      env: maybeOpts.env ?? process.env,
    };
  }
  return {
    mode: 'upsert',
    pruneMissingMilestones: false,
    env: optionsOrEnv as Record<string, string | undefined>,
  };
}

export async function seedDatabase(
  db: AppDatabase,
  optionsOrEnv: SeedDatabaseOptions | Record<string, string | undefined> = process.env,
): Promise<void> {
  const { mode, pruneMissingMilestones, env } = resolveSeedOptions(optionsOrEnv);
  const isBootstrap = mode === 'bootstrap';

  console.info(
    JSON.stringify({
      event: 'db.seed.mode_branch',
      seam: 'RULE_DIVERGENCE',
      branch: isBootstrap ? 'bootstrap_missing_only' : 'upsert_safe',
    }),
  );

  for (const item of DEFAULT_MENU_ITEMS) {
    const stmt = db.insert(menuItems).values(item);
    await (isBootstrap
      ? stmt.onConflictDoNothing({ target: menuItems.slug })
      : stmt.onConflictDoUpdate({
          target: menuItems.slug,
          set: {
            keyShortcut: item.keyShortcut,
            title: item.title,
            description: item.description,
            targetK8sDeploy: item.targetK8sDeploy,
            namespace: item.namespace,
            adminOnly: item.adminOnly,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
          },
        }));
  }

  for (const content of SITE_CONTENT_SEEDS) {
    const stmt = db.insert(siteContent).values(content);
    await (isBootstrap
      ? stmt.onConflictDoNothing({ target: siteContent.key })
      : stmt.onConflictDoUpdate({
          target: siteContent.key,
          set: {
            markdownBody: content.markdownBody,
            metadataJson: content.metadataJson,
            updatedAt: new Date(),
          },
        }));
  }

  for (const profile of TERMINAL_PROFILE_SEEDS) {
    const stmt = db.insert(terminalProfiles).values({
      ...profile,
      quickCommands: [...profile.quickCommands],
    });
    await (isBootstrap
      ? stmt.onConflictDoNothing({ target: terminalProfiles.slug })
      : stmt.onConflictDoUpdate({
          target: terminalProfiles.slug,
          set: {
            bannerTitle: profile.bannerTitle,
            bannerMeta: profile.bannerMeta,
            osLabel: profile.osLabel,
            directory: profile.directory,
            vcsBranch: profile.vcsBranch,
            vcsState: profile.vcsState,
            contextLabel: profile.contextLabel,
            placeholder: profile.placeholder,
            quickCommands: [...profile.quickCommands],
          },
        }));
  }

  for (const entry of TERMINAL_INITIAL_ENTRY_SEEDS) {
    const stmt = db.insert(terminalInitialEntries).values(entry);
    await (isBootstrap
      ? stmt.onConflictDoNothing({
          target: [terminalInitialEntries.profileSlug, terminalInitialEntries.sortOrder],
        })
      : stmt.onConflictDoUpdate({
          target: [terminalInitialEntries.profileSlug, terminalInitialEntries.sortOrder],
          set: {
            command: entry.command,
            output: entry.output,
            status: entry.status,
            durationLabel: entry.durationLabel,
            timestampLabel: entry.timestampLabel,
          },
        }));
  }

  for (const cmd of TERMINAL_COMMAND_SEEDS) {
    const stmt = db.insert(terminalCommands).values({
      ...cmd,
      allowedRoutes: [...cmd.allowedRoutes],
    });
    await (isBootstrap
      ? stmt.onConflictDoNothing({
          target: [terminalCommands.profileSlug, terminalCommands.name],
        })
      : stmt.onConflictDoUpdate({
          target: [terminalCommands.profileSlug, terminalCommands.name],
          set: {
            description: cmd.description,
            kind: cmd.kind,
            output: cmd.output,
            targetRoute: cmd.targetRoute,
            allowedRoutes: [...cmd.allowedRoutes],
            errorTemplate: cmd.errorTemplate,
            sortOrder: cmd.sortOrder,
          },
        }));
  }

  for (const dirEntry of TERMINAL_DIRECTORY_ENTRY_SEEDS) {
    const stmt = db.insert(terminalDirectoryEntries).values(dirEntry);
    await (isBootstrap
      ? stmt.onConflictDoNothing({
          target: [terminalDirectoryEntries.profileSlug, terminalDirectoryEntries.name],
        })
      : stmt.onConflictDoUpdate({
          target: [terminalDirectoryEntries.profileSlug, terminalDirectoryEntries.name],
          set: {
            description: dirEntry.description,
            sortOrder: dirEntry.sortOrder,
            enabled: dirEntry.enabled,
          },
        }));
  }

  if (pruneMissingMilestones) {
    console.info(
      JSON.stringify({
        event: 'db.seed.mode_branch',
        seam: 'RULE_DIVERGENCE',
        branch: 'explicit_prune_roadmap',
      }),
    );
    await db.delete(roadmapMilestones).where(
      notInArray(
        roadmapMilestones.slug,
        ROADMAP_MILESTONE_SEEDS.map(milestone => milestone.slug),
      ),
    );
  }

  for (const milestone of ROADMAP_MILESTONE_SEEDS) {
    const stmt = db.insert(roadmapMilestones).values(milestone);
    await (isBootstrap
      ? stmt.onConflictDoNothing({ target: roadmapMilestones.slug })
      : stmt.onConflictDoUpdate({
          target: roadmapMilestones.slug,
          set: {
            status: milestone.status,
            label: milestone.label,
            sortOrder: milestone.sortOrder,
            enabled: milestone.enabled,
          },
        }));
  }

  for (const preset of CADENCE_PRESET_SEEDS) {
    const stmt = db.insert(cadencePresets).values(preset);
    await (isBootstrap
      ? stmt.onConflictDoNothing({ target: cadencePresets.slug })
      : stmt.onConflictDoUpdate({
          target: cadencePresets.slug,
          set: {
            title: preset.title,
            starterPrompt: preset.starterPrompt,
            expectedKind: preset.expectedKind,
            starterArtifactHtml: preset.starterArtifactHtml,
            sortOrder: preset.sortOrder,
          },
        }));
  }

  const isProductionEnv = (env['NODE_ENV'] ?? process.env['NODE_ENV']) === 'production';
  const allowProdAgensiSeed = env['ALLOW_AGENSI_SEED_IN_PROD'] === 'true';
  if (!isProductionEnv || allowProdAgensiSeed) {
    const creatorHandle = resolveAgensiCreatorHandle(env);
    const existingLiveRows = await db
      .select({ slug: agensiSkills.slug })
      .from(agensiSkills)
      .where(
        and(
          sql`lower(${agensiSkills.creatorHandle}) = lower(${creatorHandle})`,
          eq(agensiSkills.source, 'agensi_api'),
        ),
      )
      .limit(1);

    if (existingLiveRows.length === 0) {
      await db
        .delete(agensiSkills)
        .where(
          and(
            inArray(agensiSkills.slug, RETIRED_PLACEHOLDER_SKILL_SLUGS),
            eq(agensiSkills.source, 'seed'),
          ),
        );

      for (const skill of AGENSI_SKILL_SEEDS) {
        await db
          .insert(agensiSkills)
          .values({
            ...skill,
            tags: [...skill.tags],
          })
          .onConflictDoNothing({
            target: agensiSkills.slug,
          });
      }
    }
  }

  for (const policy of QUOTA_POLICY_SEEDS) {
    await db
      .insert(quotaPolicies)
      .values(policy)
      .onConflictDoNothing({ target: quotaPolicies.role });
  }

  for (const dossier of CAREER_DOSSIER_SEEDS) {
    await db
      .insert(careerDossiers)
      .values({
        slug: dossier.slug,
        kind: dossier.kind,
        title: dossier.title,
        domainLabel: dossier.domainLabel,
        roleTitle: dossier.roleTitle,
        timeframe: dossier.timeframe,
        skills: [...dossier.skills],
        summaryBody: dossier.summaryBody,
        sectionsJson: dossier.sectionsJson.map(section => ({
          heading: section.heading,
          body: section.body,
        })),
        publishStatus: dossier.publishStatus,
        sanitizationVerifiedAt: dossier.sanitizationVerifiedAt,
        denylistHash: dossier.denylistHash,
        sortOrder: dossier.sortOrder,
      })
      .onConflictDoNothing({ target: careerDossiers.slug });
  }

  await seedAdminUserFromEnv(db, env);
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const argv = process.argv.slice(2);
  let mode: 'upsert' | 'bootstrap' = 'upsert';
  let pruneMissingMilestones = false;
  for (const arg of argv) {
    if (arg === '--mode=bootstrap') mode = 'bootstrap';
    else if (arg === '--mode=upsert') mode = 'upsert';
    else if (arg === '--prune') pruneMissingMilestones = true;
  }
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedDatabase(db, { mode, pruneMissingMilestones });
    console.log('Postgres seed data applied successfully.');
  } finally {
    await pool.end();
  }
}
