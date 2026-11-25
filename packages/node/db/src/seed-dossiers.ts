import {
  DEFAULT_PORTAL_ASK_VISITOR_LENSES,
  type CareerDossierKind,
  type CareerDossierSection,
  type PortalAskContent,
  PortalAskContentSchema,
} from '@aklapper/core';
import { computeDenylistHash } from '@aklapper/node-runtime/privacy';

export const PORTAL_ASK_SEED: PortalAskContent = PortalAskContentSchema.parse({
  windowTitle: 'Chat with Andrew — AI Chat & Role Fit',
  statusBadge: {
    source: 'svc-ai-ask',
    state: 'idle',
    label: "On-demand · Andrew's AI",
  },
  description:
    "Chat with Andrew's AI about Andrew Klapper's engineering background, architecture patterns, and published work — or drop in for a quick conversation and evaluate role fit against published career dossiers.",
  starterQuestions: [
    'Who is Andrew Klapper and what kinds of systems does he architect?',
    'How does this portfolio combine streaming React Router SSR, Go microservices, and Qdrant?',
    'Which published Agensi skills cover engineering workflows and delivery?',
  ],
  jdPlaceholder:
    'Paste a job description to evaluate role fit against published career dossiers and portfolio evidence...',
  abstentionNotice:
    "Portfolio questions cite published records, casual chat streams live from Andrew's AI, and confidential client boundaries remain strictly enforced.",
  visitorLenses: DEFAULT_PORTAL_ASK_VISITOR_LENSES.map(lens => ({
    ...lens,
    starterQuestions: [...lens.starterQuestions],
  })),
  qaTabLabel: 'Chat with Andrew',
  jdTabLabel: 'JD Match',
  questionPlaceholder:
    "Say hi or ask Andrew's AI about his work, architecture, or anything else...",
  questionAriaLabel: "Message Andrew's AI",
  submitQaLabel: 'Send Message',
  streamingQaLabel: 'Chatting...',
  newConversationLabel: 'New Conversation',
  jdTextareaLabel: 'Paste a job description to evaluate fit against published career dossiers',
  submitJdLabel: 'Evaluate Fit',
  evaluatingJdLabel: 'Evaluating Fit...',
  emptyThreadHint:
    "Say hello, select a visitor lens, or pick a starter prompt below to chat with Andrew's AI.",
  boundaryFallbackNotice:
    'That topic falls outside published portfolio records or confidential client boundaries. Use the contact page to reach Andrew directly.',
  contactCtaLabel: 'Contact Andrew Directly',
  contactCtaHref: '/contact',
  citationsHeading: 'Grounded Sources',
  suggestedLinksHeading: 'Explore Related Sections',
  followUpsHeading: 'Suggested Follow-Ups',
  jdMatchScoreLabel: 'Overall Fit Score',
  jdStrengthsHeading: 'Verified Strengths',
  jdGapsHeading: 'Gaps or Unverified Requirements',
  jdEmptyStrengthsLabel: 'No directly verified strengths matched this description.',
  jdEmptyGapsLabel: 'No major gaps identified against published portfolio evidence.',
});

export interface CareerDossierSeedEntry {
  readonly slug: string;
  readonly kind: CareerDossierKind;
  readonly title: string;
  readonly domainLabel: string;
  readonly roleTitle: string;
  readonly timeframe: string;
  readonly skills: readonly string[];
  readonly summaryBody: string;
  readonly sectionsJson: readonly CareerDossierSection[];
  readonly publishStatus: 'published';
  readonly sanitizationVerifiedAt: Date;
  readonly denylistHash: string;
  readonly sortOrder: number;
}

const BASELINE_SEED_TIMESTAMP = new Date('2026-11-25T00:00:00.000Z');
const EMPTY_DENYLIST_HASH = computeDenylistHash([]);

export const CAREER_DOSSIER_SEEDS: readonly CareerDossierSeedEntry[] = [
  {
    slug: 'andrew-klapper-profile-core',
    kind: 'profile_core',
    title: 'Andrew Klapper — Core Engineering Profile',
    domainLabel: 'Platform Engineering & AI Systems',
    roleTitle: 'Principal Full-Stack & Platform Engineer',
    timeframe: 'Ongoing',
    skills: [
      'TypeScript',
      'React 19',
      'React Router 8 SSR',
      'Node.js',
      'Fastify',
      'Go',
      'PostgreSQL 19',
      'Drizzle ORM',
      'Qdrant',
      'Docker',
      'Cloud Run',
      'Vertex AI',
    ],
    summaryBody:
      'Andrew Klapper is a principal full-stack and platform engineer specializing in streaming TypeScript SSR applications, Go microservices, PostgreSQL 19 relational reliability, Cloud Run and Docker platforms on GCP, and grounded production AI workflows.',
    sectionsJson: [
      {
        heading: 'Core Architecture Strengths',
        body: 'Designs zero-await streaming React Router SSR frontends paired with Fastify BFFs, typed Go services on Cloud Run, fail-closed security and privacy boundaries, and reversible expand/contract PostgreSQL migrations.',
      },
      {
        heading: 'Portfolio Highlights',
        body: 'This portfolio showcases a multi-pane terminal workspace, interactive sandboxed artifact generation on /cadence, conversational AI chat and hybrid lexical plus dense vector retrieval on /chat, creator-scoped AI skills on /agensi, and direct outreach on /contact.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 0,
  },
];
