import { AgensiSkillSchema } from '../agensi.ts';
import type { QuotaStatus } from '../auth.ts';
import { CareerDossierSchema } from '../career-dossiers.ts';
import { CONTACT_FORM_DEFINITION } from '../forms.ts';
import type {
  PortalAboutLoaderData,
  PortalAgensiLoaderData,
  PortalAskLoaderData,
  PortalCadenceLoaderData,
  PortalContactLoaderData,
  PortalHomeLoaderData,
  PortalRootLoaderData,
} from '../loader-data.ts';
import {
  cloneDefaultPortalHomePortrait,
  cloneDefaultPortalHomeResumeSummary,
} from '../portal-home-profile.ts';
import {
  CadencePresetSchema,
  type PortalAgensiContent,
  type PortalChromeContent,
  type PortalContactContent,
  type PortalHomeContent,
} from '../portal.ts';
import { PORTAL_CHROME_SHORTCUT_HINT } from '../terminal-shortcuts.ts';
import { PORTAL_ABOUT_SEED } from './prerender-about.ts';
import { CAREER_DOSSIER_SEEDS, PORTAL_ASK_SEED } from './prerender-dossiers.ts';
import { CADENCE_PRESET_SEEDS, PORTAL_CADENCE_SEED } from './prerender-golden-defs.ts';
import { getPrerenderGoldenSandboxRuns } from './prerender-golden.ts';
import { buildSeedTerminalProfile, TERMINAL_PROFILE_SLUGS } from './prerender-terminal.ts';

export const DEFAULT_GUEST_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 10,
  tokensUsed: 0,
  maxTokens: 40_000,
};

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

export const PORTAL_HOME_ABOUT_ACTION = {
  label: 'About & Resume → /about',
  to: '/about',
  variant: 'default',
} as const;

export const PORTAL_HOME_SEED: PortalHomeContent = {
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

export const PORTAL_AGENSI_SEED: PortalAgensiContent = {
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

export const PORTAL_CONTACT_SEED: PortalContactContent = {
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

export const AGENSI_SKILL_SEEDS = [
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

export function getPrerenderPortalHomeData(): PortalHomeLoaderData {
  return {
    content: PORTAL_HOME_SEED,
    terminal: buildSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.portalHome),
    contactForm: PORTAL_CONTACT_SEED.form,
  };
}

export function getPrerenderPortalRootData(): PortalRootLoaderData {
  const { content: homeContent, terminal, contactForm } = getPrerenderPortalHomeData();
  return {
    chrome: PORTAL_CHROME_SEED,
    terminal,
    homeContent,
    contactForm,
  };
}

export function getPrerenderPortalAboutData(): PortalAboutLoaderData {
  console.info(
    JSON.stringify({
      event: 'portal.about.loader_source_branch',
      seamType: 'RULE_DIVERGENCE',
      branch: 'prerender_seed_fallback',
      dossierCount: CAREER_DOSSIER_SEEDS.length,
    }),
  );

  return {
    content: PORTAL_ABOUT_SEED,
    dossiers: CAREER_DOSSIER_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(dossier =>
      CareerDossierSchema.parse({
        slug: dossier.slug,
        kind: dossier.kind,
        title: dossier.title,
        domainLabel: dossier.domainLabel,
        roleTitle: dossier.roleTitle,
        timeframe: dossier.timeframe,
        skills: [...dossier.skills],
        summaryBody: dossier.summaryBody,
        sections: dossier.sectionsJson.map(section => ({
          heading: section.heading,
          body: section.body,
        })),
        publishStatus: dossier.publishStatus,
        sanitizationVerifiedAt: dossier.sanitizationVerifiedAt.toISOString(),
        denylistHash: dossier.denylistHash,
        sortOrder: dossier.sortOrder,
        updatedAt: dossier.sanitizationVerifiedAt.toISOString(),
      }),
    ),
    ...(PORTAL_CHROME_SEED.brandContactEmail
      ? { brandContactEmail: PORTAL_CHROME_SEED.brandContactEmail }
      : {}),
  };
}

export function getPrerenderPortalAgensiData(creatorHandle = 'aklapper'): PortalAgensiLoaderData {
  return {
    content: PORTAL_AGENSI_SEED,
    skills: AGENSI_SKILL_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(skill =>
      AgensiSkillSchema.parse({
        ...skill,
        tags: [...skill.tags],
        creatorHandle,
        isPublished: true,
        syncedAt: null,
        source: 'prerender',
      }),
    ),
    catalogMeta: {
      mode: 'prerender',
      creatorHandle,
      syncedAt: null,
    },
  };
}

export function getPrerenderPortalAskData(): PortalAskLoaderData {
  return {
    content: PORTAL_ASK_SEED,
    quota: DEFAULT_GUEST_QUOTA,
  };
}

export function getPrerenderPortalCadenceData(): PortalCadenceLoaderData {
  return {
    content: PORTAL_CADENCE_SEED,
    presets: CADENCE_PRESET_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(preset =>
      CadencePresetSchema.parse(preset),
    ),
    quota: DEFAULT_GUEST_QUOTA,
    recentRuns: [],
    goldenRuns: getPrerenderGoldenSandboxRuns(),
  };
}

export function getPrerenderPortalContactData(): PortalContactLoaderData {
  return {
    content: PORTAL_CONTACT_SEED,
  };
}
