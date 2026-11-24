import {
  type AdminAnalyticsContent,
  type AdminChromeContent,
  type AdminHomeContent,
  CONTACT_FORM_DEFINITION,
  type MenuItem,
  type PortalCadenceContent,
  type PortalChromeContent,
  type PortalContactContent,
  type PortalHomeContent,
  type PortalMaintenanceContent,
  type PortalMenuContent,
} from '@aklapper/core';
import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { notInArray } from 'drizzle-orm';

import { type AppDatabase, createDb, createDbPool } from './client.ts';
import { SITE_CONTENT_KEYS, TERMINAL_PROFILE_SLUGS } from './queries.ts';
import {
  agensiSkills,
  cadencePresets,
  menuItems,
  quotaPolicies,
  roadmapMilestones,
  siteContent,
  terminalCommands,
  terminalInitialEntries,
  terminalProfiles,
} from './schema.ts';

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

export const PORTAL_CHROME_SEED: PortalChromeContent = {
  pageTitle: 'andrew-k.us // Solar Forge Terminal',
  brandLabel: 'andrew-k.us :: tty1',
  statusBadge: {
    source: 'gke-autopilot',
    state: 'idle',
    label: '0 pods (scale-to-0)',
  },
  footerText: 'Solar Forge // Fastify 5 + React Router 8 SSR',
  footerLinkLabel: 'agensi.io/creators/aklapper',
  footerLinkUrl: 'https://agensi.io/creators/aklapper',
  maintenanceModeDefault: false,
};

const PORTAL_HOME_SEED: PortalHomeContent = {
  tuiTitle: 'tui :: solar-forge launcher',
  tuiBadge: {
    source: 'gke-autopilot',
    state: 'idle',
    label: '0 pods (scale-to-0)',
  },
  heading: 'Solar Forge Agentic Terminal — tty1',
  description:
    'Use this interactive TUI launcher or the Solar Forge terminal above to open the module menu, wake real GKE Autopilot scale-from-zero Go microservices on demand, and build live sandboxed artifacts with CADENCE.',
  actions: [
    { label: 'Enter as Guest → /menu', to: '/menu', variant: 'primary' },
    { label: 'Open CADENCE → /cadence', to: '/cadence', variant: 'default' },
    { label: 'Open Contact → /contact', to: '/contact', variant: 'default' },
    { label: 'Preview Changes in Progress', to: '/changes-in-progress', variant: 'default' },
  ],
};

const PORTAL_MENU_SEED: PortalMenuContent = {
  heading: 'Launch Menu',
  description: 'Select a module. No pods wake until you invoke a live GKE workflow.',
  localTargetLabel: 'local',
};

const PORTAL_CADENCE_SEED: PortalCadenceContent = {
  windowTitle: 'CADENCE Builder // portfolio-public',
  statusBadge: {
    source: 'svc-cadence-demo',
    state: 'idle',
    label: '0/1 replicas',
  },
  description:
    'Quota-gated prompt builder wired for live Go GKE scale-from-zero execution and Qdrant recall.',
  iframeTitle: 'CADENCE Artifact Preview',
};

const PORTAL_CONTACT_SEED: PortalContactContent = {
  windowTitle: 'tui :: contact // direct transmission',
  statusBadge: {
    source: 'postgres-19',
    state: 'ready',
    label: 'validated · pg19',
  },
  description:
    'Recursive Zod + JSON TUI form parser with client, server, and PostgreSQL 19 CHECK constraint validation.',
  form: CONTACT_FORM_DEFINITION,
};

const PORTAL_MAINTENANCE_SEED: PortalMaintenanceContent = {
  windowTitle: 'tui :: andrew-k.us // changes in progress',
  statusBadge: {
    source: 'solar-forge-v2',
    state: 'scaling',
    label: 'CHANGES IN PROGRESS',
  },
  heading: 'Changes in Progress',
  lead: 'andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI platform. Site navigation is temporarily disabled while the new architecture rolls out.',
  progressPercent: 72,
  progressAriaLabel: 'Solar Forge v2 rebuild progress',
  metaLeft: 'mode: maintenance (no navigation)',
  metaRight: 'progress: 72% · drag titlebar or type below',
};

const ADMIN_CHROME_SEED: AdminChromeContent = {
  pageTitle: 'admin.andrew-k.us // Solar Forge Ops',
  brandLabel: 'admin.andrew-k.us :: cadence-admin',
  statusBadge: {
    source: 'cadence-admin',
    state: 'gate',
    label: 'Passkey Auth Required',
  },
};

const ADMIN_HOME_SEED: AdminHomeContent = {
  heading: 'Admin Operations Console',
  description:
    'Isolated bundle for aklapper: WebAuthn Passkey + future TOTP 2FA gate, first-party analytics, Postgres 19 menu/quota CMS, and private cadence-admin namespace controls.',
  actions: [{ label: 'Open Telemetry View', to: '/analytics', variant: 'primary' }],
};

const ADMIN_ANALYTICS_SEED: AdminAnalyticsContent = {
  windowTitle: 'First-Party Visitor Analytics // Postgres 19',
  description:
    'Wired for node-api-analytics ingest queries, Core Web Vitals percentiles, and Agensi outbound conversion counts.',
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
    bannerMeta: 'tty1 · type "menu", "tui", or "contact" · Tab autocomplete',
    osLabel: '⚡',
    directory: '~/projects/aklapper',
    vcsBranch: 'portfolio_v2',
    vcsState: 'clean' as const,
    contextLabel: 'guest@andrew-k.us',
    placeholder: 'type a command (help, ls, menu, tui, cadence, contact, cd ...)',
    quickCommands: ['help', 'ls', 'menu', 'tui', 'cadence', 'contact', 'status', 'clear'],
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
] as const;

const TERMINAL_INITIAL_ENTRY_SEEDS = [
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    command: 'ls -la',
    output: [
      'drwxr-xr-x  guest  solar-forge  menu/                 # Interactive module launcher',
      'drwxr-xr-x  guest  solar-forge  tui/                  # Draggable TUI launcher window',
      'drwxr-xr-x  guest  solar-forge  cadence/              # Sandboxed artifact builder',
      'drwxr-xr-x  guest  solar-forge  contact/              # Recursive Zod/JSON TUI contact form',
      '-rw-r--r--  guest  solar-forge  changes-in-progress   # Production maintenance preview',
    ].join('\n'),
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
      '  tui        — open draggable TUI launcher window',
      '  cadence    — open /cadence artifact sandbox',
      '  contact    — run inline terminal contact form (or "contact --tui" / "--help")',
      '  cd <route> — navigate to /menu, /cadence, /contact, or /changes-in-progress',
      '  status     — inspect cluster & service state',
      '  whoami     — display active terminal session',
      '  clear      — clear terminal scrollback',
      '',
      'Keybindings:',
      '  Tab / Right — accept autocomplete suggestion',
      '  Up / Down (Ctrl+P / Ctrl+N) — command history',
      '  Ctrl+L — clear · Ctrl+C — cancel line · Ctrl+U/K/W — edit line',
      '  Alt+T — toggle TUI · Alt+M — open /menu · Esc — close TUI',
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
    output: 'menu/   tui/   cadence/   contact/   changes-in-progress',
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
    description: 'open draggable TUI launcher window',
    kind: 'tui' as const,
    output: 'opening TUI launcher window ... (press Esc to close)',
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
    name: 'contact',
    description: 'run inline terminal contact form (or "contact --tui" / "--help")',
    kind: 'navigate' as const,
    output: 'opening /contact ...',
    targetRoute: '/contact',
    allowedRoutes: [] as string[],
    errorTemplate: null,
    sortOrder: 6,
  },
  {
    profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
    name: 'cd',
    description: 'navigate to /menu, /cadence, /contact, or /changes-in-progress',
    kind: 'cd' as const,
    output: 'cd /{{target}}',
    targetRoute: null,
    allowedRoutes: ['menu', 'cadence', 'contact', 'changes-in-progress'],
    errorTemplate:
      'cd: no such route: {{input}}\nTry: cd menu | cd cadence | cd contact | cd changes-in-progress',
    sortOrder: 7,
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
    sortOrder: 8,
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
    sortOrder: 9,
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
    sortOrder: 10,
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
    expectedKind: 'html-sandbox',
    starterArtifactHtml: STARTER_CADENCE_ARTIFACT_HTML,
    sortOrder: 1,
  },
] as const;

const AGENSI_SKILL_SEEDS = [
  {
    slug: 'cadence-sdlc',
    name: 'CADENCE Agentic SDLC',
    summary:
      'Specification-driven multi-agent delivery framework with deterministic certainty gates.',
    tags: ['sdlc', 'agents', 'tdd'],
    url: 'https://agensi.io/creators/aklapper',
    sortOrder: 1,
  },
] as const;

const QUOTA_POLICY_SEEDS = [
  {
    role: 'guest' as const,
    maxTurnsPerSession: 5,
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

export {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  AGENSI_SKILL_SEEDS,
  CADENCE_PRESET_SEEDS,
  PORTAL_CADENCE_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
  PORTAL_MAINTENANCE_SEED,
  PORTAL_MENU_SEED,
  ROADMAP_MILESTONE_SEEDS,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_INITIAL_ENTRY_SEEDS,
  TERMINAL_PROFILE_SEEDS,
};

export async function seedDatabase(db: AppDatabase): Promise<void> {
  for (const item of DEFAULT_MENU_ITEMS) {
    await db
      .insert(menuItems)
      .values(item)
      .onConflictDoUpdate({
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
      });
  }

  for (const content of SITE_CONTENT_SEEDS) {
    await db
      .insert(siteContent)
      .values(content)
      .onConflictDoUpdate({
        target: siteContent.key,
        set: {
          markdownBody: content.markdownBody,
          metadataJson: content.metadataJson,
          updatedAt: new Date(),
        },
      });
  }

  for (const profile of TERMINAL_PROFILE_SEEDS) {
    await db
      .insert(terminalProfiles)
      .values({
        ...profile,
        quickCommands: [...profile.quickCommands],
      })
      .onConflictDoUpdate({
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
      });
  }

  for (const entry of TERMINAL_INITIAL_ENTRY_SEEDS) {
    await db
      .insert(terminalInitialEntries)
      .values(entry)
      .onConflictDoUpdate({
        target: [terminalInitialEntries.profileSlug, terminalInitialEntries.sortOrder],
        set: {
          command: entry.command,
          output: entry.output,
          status: entry.status,
          durationLabel: entry.durationLabel,
          timestampLabel: entry.timestampLabel,
        },
      });
  }

  for (const cmd of TERMINAL_COMMAND_SEEDS) {
    await db
      .insert(terminalCommands)
      .values({
        ...cmd,
        allowedRoutes: [...cmd.allowedRoutes],
      })
      .onConflictDoUpdate({
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
      });
  }

  await db.delete(roadmapMilestones).where(
    notInArray(
      roadmapMilestones.slug,
      ROADMAP_MILESTONE_SEEDS.map(milestone => milestone.slug),
    ),
  );

  for (const milestone of ROADMAP_MILESTONE_SEEDS) {
    await db
      .insert(roadmapMilestones)
      .values(milestone)
      .onConflictDoUpdate({
        target: roadmapMilestones.slug,
        set: {
          status: milestone.status,
          label: milestone.label,
          sortOrder: milestone.sortOrder,
          enabled: milestone.enabled,
        },
      });
  }

  for (const preset of CADENCE_PRESET_SEEDS) {
    await db
      .insert(cadencePresets)
      .values(preset)
      .onConflictDoUpdate({
        target: cadencePresets.slug,
        set: {
          title: preset.title,
          starterPrompt: preset.starterPrompt,
          expectedKind: preset.expectedKind,
          starterArtifactHtml: preset.starterArtifactHtml,
          sortOrder: preset.sortOrder,
        },
      });
  }

  for (const skill of AGENSI_SKILL_SEEDS) {
    await db
      .insert(agensiSkills)
      .values({
        ...skill,
        tags: [...skill.tags],
      })
      .onConflictDoUpdate({
        target: agensiSkills.slug,
        set: {
          name: skill.name,
          summary: skill.summary,
          tags: [...skill.tags],
          url: skill.url,
          sortOrder: skill.sortOrder,
        },
      });
  }

  for (const policy of QUOTA_POLICY_SEEDS) {
    await db
      .insert(quotaPolicies)
      .values(policy)
      .onConflictDoUpdate({
        target: quotaPolicies.role,
        set: {
          maxTurnsPerSession: policy.maxTurnsPerSession,
          maxTokensPerRun: policy.maxTokensPerRun,
          maxDailyGlobalTokens: policy.maxDailyGlobalTokens,
        },
      });
  }
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await seedDatabase(db);
    console.log('Postgres seed data applied successfully.');
  } finally {
    await pool.end();
  }
}
