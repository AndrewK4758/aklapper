import {
  CANONICAL_PROBE_SCRIPT,
  MAX_CADENCE_ARTIFACT_BYTES,
  type SanitizedCadenceArtifact,
  STRICT_SANDBOX_CSP_META,
  escapeCadenceHtml,
  sanitizeCadenceArtifactHtml,
} from './cadence-html-sanitizer.ts';
import { type CadencePreset } from './portal.ts';

export {
  CANONICAL_PROBE_SCRIPT,
  MAX_CADENCE_ARTIFACT_BYTES,
  STRICT_SANDBOX_CSP_META,
  escapeCadenceHtml,
  sanitizeCadenceArtifactHtml,
  type SanitizedCadenceArtifact,
};

export interface TailoredCadenceArtifactInput {
  readonly prompt: string;
  readonly preset?: Pick<CadencePreset, 'slug' | 'title' | 'expectedKind'> | null;
  readonly recalledPatterns?: readonly string[];
}

const KEYWORD_KINDS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['pod-telemetry', ['pod', 'gke', 'replica']],
  ['pipeline-monitor', ['pipeline', 'chord', 'latency']],
  ['rag-inspector', ['qdrant', 'rag', 'vector']],
  ['security-gate', ['hmac', 'gate', 'zero-trust']],
];

function resolveArtifactKind(
  preset: Pick<CadencePreset, 'slug' | 'title' | 'expectedKind'> | null | undefined,
  prompt: string,
): string {
  const kind = preset?.expectedKind?.trim();
  if (kind && kind !== 'html-sandbox') return kind;
  const slug = preset?.slug?.trim() ?? '';
  if (slug === 'k8s-pod-telemetry') return 'pod-telemetry';
  if (slug === 'chord-pipeline-monitor') return 'pipeline-monitor';
  if (slug === 'qdrant-rag-inspector') return 'rag-inspector';
  if (slug === 'zero-trust-gate-panel') return 'security-gate';
  if (slug === 'solar-forge-starter') return 'diagnostic-card';

  const lower = prompt.toLowerCase();
  return KEYWORD_KINDS.find(([, keys]) => keys.some(k => lower.includes(k)))?.[0] ?? 'custom';
}

interface ArtifactCardModel {
  readonly heading: string;
  readonly badge: string;
  readonly metric1Label: string;
  readonly metric1Value: string;
  readonly metric2Label: string;
  readonly metric2Value: string;
  readonly actionLabel: string;
  readonly probePrefix: string;
}

const DEFAULT_ARTIFACT_CARD_MODEL: ArtifactCardModel = {
  heading: 'Custom CADENCE Artifact',
  badge: 'CUSTOM PROMPT // TAILORED BUILD',
  metric1Label: 'Execution Mode',
  metric1Value: 'triage -> spec -> build -> gate',
  metric2Label: 'Boundary',
  metric2Value: 'isolated allow-scripts',
  actionLabel: 'Verify Custom Artifact',
  probePrefix: 'custom check verified',
};

const ARTIFACT_CARD_MODELS: Readonly<Record<string, ArtifactCardModel>> = {
  'pod-telemetry': {
    heading: 'GKE Pod Telemetry Widget',
    badge: 'GKE AUTOPILOT // SCALE-TO-ZERO',
    metric1Label: 'Replica State',
    metric1Value: '0 -> 1 warm probe',
    metric2Label: 'Isolation',
    metric2Value: 'sandbox="allow-scripts"',
    actionLabel: 'Simulate Scale Wake Probe',
    probePrefix: 'replica=1 ready',
  },
  'pipeline-monitor': {
    heading: 'CHORD Pipeline Latency Monitor',
    badge: 'CHORD PIPELINE // FAST STREAM',
    metric1Label: 'Stages',
    metric1Value: 'triage -> spec -> build -> gate',
    metric2Label: 'Target SLA',
    metric2Value: '<3s end-to-end',
    actionLabel: 'Step Phase Latency Check',
    probePrefix: 'phases=4/4 nominal',
  },
  'rag-inspector': {
    heading: 'Qdrant Grounded RAG Inspector',
    badge: 'QDRANT // COSINE ABSTENTION',
    metric1Label: 'Similarity Gate',
    metric1Value: '>= 0.72 grounded floor',
    metric2Label: 'Recall Cap',
    metric2Value: '250ms fail-soft',
    actionLabel: 'Run Similarity Threshold Probe',
    probePrefix: 'abstain-guard active',
  },
  'security-gate': {
    heading: 'Zero-Trust Gate Audit Panel',
    badge: 'SECURITY GATE // HMAC + COOKIE',
    metric1Label: 'Cookie Boundary',
    metric1Value: 'HttpOnly session isolation',
    metric2Label: 'HTML Policy',
    metric2Value: '48 KiB sanitized',
    actionLabel: 'Verify Sandbox Boundary',
    probePrefix: 'origin=opaque',
  },
  'diagnostic-card': {
    heading: 'Solar Forge Sandbox Starter',
    badge: 'SOLAR FORGE // DIAGNOSTIC',
    metric1Label: 'Pipeline',
    metric1Value: 'triage -> spec -> build -> gate',
    metric2Label: 'Sandbox',
    metric2Value: 'no allow-same-origin',
    actionLabel: 'Run Sandbox Self-Check',
    probePrefix: 'sandbox active',
  },
};

function resolveArtifactModel(kind: string, title: string): ArtifactCardModel {
  const base = ARTIFACT_CARD_MODELS[kind] ?? DEFAULT_ARTIFACT_CARD_MODEL;
  return title ? { ...base, heading: title } : base;
}

export function buildTailoredCadenceArtifactHtml(input: TailoredCadenceArtifactInput): string {
  const kind = resolveArtifactKind(input.preset, input.prompt);
  const model = resolveArtifactModel(kind, input.preset?.title?.trim() ?? '');
  const safeSlug = escapeCadenceHtml(input.preset?.slug?.trim() || 'custom');
  const safePrompt = escapeCadenceHtml(input.prompt.trim());
  const safeHeading = escapeCadenceHtml(model.heading);
  const safeBadge = escapeCadenceHtml(model.badge);
  const safeKind = escapeCadenceHtml(kind);
  const safePrefix = escapeCadenceHtml(model.probePrefix);
  const patterns = input.recalledPatterns ?? [];
  const patternNote =
    patterns.length > 0
      ? `Qdrant patterns: ${escapeCadenceHtml(patterns.join(', '))}`
      : 'Local deterministic CHORD template';

  const rawHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeHeading}</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #121110; color: #f4efe6; padding: 1.25rem; }
  .shell { border: 1px solid #d97706; border-radius: 6px; padding: 1rem; background: #1c1a17; max-width: 44rem; }
  .badge { color: #f59e0b; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  h1 { margin: 0.65rem 0 0.4rem; font-size: 1.05rem; color: #ffd300; }
  p { color: #c7bfb2; line-height: 1.5; margin: 0.35rem 0; font-size: 0.85rem; }
  .prompt { border-left: 2px solid #f59e0b; padding-left: 0.6rem; color: #f4efe6; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.6rem; margin-top: 0.9rem; }
  .metric { border: 1px solid #3c3730; border-radius: 4px; padding: 0.6rem; background: #141311; }
  .metric strong { display: block; color: #22c55e; font-size: 0.88rem; margin-top: 0.25rem; }
  .btn { margin-top: 0.9rem; background: #ffd300; color: #121110; border: 0; border-radius: 4px; padding: 0.4rem 0.75rem; font: inherit; font-weight: 700; cursor: pointer; }
</style>
</head>
<body data-artifact-kind="${safeKind}" data-preset-slug="${safeSlug}">
  <main class="shell">
    <div class="badge"><span>${safeBadge}</span><span>preset: ${safeSlug}</span></div>
    <h1>${safeHeading}</h1>
    <p class="prompt">${safePrompt}</p>
    <p>${patternNote}</p>
    <section class="grid">
      <div class="metric"><span>${escapeCadenceHtml(model.metric1Label)}</span><strong>${escapeCadenceHtml(model.metric1Value)}</strong></div>
      <div class="metric"><span>${escapeCadenceHtml(model.metric2Label)}</span><strong>${escapeCadenceHtml(model.metric2Value)}</strong></div>
      <div class="metric"><span>Probe</span><strong id="probe-val" data-probe-prefix="${safePrefix}">${safePrefix}</strong></div>
    </section>
    <button class="btn" id="ping-btn" type="button">${escapeCadenceHtml(model.actionLabel)}</button>
  </main>
  <script>${CANONICAL_PROBE_SCRIPT}</script>
</body>
</html>`;

  return sanitizeCadenceArtifactHtml(rawHtml).html;
}
