import type { CareerDossierKind, CareerDossierSection } from '../career-dossiers.ts';
import {
  DEFAULT_PORTAL_ASK_VISITOR_LENSES,
  type PortalAskContent,
  PortalAskContentSchema,
} from '../portal.ts';

// SHA-256 hex digest of canonical empty JSON denylist ("[]").
export const EMPTY_DENYLIST_HASH =
  '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945';

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

const BASELINE_SEED_TIMESTAMP = new Date('2026-11-26T00:00:00.000Z');

export const CAREER_DOSSIER_SEEDS: readonly CareerDossierSeedEntry[] = [
  {
    slug: 'andrew-klapper-profile-core',
    kind: 'profile_core',
    title: 'Andrew Klapper — Professional Summary & Core Profile',
    domainLabel: 'Full-Stack, Systems & AI Engineering',
    roleTitle: 'Senior Full-Stack & Systems Engineer',
    timeframe: '3+ Years Production Experience',
    skills: [
      'C# (.NET 10)',
      'Go (1.26+)',
      'TypeScript',
      'React',
      'C/C++',
      'Qt6',
      'Kotlin',
      'Python',
      'PostgreSQL',
      'MySQL',
      'Redis',
      'Qdrant',
      'Docker',
      'Kubernetes (AKS)',
      'GCP',
    ],
    summaryBody:
      'Senior Full-Stack and Systems Engineer with 3+ years of experience designing, building, and shipping production web platforms, distributed Go microservices, native Linux/Android applications, and local AI/ML tooling. Strong background in .NET 10 (C#), Go, TypeScript, C++/Qt6, relational database optimization, Docker/Kubernetes, and CI/CD automation.',
    sectionsJson: [
      {
        heading: 'Core Architecture Strengths',
        body: 'Designs zero-await streaming React Router SSR frontends paired with Fastify BFFs, .NET 10 and Go backend services, fail-closed security and privacy boundaries, relational query optimization, and automated Docker/Kubernetes CI/CD pipelines.',
      },
      {
        heading: 'Portfolio Services & Education',
        body: 'This portfolio offers a multi-pane terminal workspace featuring /about (sanitized resume and services guide), /chat (grounded AI chat and JD Match), /agensi (published AI skills storefront), /cadence (interactive workflow sandbox), and /contact. Education: Kennesaw State University (Kennesaw, GA) — Professional Sales (29 credits completed).',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 0,
  },
  {
    slug: 'btg-software-engineer',
    kind: 'experience',
    title: 'Software Engineer | Build Technology Group',
    domainLabel: 'Hardware Orchestration & ERP Modernization',
    roleTitle: 'Software Engineer',
    timeframe: 'Present',
    skills: [
      'C# (.NET 10)',
      'ASP.NET Core',
      'Entity Framework Core',
      'TypeScript',
      'MySQL',
      'Hangfire',
      'Docker',
      'CI/CD',
    ],
    summaryBody:
      'Architected and delivered full-stack laboratory hardware orchestration and containerized ERP modernization platforms as sole developer under peer-reviewed PR and automated CI/CD workflows.',
    sectionsJson: [
      {
        heading: 'Hardware Interfacing Platform',
        body: 'Architected and delivered a full-stack laboratory hardware orchestration platform as sole developer under peer-reviewed PR and CI workflows. Built a .NET 10 (C#) REST API interfacing directly with diagnostic machinery, managing calibration state, robotic execution sequences, and regulatory audit trails. Engineered a TypeScript SPA dashboard for real-time hardware monitoring, configuration, and state-driven control.',
      },
      {
        heading: 'Legacy ERP Modernization',
        body: 'Modernized a legacy PHP monolith into a containerized .NET 10 ERP platform as sole developer with automated CI/CD. Re-architected MySQL data access in Entity Framework Core, eliminating N+1 bottlenecks with connection pooling and compiled queries for a 40%+ query latency reduction. Built asynchronous background processing pipelines using Hangfire and multi-stage Docker builds for invoicing, inbound document routing, PDF generation, and payment reconciliation.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 10,
  },
  {
    slug: 'gitasy-software-engineer',
    kind: 'experience',
    title: 'Software Engineer | Gitasy',
    domainLabel: 'Real-Time Distributed Systems',
    roleTitle: 'Software Engineer',
    timeframe: 'Present',
    skills: [
      'Go',
      'WebSockets',
      'TypeScript',
      'PostgreSQL',
      'Redis',
      'Docker',
      'Kubernetes (AKS)',
      'GitHub Actions',
    ],
    summaryBody:
      'Engineered a distributed Go backend for a real-time daily fantasy sports platform, handling high-concurrency WebSocket connections for live drafts and notifications alongside a TypeScript SPA, PostgreSQL/Redis persistence, and automated AKS deployments.',
    sectionsJson: [
      {
        heading: 'Distributed Backend & Delivery',
        body: 'Engineered a distributed Go backend for a real-time daily fantasy sports platform, handling high-concurrency WebSocket connections for live drafts and notifications. Built the TypeScript SPA frontend, PostgreSQL schema, and Redis caching layer. Automated testing, Docker image builds, and deployments to Azure Kubernetes Service (AKS) via GitHub Actions.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 20,
  },
  {
    slug: 'shipping-services-logistics-owner',
    kind: 'experience',
    title: 'Owner | Shipping Services & Logistics LLC',
    domainLabel: 'Freight Brokerage & Operations Automation',
    roleTitle: 'Owner',
    timeframe: 'Sept 2019 - Dec 2022 | Marietta, GA',
    skills: ['Logistics Operations', 'Client Relations', 'CRM Automation', 'Document Workflows'],
    summaryBody:
      'Owned and operated a freight brokerage in Marietta, GA, managing logistics operations, client relationships, and CRM/document automation workflows.',
    sectionsJson: [
      {
        heading: 'Brokerage Operations & Automation',
        body: 'Managed end-to-end freight brokerage operations, client and carrier relationships, and automated CRM and shipping document workflows.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 30,
  },
  {
    slug: 'cadence-agentic-sdlc',
    kind: 'project',
    title: 'CADENCE - Agentic SDLC & Local Coprocessor Framework',
    domainLabel: 'Agentic Engineering & Local AI Tooling',
    roleTitle: 'Creator & Architect',
    timeframe: 'Independent R&D',
    skills: ['Python', 'FastMCP', 'llama.cpp', 'llama-swap', 'Agentic Workflows'],
    summaryBody:
      'Designed a provider-neutral agentic SDLC framework pairing cloud frontier models with a read-only local hardware offload stack for semantic code search, log triage, and pre-PR review.',
    sectionsJson: [
      {
        heading: 'Local Hardware Offload Stack',
        body: 'Combines provider-neutral specification and verification workflows with a strictly read-only local coprocessor built on Python, FastMCP, llama.cpp, and llama-swap for AST-aware semantic discovery, build/test log compaction, and pre-PR architectural review.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 40,
  },
  {
    slug: 'ghostty-union-terminal',
    kind: 'project',
    title: 'Ghostty Union - Native Linux Terminal Emulator',
    domainLabel: 'Native Desktop & Terminal Graphics',
    roleTitle: 'Creator',
    timeframe: 'Open-Source Project',
    skills: ['C++', 'Qt6', 'libghostty-vt', 'CMake', 'Linux'],
    summaryBody:
      'Built a Qt6 Widgets terminal powered by libghostty-vt 1.0+ with Kitty Graphics Protocol and iTerm2 inline image rendering, 5-layer HiDPI compositing, drag-and-drop split trees, and a live system telemetry bar (github.com/AndrewK4758/ghostty-union).',
    sectionsJson: [
      {
        heading: 'Graphics Protocol & Split Compositing',
        body: 'Integrates libghostty-vt 1.0+ with Kitty Graphics Protocol and iTerm2 inline image rendering, 5-layer HiDPI compositing, drag-and-drop split pane trees, and a live system telemetry bar. Source: github.com/AndrewK4758/ghostty-union.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 50,
  },
  {
    slug: 'gemma-4-dual-gpu-finetuning',
    kind: 'project',
    title: 'Gemma 4 Dual-GPU Coding Fine-Tuning Pipeline',
    domainLabel: 'Applied ML & Post-Training Systems',
    roleTitle: 'Creator',
    timeframe: 'Independent R&D',
    skills: ['Python', 'PyTorch', 'CUDA', 'GGUF / vLLM', 'QLoRA / DPO / GRPO'],
    summaryBody:
      'Built an end-to-end training and export pipeline for asymmetric dual-GPU workstations using static layer sharding, bfloat16/NF4 QLoRA SFT, compiler-verified DPO, online GRPO, and 32-thread compiler sandboxes (tsc, go, .NET 10, gcc).',
    sectionsJson: [
      {
        heading: 'Post-Training & Compiler Verification',
        body: 'Implements static layer sharding across asymmetric workstation GPUs, bfloat16/NF4 QLoRA supervised fine-tuning, compiler-verified DPO, online GRPO reinforcement learning using 32-thread sandboxes (tsc, go, .NET 10, gcc), and GGUF/vLLM export workflows.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 60,
  },
  {
    slug: 'distributed-ai-document-ecosystem',
    kind: 'architecture',
    title: 'Distributed AI Document Processing Ecosystem',
    domainLabel: 'Distributed Systems & Document AI',
    roleTitle: 'Systems Architect',
    timeframe: 'Independent R&D',
    skills: ['Go 1.26+', 'gRPC', 'Protobuf', 'NATS JetStream', 'Qdrant', 'Bazel'],
    summaryBody:
      'Architected a stateless gRPC and NATS JetStream DAG workflow orchestrator with multi-tenant isolation, LLM/Vision inference workers, a two-tier Qdrant semantic cache, document chunking, human-in-the-loop escalation, and an event-driven audit ledger.',
    sectionsJson: [
      {
        heading: 'DAG Orchestration & Semantic Cache',
        body: 'Built stateless Go 1.26+ gRPC and Protobuf services orchestrated over NATS JetStream DAGs with Bazel builds, providing multi-tenant isolation, LLM and Vision workers, a two-tier Qdrant semantic cache, chunking pipelines, human-in-the-loop escalation, and an event-driven audit ledger.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 70,
  },
  {
    slug: 'antigravity-android-blitz-oss',
    kind: 'project',
    title: 'Antigravity Remote Android & Blitz Contributor',
    domainLabel: 'Mobile Systems & Open-Source Agents',
    roleTitle: 'Creator & Contributor',
    timeframe: 'Open-Source Projects',
    skills: ['Kotlin', 'Mozilla GeckoView', 'Gradle', 'Go', 'Google ADK'],
    summaryBody:
      'Built a standalone Android app embedding Mozilla GeckoView for persistent remote sessions (github.com/AndrewK4758/Antigravity-Android-Wrapper); contributed to Blitz (github.com/retail-cortex/blitz), a Go coding agent built on Google ADK.',
    sectionsJson: [
      {
        heading: 'Android Client & Go Coding Agent',
        body: 'Created a standalone Kotlin and Gradle Android client embedding Mozilla GeckoView for persistent remote sessions (github.com/AndrewK4758/Antigravity-Android-Wrapper) and contributed to Blitz (github.com/retail-cortex/blitz), a Go coding agent built on Google ADK.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 80,
  },
  {
    slug: 'woodstock-developers-group-mentor',
    kind: 'leadership',
    title: 'Instructor & Mentor | Woodstock Developers Group',
    domainLabel: 'Engineering Community & Mentorship',
    roleTitle: 'Instructor & Mentor',
    timeframe: 'Jan 2023 - Present | Woodstock, GA',
    skills: [
      'Software Architecture',
      'TDD',
      'Agile/Scrum',
      'Pair Programming',
      'Code Reviews',
      'CI/CD',
    ],
    summaryBody:
      'Lead weekly sessions on software architecture, TDD, Agile/Scrum workflows, pair programming, code reviews, and CI/CD in Woodstock, GA.',
    sectionsJson: [
      {
        heading: 'Weekly Engineering Mentorship',
        body: 'Guides developers in weekly hands-on sessions covering software architecture, test-driven development, Agile/Scrum workflows, pair programming, code reviews, and CI/CD automation.',
      },
    ],
    publishStatus: 'published',
    sanitizationVerifiedAt: BASELINE_SEED_TIMESTAMP,
    denylistHash: EMPTY_DENYLIST_HASH,
    sortOrder: 90,
  },
];
