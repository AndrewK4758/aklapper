import {
  ADMIN_CHROME_SHORTCUT_HINT,
  type AdminAnalyticsContent,
  type AdminChromeContent,
  type AdminHomeContent,
  buildSplitHelpLines,
  cloneDefaultPortalHomePortrait,
  cloneDefaultPortalHomeResumeSummary,
  CONTACT_FORM_DEFINITION,
  formatTerminalDirectoryListing,
  type MenuItem,
  PORTAL_CHROME_SHORTCUT_HINT,
  PORTAL_READLINE_HELP_LINES,
  type PortalAgensiContent,
  type PortalChromeContent,
  type PortalContactContent,
  type PortalHomeContent,
  type TerminalProfileData,
  TerminalProfileDataSchema,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import {
  isProductionPrivacyEnv,
  sanitizeCareerDossierPayload,
  sanitizePortalAboutSiteContent,
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
} from '@aklapper/node-runtime/privacy';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { type AppDatabase, createDb, createDbPool } from './client.ts';
import { resolveTerminalLsOutput, SITE_CONTENT_KEYS, TERMINAL_PROFILE_SLUGS } from './queries.ts';
import {
  agensiSkills,
  cadencePresets,
  careerDossiers,
  menuItems,
  quotaPolicies,
  sandboxRuns,
  sandboxTurns,
  siteContent,
  terminalCommands,
  terminalDirectoryEntries,
  terminalInitialEntries,
  terminalProfiles,
} from './schema.ts';
import { PORTAL_ABOUT_SEED } from './seed-about.ts';
import { seedAdminUserFromEnv, type SeedAdminUserResult } from './seed-admin.ts';
import {
  CAREER_DOSSIER_SEEDS,
  type CareerDossierSeedEntry,
  PORTAL_ASK_SEED,
} from './seed-dossiers.ts';
import {
  CADENCE_GOLDEN_RUN_SEEDS,
  CADENCE_PRESET_SEEDS,
  PORTAL_CADENCE_SEED,
} from './seed-golden-runs.ts';

export const DEFAULT_MENU_ITEMS: readonly MenuItem[] = [
  {
    slug: 'cadence',
    keyShortcut: '1',
    title: 'CADENCE Builder',
    description: 'Prompt-to-artifact showcase backed by Cloud Run Go services and Qdrant recall',
    adminOnly: false,
    sortOrder: 1,
    enabled: true,
  },
  {
    slug: 'chat',
    keyShortcut: '2',
    title: 'Chat with Andrew / JD Match',
    description: "Chat with Andrew's AI using portfolio records, general chat, or JD role fit",
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
    adminOnly: false,
    sortOrder: 3,
    enabled: true,
  },
  {
    slug: 'contact',
    keyShortcut: '4',
    title: 'Contact & Outreach',
    description: 'Direct contact & outreach persisted in PostgreSQL 19',
    adminOnly: false,
    sortOrder: 4,
    enabled: true,
  },
  {
    slug: 'admin-ops',
    keyShortcut: '9',
    title: 'Admin Telemetry & CADENCE Runner',
    description: 'Admin operations, sandbox gate audit, and first-party analytics',
    adminOnly: true,
    sortOrder: 9,
    enabled: true,
  },
];

export const PORTAL_CHROME_SEED: PortalChromeContent = {
  pageTitle: 'andrew-k.us — Andrew Klapper',
  brandLabel: 'Andrew Klapper Portfolio',
  brandContactEmail: 'andrew@andrew-k.us',
  shortcutHint: PORTAL_CHROME_SHORTCUT_HINT,
  statusBadge: {
    source: 'cloud-run',
    state: 'idle',
    label: 'Idle (on-demand services)',
  },
  footerText: 'Andrew Klapper · Personal Portfolio',
  footerLinkLabel: 'agensi.io/creators/aklapper',
  footerLinkUrl: 'https://agensi.io/creators/aklapper',
};

const PORTAL_HOME_ABOUT_ACTION = {
  label: 'About & Resume → /about',
  to: '/about',
  variant: 'default',
} as const;

const PORTAL_HOME_SEED: PortalHomeContent = {
  tuiTitle: 'Portfolio Launcher',
  tuiBadge: {
    source: 'cloud-run',
    state: 'idle',
    label: 'Idle (on-demand services)',
  },
  heading: 'Andrew Klapper — Portfolio',
  description:
    "Explore interactive demos, chat with Andrew's AI about his work and experience, browse published Agensi skills, or send a direct message. Use the launcher below or the terminal above to navigate.",
  actions: [
    PORTAL_HOME_ABOUT_ACTION,
    { label: 'CADENCE Builder → /cadence', to: '/cadence', variant: 'primary' },
    { label: 'Chat with Andrew → /chat', to: '/chat', variant: 'default' },
    { label: 'Agensi Storefront → /agensi', to: '/agensi', variant: 'default' },
    { label: 'Contact → /contact', to: '/contact', variant: 'default' },
  ],
  portrait: cloneDefaultPortalHomePortrait(),
  resumeSummary: cloneDefaultPortalHomeResumeSummary(),
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

const ADMIN_CHROME_SEED: AdminChromeContent = {
  pageTitle: 'admin.andrew-k.us — Admin Console',
  brandLabel: 'admin.andrew-k.us',
  shortcutHint: ADMIN_CHROME_SHORTCUT_HINT,
  statusBadge: {
    source: 'admin-console',
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
    markdownBody: 'Portal global shell chrome and status badge.',
    metadataJson: PORTAL_CHROME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalHome,
    markdownBody: 'Portal tty1 greeter TUI launcher content.',
    metadataJson: PORTAL_HOME_SEED,
  },
  {
    key: SITE_CONTENT_KEYS.portalAbout,
    markdownBody:
      'Portal public-safe resume framing, skills, education, and platform services guide.',
    metadataJson: PORTAL_ABOUT_SEED,
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

const TERMINAL_DIRECTORY_ENTRY_SEEDS = [
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'about',
    description: 'Resume & platform services guide',
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
    name: 'chat',
    description: "Chat with Andrew's AI",
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
      '  about      — open /about resume & platform services guide',
      '  tui        — open TUI launcher in a split pane',
      '  cadence    — open /cadence artifact sandbox',
      "  chat       — open /chat to chat with Andrew's AI & JD match",
      '  agensi     — open /agensi commercial skills storefront',
      '  contact    — run inline terminal contact form (or "contact --tui" / "--help")',
      '  cd <route> — navigate to /about, /cadence, /chat, /agensi, or /contact',
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
    name: 'about',
    description: 'open /about resume & platform services guide',
    kind: 'navigate' as const,
    output: 'opening /about ...',
    targetRoute: '/about',
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
    name: 'chat',
    description: "open /chat to chat with Andrew's AI & JD match",
    kind: 'navigate' as const,
    output: 'opening /chat ...',
    targetRoute: '/chat',
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
    description: 'navigate to /about, /cadence, /chat, /agensi, or /contact',
    kind: 'cd' as const,
    output: 'cd /{{target}}',
    targetRoute: null,
    allowedRoutes: ['about', 'cadence', 'chat', 'agensi', 'contact'],
    errorTemplate:
      'cd: no such route: {{input}}\nTry: cd about | cd cadence | cd chat | cd agensi | cd contact',
    sortOrder: 9,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'status',
    description: 'inspect runtime & service state',
    kind: 'static' as const,
    output: 'cloud-run: scale-to-0 ready · portal-ssr: online · theme: solar-forge',
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
  PORTAL_ABOUT_SEED,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
  seedAdminUserFromEnv,
  type SeedAdminUserResult,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_INITIAL_ENTRY_SEEDS,
  TERMINAL_PROFILE_SEEDS,
};

export interface SeedSiteContentEntry {
  readonly key: string;
  readonly markdownBody: string;
  readonly metadataJson: Record<string, unknown>;
}

export interface SeedDatabaseOptions {
  mode?: 'upsert' | 'bootstrap';
  env?: Record<string, string | undefined>;
  siteContentSeeds?: readonly SeedSiteContentEntry[];
  careerDossierSeeds?: readonly CareerDossierSeedEntry[];
}

function resolveSeedOptions(
  optionsOrEnv?: SeedDatabaseOptions | Record<string, string | undefined>,
): {
  mode: 'upsert' | 'bootstrap';
  env: Record<string, string | undefined>;
  siteContentSeeds: readonly SeedSiteContentEntry[];
  careerDossierSeeds: readonly CareerDossierSeedEntry[];
} {
  if (!optionsOrEnv) {
    return {
      mode: 'upsert',
      env: process.env,
      siteContentSeeds: SITE_CONTENT_SEEDS,
      careerDossierSeeds: CAREER_DOSSIER_SEEDS,
    };
  }
  const maybeOpts = optionsOrEnv as SeedDatabaseOptions;
  if (
    optionsOrEnv !== process.env &&
    ('mode' in maybeOpts ||
      'siteContentSeeds' in maybeOpts ||
      'careerDossierSeeds' in maybeOpts ||
      (typeof maybeOpts.env === 'object' && maybeOpts.env !== null))
  ) {
    return {
      mode: maybeOpts.mode === 'bootstrap' ? 'bootstrap' : 'upsert',
      env: maybeOpts.env ?? process.env,
      siteContentSeeds: maybeOpts.siteContentSeeds ?? SITE_CONTENT_SEEDS,
      careerDossierSeeds: maybeOpts.careerDossierSeeds ?? CAREER_DOSSIER_SEEDS,
    };
  }
  return {
    mode: 'upsert',
    env: optionsOrEnv as Record<string, string | undefined>,
    siteContentSeeds: SITE_CONTENT_SEEDS,
    careerDossierSeeds: CAREER_DOSSIER_SEEDS,
  };
}

async function mergeBootstrapAboutNavigation(db: AppDatabase): Promise<void> {
  const [cdRow] = await db
    .select({
      allowedRoutes: terminalCommands.allowedRoutes,
    })
    .from(terminalCommands)
    .where(
      and(
        eq(terminalCommands.profileSlug, TERMINAL_PROFILE_SLUGS.portalHome),
        eq(terminalCommands.name, 'cd'),
      ),
    )
    .limit(1);
  if (Array.isArray(cdRow?.allowedRoutes) && !cdRow.allowedRoutes.includes('about')) {
    await db
      .update(terminalCommands)
      .set({ allowedRoutes: [...cdRow.allowedRoutes, 'about'] })
      .where(
        and(
          eq(terminalCommands.profileSlug, TERMINAL_PROFILE_SLUGS.portalHome),
          eq(terminalCommands.name, 'cd'),
        ),
      );
  }

  const [profileRow] = await db
    .select({
      quickCommands: terminalProfiles.quickCommands,
    })
    .from(terminalProfiles)
    .where(eq(terminalProfiles.slug, TERMINAL_PROFILE_SLUGS.portalHome))
    .limit(1);
  if (Array.isArray(profileRow?.quickCommands) && !profileRow.quickCommands.includes('about')) {
    await db
      .update(terminalProfiles)
      .set({ quickCommands: [...profileRow.quickCommands, 'about'] })
      .where(eq(terminalProfiles.slug, TERMINAL_PROFILE_SLUGS.portalHome));
  }

  const [homeRow] = await db
    .select({
      metadataJson: siteContent.metadataJson,
    })
    .from(siteContent)
    .where(eq(siteContent.key, SITE_CONTENT_KEYS.portalHome))
    .limit(1);
  const metadataJson = homeRow?.metadataJson;
  if (metadataJson && typeof metadataJson === 'object' && Array.isArray(metadataJson['actions'])) {
    const existingActions = metadataJson['actions'] as unknown[];
    const hasAboutAction = existingActions.some(
      action =>
        action !== null &&
        typeof action === 'object' &&
        (action as Record<string, unknown>)['to'] === '/about',
    );
    if (!hasAboutAction) {
      await db
        .update(siteContent)
        .set({
          metadataJson: {
            ...metadataJson,
            actions: [...existingActions, PORTAL_HOME_ABOUT_ACTION],
          },
          updatedAt: new Date(),
        })
        .where(eq(siteContent.key, SITE_CONTENT_KEYS.portalHome));
    }
  }
}

export async function seedDatabase(
  db: AppDatabase,
  optionsOrEnv: SeedDatabaseOptions | Record<string, string | undefined> = process.env,
): Promise<void> {
  const { mode, env, siteContentSeeds, careerDossierSeeds } = resolveSeedOptions(optionsOrEnv);
  const isBootstrap = mode === 'bootstrap';
  const requireConfiguredDenylist = isProductionPrivacyEnv(env);
  const rawDenylist = env['DOSSIER_PRIVACY_DENYLIST'];

  // Pre-write fail-closed privacy sanitization executes BEFORE any database mutation.
  for (const content of siteContentSeeds) {
    if (content.key === SITE_CONTENT_KEYS.portalAbout) {
      sanitizePortalAboutSiteContent(
        content.markdownBody,
        content.metadataJson,
        rawDenylist,
        undefined,
        env,
      );
    } else if (content.key === SITE_CONTENT_KEYS.portalHome) {
      sanitizePortalHomeSiteContent(
        content.markdownBody,
        content.metadataJson,
        rawDenylist,
        undefined,
        env,
      );
    } else if (content.key === SITE_CONTENT_KEYS.portalAsk) {
      sanitizePortalAskSiteContent(
        content.markdownBody,
        content.metadataJson,
        rawDenylist,
        undefined,
        env,
      );
    }
  }

  const sanitizedDossiers = careerDossierSeeds.map(dossier => {
    const sections = dossier.sectionsJson.map(section => ({
      heading: section.heading,
      body: section.body,
    }));
    const verification = sanitizeCareerDossierPayload(
      {
        slug: dossier.slug,
        kind: dossier.kind,
        title: dossier.title,
        domainLabel: dossier.domainLabel,
        roleTitle: dossier.roleTitle,
        timeframe: dossier.timeframe,
        skills: [...dossier.skills],
        summaryBody: dossier.summaryBody,
        sections,
        sortOrder: dossier.sortOrder,
      },
      {
        env,
        rawDenylist,
        requireConfiguredDenylist,
      },
    );
    return { dossier, sections, verification };
  });

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
            adminOnly: item.adminOnly,
            sortOrder: item.sortOrder,
            enabled: item.enabled,
          },
        }));
  }

  for (const content of siteContentSeeds) {
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

  if (isBootstrap) {
    await mergeBootstrapAboutNavigation(db);
  } else {
    await db.delete(menuItems).where(eq(menuItems.slug, 'ask'));
    await db
      .delete(siteContent)
      .where(inArray(siteContent.key, ['portal-menu', 'portal-maintenance']));
    await db.delete(terminalProfiles).where(eq(terminalProfiles.slug, 'portal-maintenance'));
    await db
      .delete(terminalCommands)
      .where(
        and(
          eq(terminalCommands.profileSlug, TERMINAL_PROFILE_SLUGS.portalHome),
          inArray(terminalCommands.name, ['ask', 'menu']),
        ),
      );
    await db
      .delete(terminalDirectoryEntries)
      .where(
        and(
          eq(terminalDirectoryEntries.profileSlug, TERMINAL_PROFILE_SLUGS.portalHome),
          inArray(terminalDirectoryEntries.name, ['ask', 'menu', 'changes-in-progress']),
        ),
      );
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

  for (const golden of CADENCE_GOLDEN_RUN_SEEDS) {
    const runStmt = db.insert(sandboxRuns).values({
      id: golden.id,
      sessionId: golden.sessionId,
      ipHash: golden.ipHash,
      menuSlug: golden.menuSlug,
      prompt: golden.prompt,
      status: golden.status,
      gateVerdict: golden.gateVerdict,
      tokensIn: golden.tokensIn,
      tokensOut: golden.tokensOut,
      artifactHtml: golden.artifactHtml,
      isGolden: golden.isGolden,
      promptHash: golden.promptHash,
      executionMode: golden.executionMode,
      specJson: golden.specJson,
      gateAuditJson: golden.gateAuditJson,
    });
    await (isBootstrap
      ? runStmt.onConflictDoNothing({ target: sandboxRuns.id })
      : runStmt.onConflictDoUpdate({
          target: sandboxRuns.id,
          set: {
            menuSlug: golden.menuSlug,
            prompt: golden.prompt,
            status: golden.status,
            gateVerdict: golden.gateVerdict,
            tokensIn: golden.tokensIn,
            tokensOut: golden.tokensOut,
            artifactHtml: golden.artifactHtml,
            isGolden: golden.isGolden,
            promptHash: golden.promptHash,
            executionMode: golden.executionMode,
            specJson: golden.specJson,
            gateAuditJson: golden.gateAuditJson,
          },
        }));

    for (const turn of golden.turns) {
      const turnStmt = db.insert(sandboxTurns).values({
        runId: golden.id,
        phase: turn.phase,
        agentName: turn.agentName,
        status: turn.status,
        payloadJson: turn.payloadJson,
        latencyMs: turn.latencyMs,
      });
      await (isBootstrap
        ? turnStmt.onConflictDoNothing({ target: [sandboxTurns.runId, sandboxTurns.phase] })
        : turnStmt.onConflictDoUpdate({
            target: [sandboxTurns.runId, sandboxTurns.phase],
            set: {
              agentName: turn.agentName,
              status: turn.status,
              payloadJson: turn.payloadJson,
              latencyMs: turn.latencyMs,
            },
          }));
    }
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

  await db.transaction(async tx => {
    for (const { dossier, sections, verification } of sanitizedDossiers) {
      const dossierStmt = tx.insert(careerDossiers).values({
        slug: dossier.slug,
        kind: dossier.kind,
        title: dossier.title,
        domainLabel: dossier.domainLabel,
        roleTitle: dossier.roleTitle,
        timeframe: dossier.timeframe,
        skills: [...dossier.skills],
        summaryBody: dossier.summaryBody,
        sectionsJson: sections,
        publishStatus: dossier.publishStatus,
        sanitizationVerifiedAt: verification.verifiedAt,
        denylistHash: verification.denylistHash,
        sortOrder: dossier.sortOrder,
        updatedAt: verification.verifiedAt,
      });
      await (isBootstrap
        ? dossierStmt.onConflictDoNothing({ target: careerDossiers.slug })
        : dossierStmt.onConflictDoUpdate({
            target: careerDossiers.slug,
            set: {
              kind: dossier.kind,
              title: dossier.title,
              domainLabel: dossier.domainLabel,
              roleTitle: dossier.roleTitle,
              timeframe: dossier.timeframe,
              skills: [...dossier.skills],
              summaryBody: dossier.summaryBody,
              sectionsJson: sections,
              publishStatus: dossier.publishStatus,
              sanitizationVerifiedAt: verification.verifiedAt,
              denylistHash: verification.denylistHash,
              sortOrder: dossier.sortOrder,
              updatedAt: verification.verifiedAt,
            },
          }));
    }
  });

  await seedAdminUserFromEnv(db, env);
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const argv = process.argv.slice(2);
  let mode: 'upsert' | 'bootstrap' = 'upsert';
  for (const arg of argv) {
    if (arg === '--mode=bootstrap') mode = 'bootstrap';
    else if (arg === '--mode=upsert') mode = 'upsert';
  }
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedDatabase(db, { mode });
    console.log('Postgres seed data applied successfully.');
  } finally {
    await pool.end();
  }
}
