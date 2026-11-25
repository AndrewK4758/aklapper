import { z } from 'zod';

import { QuotaStatusSchema } from './auth.ts';
import { FormDefinitionSchema } from './forms.ts';
import { PORTAL_NAVIGABLE_ROUTE_PATHS } from './routes.ts';

export const MenuItemSchema = z.object({
  slug: z.string().min(1),
  keyShortcut: z.string().min(1).max(4),
  title: z.string().min(1),
  description: z.string(),
  targetK8sDeploy: z.string().nullable(),
  namespace: z.string().nullable(),
  adminOnly: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const Osc7501StateSchema = z.enum(['idle', 'scaling', 'running', 'gate', 'ready', 'error']);
export type Osc7501State = z.infer<typeof Osc7501StateSchema>;

export const Osc7501StatusSchema = z.object({
  source: z.string().min(1),
  state: Osc7501StateSchema,
  label: z.string().min(1),
  progress: z.number().min(0).max(100).optional(),
  timestamp: z.iso.datetime(),
});
export type Osc7501Status = z.infer<typeof Osc7501StatusSchema>;

export const K8sPodEventSchema = z.object({
  eventId: z.string().min(1),
  namespace: z.string().min(1),
  deployment: z.string().min(1),
  podName: z.string().min(1),
  phase: z.enum([
    'ScaledZero',
    'TriggeredScaleUp',
    'Pending',
    'ContainerCreating',
    'Running',
    'Terminating',
  ]),
  ready: z.boolean(),
  message: z.string(),
  timestamp: z.iso.datetime(),
});
export type K8sPodEvent = z.infer<typeof K8sPodEventSchema>;

export const CadenceRunModeSchema = z.enum(['fast', 'llm']);
export type CadenceRunMode = z.infer<typeof CadenceRunModeSchema>;

export const CadenceRunLifecycleStatusSchema = z.enum(['pending', 'running', 'ready', 'failed']);
export type CadenceRunLifecycleStatus = z.infer<typeof CadenceRunLifecycleStatusSchema>;

export const CadenceRunRequestSchema = z.object({
  prompt: z.string().trim().min(4).max(1200),
  presetSlug: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  mode: CadenceRunModeSchema.optional(),
  deferExecution: z.boolean().optional(),
});
export type CadenceRunRequest = z.infer<typeof CadenceRunRequestSchema>;

export const CadenceGateVerdictSchema = z.enum(['pending', 'approved', 'rejected']);
export type CadenceGateVerdict = z.infer<typeof CadenceGateVerdictSchema>;

export const CadenceTurnPhaseSchema = z.enum(['triage', 'spec', 'build', 'gate']);
export type CadenceTurnPhase = z.infer<typeof CadenceTurnPhaseSchema>;

export const CadenceTurnStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type CadenceTurnStatus = z.infer<typeof CadenceTurnStatusSchema>;

export const CadenceTurnPayloadValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
]);
export type CadenceTurnPayloadValue = z.infer<typeof CadenceTurnPayloadValueSchema>;

export const CadenceTurnSchema = z.object({
  id: z.number().int().positive().optional(),
  phase: CadenceTurnPhaseSchema,
  agentName: z.string().min(1),
  status: CadenceTurnStatusSchema,
  summary: z.string(),
  latencyMs: z.number().int().nonnegative(),
  payload: z.record(z.string(), CadenceTurnPayloadValueSchema).optional(),
  createdAt: z.string().optional(),
});
export type CadenceTurn = z.infer<typeof CadenceTurnSchema>;

export const CadenceRunResultSchema = z.object({
  runId: z.string().min(1),
  prompt: z.string().min(1),
  presetSlug: z.string().optional(),
  runStatus: CadenceRunLifecycleStatusSchema.optional(),
  mode: CadenceRunModeSchema.optional(),
  status: Osc7501StatusSchema.optional(),
  osc7501: z.string().optional(),
  gateVerdict: CadenceGateVerdictSchema,
  turns: z.array(CadenceTurnSchema),
  artifactHtml: z.string(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  quota: QuotaStatusSchema.optional(),
  createdAt: z.string().optional(),
});
export type CadenceRunResult = z.infer<typeof CadenceRunResultSchema>;

export const CadenceStreamPhaseEventSchema = z.object({
  runId: z.string().min(1),
  runStatus: CadenceRunLifecycleStatusSchema,
  status: Osc7501StatusSchema.optional(),
  progress: z.number().min(0).max(100).optional(),
  turn: CadenceTurnSchema,
});
export type CadenceStreamPhaseEvent = z.infer<typeof CadenceStreamPhaseEventSchema>;

export const CadenceStreamCompleteEventSchema = z.object({
  run: CadenceRunResultSchema,
  quota: QuotaStatusSchema.optional(),
});
export type CadenceStreamCompleteEvent = z.infer<typeof CadenceStreamCompleteEventSchema>;

export const CadenceStreamErrorEventSchema = z.object({
  runId: z.string().min(1),
  error: z.string().min(1),
  code: z.string().min(1).optional(),
  runStatus: CadenceRunLifecycleStatusSchema.optional(),
});
export type CadenceStreamErrorEvent = z.infer<typeof CadenceStreamErrorEventSchema>;

export const RoadmapMilestoneStatusSchema = z.enum(['done', 'active', 'queued']);
export type RoadmapMilestoneStatus = z.infer<typeof RoadmapMilestoneStatusSchema>;

export const RoadmapMilestoneSchema = z.object({
  slug: z.string().min(1),
  status: RoadmapMilestoneStatusSchema,
  label: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>;

export const StatusBadgeSpecSchema = z.object({
  source: z.string().min(1),
  state: Osc7501StateSchema,
  label: z.string().min(1),
});
export type StatusBadgeSpec = z.infer<typeof StatusBadgeSpecSchema>;

export const LinkActionSpecSchema = z.object({
  label: z.string().min(1),
  to: z.string().min(1),
  variant: z.enum(['default', 'primary']),
});
export type LinkActionSpec = z.infer<typeof LinkActionSpecSchema>;

export const PortalChromeContentSchema = z.object({
  pageTitle: z.string().min(1),
  brandLabel: z.string().min(1),
  brandContactEmail: z.string().min(1).optional(),
  shortcutHint: z.string().min(1).optional(),
  statusBadge: StatusBadgeSpecSchema,
  footerText: z.string().min(1),
  footerLinkLabel: z.string().min(1),
  footerLinkUrl: z.url(),
  maintenanceModeDefault: z.boolean(),
});
export type PortalChromeContent = z.infer<typeof PortalChromeContentSchema>;

export const PortalHomeContentSchema = z.object({
  tuiTitle: z.string().min(1),
  tuiBadge: StatusBadgeSpecSchema,
  heading: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(LinkActionSpecSchema).min(1),
});
export type PortalHomeContent = z.infer<typeof PortalHomeContentSchema>;

export const PortalMenuContentSchema = z.object({
  heading: z.string().min(1),
  description: z.string().min(1),
  localTargetLabel: z.string().min(1),
});
export type PortalMenuContent = z.infer<typeof PortalMenuContentSchema>;

export const CadencePresetSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  starterPrompt: z.string().min(1),
  expectedKind: z.string().min(1),
  starterArtifactHtml: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type CadencePreset = z.infer<typeof CadencePresetSchema>;

export const PortalCadenceContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  iframeTitle: z.string().min(1),
});
export type PortalCadenceContent = z.infer<typeof PortalCadenceContentSchema>;

export const PortalContactContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  form: FormDefinitionSchema,
});
export type PortalContactContent = z.infer<typeof PortalContactContentSchema>;

export const PortalMaintenanceContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  heading: z.string().min(1),
  lead: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
  progressAriaLabel: z.string().min(1),
  metaLeft: z.string().min(1),
  metaRight: z.string().min(1),
});
export type PortalMaintenanceContent = z.infer<typeof PortalMaintenanceContentSchema>;

export const AdminChromeContentSchema = z.object({
  pageTitle: z.string().min(1),
  brandLabel: z.string().min(1),
  shortcutHint: z.string().min(1).optional(),
  statusBadge: StatusBadgeSpecSchema,
});
export type AdminChromeContent = z.infer<typeof AdminChromeContentSchema>;

export const AdminHomeContentSchema = z.object({
  heading: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(LinkActionSpecSchema).min(1),
});
export type AdminHomeContent = z.infer<typeof AdminHomeContentSchema>;

export const AdminAnalyticsContentSchema = z.object({
  windowTitle: z.string().min(1),
  description: z.string().min(1),
});
export type AdminAnalyticsContent = z.infer<typeof AdminAnalyticsContentSchema>;

export const PortalAgensiContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  searchPlaceholder: z.string().min(1),
  emptyStateLabel: z.string().min(1),
  outboundCtaLabel: z.string().min(1),
});
export type PortalAgensiContent = z.infer<typeof PortalAgensiContentSchema>;

export const VisitorLensSchema = z.object({
  id: z.string().trim().min(1).max(48),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(240),
  starterQuestions: z.array(z.string().trim().min(1).max(240)).min(1),
});
export type VisitorLens = z.infer<typeof VisitorLensSchema>;

export const DEFAULT_PORTAL_ASK_VISITOR_LENSES: readonly VisitorLens[] = [
  {
    id: 'hiring-manager',
    label: 'Hiring Manager',
    description: 'Architecture leadership, delivery scope, and team impact.',
    starterQuestions: [
      'Who is Andrew Klapper and what kinds of systems does he architect?',
      'How has Andrew led platform modernization and multi-service cloud migrations?',
    ],
  },
  {
    id: 'engineering-peer',
    label: 'Engineering Peer',
    description: 'Deep dives on Go, TypeScript SSR, PostgreSQL 19, and Kubernetes.',
    starterQuestions: [
      'How does this portfolio combine streaming React Router SSR, Go services, and Qdrant?',
      'What concurrency and database reliability patterns does Andrew use in PostgreSQL 19?',
    ],
  },
  {
    id: 'technical-partner',
    label: 'Technical Partner',
    description: 'System boundaries, security posture, and pragmatic AI engineering.',
    starterQuestions: [
      'How does Andrew approach fail-closed security, observability, and privacy boundaries?',
      'What production AI and retrieval architectures has Andrew built?',
    ],
  },
];

export const PortalAskContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  starterQuestions: z.array(z.string().min(1)).min(1),
  jdPlaceholder: z.string().min(1),
  abstentionNotice: z.string().min(1),
  visitorLenses: z
    .array(VisitorLensSchema)
    .min(1)
    .default(
      DEFAULT_PORTAL_ASK_VISITOR_LENSES.map(lens => ({
        ...lens,
        starterQuestions: [...lens.starterQuestions],
      })),
    ),
  qaTabLabel: z.string().min(1).default('Ask Andrew Assistant'),
  jdTabLabel: z.string().min(1).default('JD Match'),
  questionPlaceholder: z
    .string()
    .min(1)
    .default("Ask about Andrew's architecture, engineering leadership, or portfolio stack..."),
  questionAriaLabel: z.string().min(1).default('Ask a question about Andrew Klapper'),
  submitQaLabel: z.string().min(1).default('Ask Assistant'),
  streamingQaLabel: z.string().min(1).default('Streaming Answer...'),
  newConversationLabel: z.string().min(1).default('New Conversation'),
  jdTextareaLabel: z
    .string()
    .min(1)
    .default('Paste a job description to evaluate fit against published career dossiers'),
  submitJdLabel: z.string().min(1).default('Evaluate Fit'),
  evaluatingJdLabel: z.string().min(1).default('Evaluating Fit...'),
  emptyThreadHint: z
    .string()
    .min(1)
    .default(
      'Select a visitor lens or starter question below to begin a grounded multi-turn conversation.',
    ),
  boundaryFallbackNotice: z
    .string()
    .min(1)
    .default(
      'That question falls outside published portfolio records or confidential client boundaries. Use the contact page to reach Andrew directly.',
    ),
  contactCtaLabel: z.string().min(1).default('Contact Andrew Directly'),
  contactCtaHref: z.enum(PORTAL_NAVIGABLE_ROUTE_PATHS).default('/contact'),
  citationsHeading: z.string().min(1).default('Grounded Sources'),
  suggestedLinksHeading: z.string().min(1).default('Explore Related Sections'),
  followUpsHeading: z.string().min(1).default('Suggested Follow-Ups'),
  jdMatchScoreLabel: z.string().min(1).default('Overall Fit Score'),
  jdStrengthsHeading: z.string().min(1).default('Verified Strengths'),
  jdGapsHeading: z.string().min(1).default('Gaps or Unverified Requirements'),
  jdEmptyStrengthsLabel: z
    .string()
    .min(1)
    .default('No directly verified strengths matched this description.'),
  jdEmptyGapsLabel: z
    .string()
    .min(1)
    .default('No major gaps identified against published portfolio evidence.'),
});
export type PortalAskContent = z.infer<typeof PortalAskContentSchema>;

export const DocumentSeoRuntimeConfigSchema = z.object({
  siteUrl: z.url(),
  analyticsEndpoint: z.string().min(1).optional(),
  gaMeasurementId: z.string().min(1).optional(),
  gtmId: z.string().min(1).optional(),
  gscVerification: z.string().min(1).optional(),
});
export type DocumentSeoRuntimeConfig = z.infer<typeof DocumentSeoRuntimeConfigSchema>;
