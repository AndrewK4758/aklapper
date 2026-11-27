import {
  ADMIN_CHROME_SHORTCUT_HINT,
  type AdminAnalyticsContent,
  type AdminChromeContent,
  type AdminHomeContent,
  type MenuItem,
  type TerminalProfileData,
} from '@aklapper/core';
import {
  AGENSI_SKILL_SEEDS,
  buildSeedTerminalProfile,
  CADENCE_PRESET_SEEDS,
  CAREER_DOSSIER_SEEDS,
  type CareerDossierSeedEntry,
  PORTAL_ABOUT_SEED,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CHROME_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_ABOUT_ACTION,
  PORTAL_HOME_SEED,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_INITIAL_ENTRY_SEEDS,
  TERMINAL_PROFILE_SEEDS,
  TERMINAL_PROFILE_SLUGS,
} from '@aklapper/core/prerender';
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
import { SITE_CONTENT_KEYS } from './queries.ts';
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
import { seedAdminUserFromEnv, type SeedAdminUserResult } from './seed-admin.ts';
import { CADENCE_GOLDEN_RUN_SEEDS } from './seed-golden-runs.ts';

export { buildSeedTerminalProfile, PORTAL_CHROME_SEED };

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

const RETIRED_PLACEHOLDER_SKILL_SLUGS = [
  'cadence-sdlc',
  'gke-scale-to-zero-go',
  'grounded-qdrant-rag',
  'solar-forge-react-ssr',
  'pg19-quota-guardrails',
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
