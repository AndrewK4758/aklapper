import { type PortalAboutContent, PortalAboutContentSchema } from '@aklapper/core';

export const PORTAL_ABOUT_SEED: PortalAboutContent = PortalAboutContentSchema.parse({
  windowTitle: 'About Andrew Klapper // Resume & Services',
  statusBadge: {
    source: 'portal-about',
    state: 'ready',
    label: 'Sanitized Profile',
  },
  description:
    'Senior Full-Stack & Systems Engineer delivering production web platforms, distributed Go microservices, native Linux/Android applications, and local AI/ML tooling.',
  identity: {
    fullName: 'Andrew Klapper',
    roleHeadline: 'Senior Full-Stack & Systems Engineer',
    location: 'Marietta, GA',
    githubLabel: 'github.com/AndrewK4758',
    githubUrl: 'https://github.com/AndrewK4758',
    websiteLabel: 'andrew-k.us',
    websiteUrl: 'https://andrew-k.us',
  },
  portrait: {
    alt: 'Andrew Klapper — greyscale terminal portrait',
    caption: 'Andrew Klapper · Senior Full-Stack & Systems Engineer · Marietta, GA',
    ttyLabel: 'portrait // greyscale',
  },
  skillsHeading: 'Technical Skills',
  skillGroups: [
    {
      category: 'Languages',
      skills: ['C# (.NET 10)', 'Go (1.26+)', 'TypeScript', 'C/C++', 'Kotlin', 'Python', 'SQL'],
    },
    {
      category: 'Frontend & Native UI',
      skills: [
        'React',
        'SPA Routing',
        'State Management',
        'Qt6 Widgets (libghostty-vt)',
        'Android SDK / Mozilla GeckoView',
      ],
    },
    {
      category: 'Backend & Distributed Systems',
      skills: [
        'ASP.NET Core',
        'Entity Framework Core',
        'gRPC',
        'Protobuf',
        'NATS JetStream',
        'REST',
        'WebSockets',
        'Hangfire',
        'Bazel',
      ],
    },
    {
      category: 'Data & AI/ML',
      skills: [
        'PostgreSQL',
        'MySQL',
        'Redis',
        'Qdrant',
        'llama.cpp / GGUF',
        'PyTorch (QLoRA / DPO / GRPO)',
        'FastMCP',
        'Agentic Workflows',
      ],
    },
    {
      category: 'Cloud & DevOps',
      skills: [
        'Docker',
        'Kubernetes (AKS)',
        'GitHub Actions CI/CD',
        'GCP',
        'Azure',
        'AWS',
        'Linux',
        'Git',
        'TDD',
      ],
    },
  ],
  experienceHeading: 'Experience',
  projectsHeading: 'Independent R&D & Open-Source Projects',
  communityHeading: 'Community & Education',
  education: [
    {
      institution: 'Kennesaw State University',
      location: 'Kennesaw, GA',
      program: 'Professional Sales (29 credits completed)',
    },
  ],
  servicesHeading: 'Platform Services Guide',
  servicesIntro:
    'Explore live interactive applications built into this workspace — open any service in-pane or launch it alongside your terminal in a split or tab.',
  services: [
    {
      id: 'chat',
      title: 'Chat with Andrew',
      to: '/chat',
      badge: 'AI + JD Match',
      summary:
        "Chat with Andrew's AI grounded in published career dossiers, or paste a job description to evaluate role fit with verified citations.",
      ctaLabel: 'Open Chat →',
    },
    {
      id: 'agensi',
      title: 'Agensi Storefront',
      to: '/agensi',
      badge: 'Published Skills',
      summary:
        'Browse published commercial AI agent skills, engineering workflows, and operational blueprints synced from agensi.io.',
      ctaLabel: 'Open Agensi →',
    },
    {
      id: 'cadence',
      title: 'CADENCE Builder',
      to: '/cadence',
      badge: 'Interactive Sandbox',
      summary:
        'Run multi-stage spec-driven artifact synthesis and inspect structured specifications, generated HTML previews, and gate audits.',
      ctaLabel: 'Open CADENCE →',
    },
  ],
  contactCtaLabel: 'Contact Andrew Directly',
  contactCtaHref: '/contact',
  emptyDossiersNotice:
    'Published career dossiers are currently being refreshed. Explore the services below or reach out via Contact.',
});
