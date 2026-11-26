import { z } from 'zod';

export const DEFAULT_PORTAL_HOME_PORTRAIT_PATH = '/images/andrew-klapper-portrait.webp';

export function isValidRootRelativePortraitSrc(value: string): boolean {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    !value.includes('\\') &&
    !value.includes('..')
  );
}

export const PortalHomePortraitSchema = z.object({
  src: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .refine(
      isValidRootRelativePortraitSrc,
      'Portrait path must be a self-hosted root-relative path starting with "/".',
    ),
  alt: z.string().trim().min(1).max(200),
  caption: z.string().trim().min(1).max(120),
  width: z.number().int().min(64).max(2048),
  height: z.number().int().min(64).max(2048),
});
export type PortalHomePortrait = z.infer<typeof PortalHomePortraitSchema>;

export const PortalHomeServiceOrientationSchema = z.object({
  command: z.string().trim().min(1).max(40),
  summary: z.string().trim().min(1).max(180),
});
export type PortalHomeServiceOrientation = z.infer<typeof PortalHomeServiceOrientationSchema>;

export const PortalHomeResumeSummarySchema = z.object({
  name: z.string().trim().min(1).max(80),
  roleLine: z.string().trim().min(1).max(200),
  publicEmail: z.email(),
  githubLabel: z.string().trim().min(1).max(80),
  githubUrl: z.url({ protocol: /^https$/ }),
  bio: z.string().trim().min(1).max(800),
  highlightsHeading: z.string().trim().min(1).max(80),
  highlights: z.array(z.string().trim().min(1).max(220)).min(1).max(12),
  servicesHeading: z.string().trim().min(1).max(80),
  services: z.array(PortalHomeServiceOrientationSchema).min(1).max(10),
});
export type PortalHomeResumeSummary = z.infer<typeof PortalHomeResumeSummarySchema>;

export const DEFAULT_PORTAL_HOME_PORTRAIT: Readonly<PortalHomePortrait> = Object.freeze({
  src: DEFAULT_PORTAL_HOME_PORTRAIT_PATH,
  alt: 'Greyscale terminal portrait of Andrew Klapper',
  caption: 'andrew@andrew-k.us :: tty1',
  width: 440,
  height: 520,
});

export const DEFAULT_PORTAL_HOME_RESUME_SUMMARY: Readonly<PortalHomeResumeSummary> = Object.freeze({
  name: 'Andrew Klapper',
  roleLine: 'Senior Full-Stack & Systems Engineer · Marietta, GA',
  publicEmail: 'andrew@andrew-k.us',
  githubLabel: 'github.com/AndrewK4758',
  githubUrl: 'https://github.com/AndrewK4758',
  bio: 'Senior Full-Stack & Systems Engineer with 3+ years of experience designing, building, and shipping production web platforms, distributed Go microservices, native Linux/Android applications, and local AI/ML tooling across .NET 10 / C#, Go, TypeScript/React, C++/Qt6, PostgreSQL/MySQL, and Docker/Kubernetes/Cloud Run.',
  highlightsHeading: 'Current Work & R&D',
  highlights: [
    'Build Technology Group — Sole developer shipping a .NET 10 / C# + TypeScript laboratory hardware orchestration platform and a containerized .NET 10 / MySQL ERP modernization (40%+ query latency reduction).',
    'Gitasy — Distributed Go backend with high-concurrency WebSockets, TypeScript SPA, PostgreSQL/Redis, and automated AKS deployments.',
    'CADENCE — Provider-neutral agentic SDLC framework pairing cloud frontier models with a read-only local hardware offload stack.',
    'Ghostty Union — Native Linux Qt6 Widgets terminal emulator powered by libghostty-vt with Kitty/iTerm2 inline graphics and live system telemetry.',
    'Gemma 4 fine-tuning — Dual-GPU coding pipeline with static layer sharding, QLoRA SFT, compiler-verified DPO, online GRPO, and 32-thread compiler sandboxes.',
    'Woodstock Developers Group — Weekly instructor and mentor covering software architecture, TDD, pair programming, code reviews, and CI/CD.',
  ],
  servicesHeading: 'Portal Services',
  services: [
    {
      command: 'cadence',
      summary: 'Interactive specification-driven agentic workflow builder and artifact sandbox.',
    },
    {
      command: 'chat',
      summary: "Grounded AI Q&A and job-description match assistant over Andrew's career dossiers.",
    },
    {
      command: 'agensi',
      summary: 'Published AI agent skills and engineering workflow blueprints.',
    },
    {
      command: 'about',
      summary: 'Background, engineering timeline, and full technical profile guidance.',
    },
    {
      command: 'contact',
      summary: 'Send a direct message persisted in PostgreSQL 19 (or run contact in the terminal).',
    },
  ],
});

export function cloneDefaultPortalHomePortrait(): PortalHomePortrait {
  return { ...DEFAULT_PORTAL_HOME_PORTRAIT };
}

export function cloneDefaultPortalHomeResumeSummary(): PortalHomeResumeSummary {
  return {
    ...DEFAULT_PORTAL_HOME_RESUME_SUMMARY,
    highlights: [...DEFAULT_PORTAL_HOME_RESUME_SUMMARY.highlights],
    services: DEFAULT_PORTAL_HOME_RESUME_SUMMARY.services.map(service => ({ ...service })),
  };
}
