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

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'build',
  'by',
  'card',
  'for',
  'from',
  'in',
  'interactive',
  'is',
  'it',
  'of',
  'on',
  'or',
  'show',
  'that',
  'the',
  'this',
  'to',
  'widget',
  'with',
]);

export function extractCadencePromptKeywords(prompt: string, maxCount = 6): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w));
  const unique: string[] = [];
  for (const w of words) {
    if (!unique.includes(w)) {
      unique.push(w);
      if (unique.length >= maxCount) break;
    }
  }
  return unique;
}

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

interface InteractiveArtifactSpec {
  readonly heading: string;
  readonly badge: string;
  readonly tab1Label: string;
  readonly tab2Label: string;
  readonly tab3Label: string;
  readonly tab1Body: string;
  readonly tab2Body: string;
  readonly tab3Body: string;
  readonly actionLabel: string;
  readonly probePrefix: string;
}

function buildInteractiveSpec(
  kind: string,
  presetTitle: string,
  safePrompt: string,
  patterns: readonly string[],
  rawPrompt: string,
): InteractiveArtifactSpec {
  const patternList =
    patterns.length > 0
      ? patterns.map(p => `<span class="pill">${escapeCadenceHtml(p)}</span>`).join('')
      : '<span class="pill">deterministic-interactive</span>';

  switch (kind) {
    case 'pod-telemetry':
      return {
        heading: presetTitle || 'GKE Pod Telemetry Widget',
        badge: 'GKE AUTOPILOT // SCALE-TO-ZERO',
        tab1Label: 'Lifecycle 0 -> 1',
        tab2Label: 'OSC 7501 Stream',
        tab3Label: 'Autopilot Quotas',
        tab1Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Replica State</span><strong>0 -> 1 Ready</strong></div>
            <div class="kpi"><span>Cold Wake</span><strong>940 ms</strong></div>
            <div class="kpi"><span>Idle TTL</span><strong>15 min</strong></div>
          </div>
          <div class="bars">
            <div class="bar-row"><span>Scale Request</span><div class="track"><div class="fill w15"></div></div><em>120ms</em></div>
            <div class="bar-row"><span>Node + Image</span><div class="track"><div class="fill w65"></div></div><em>610ms</em></div>
            <div class="bar-row"><span>Readiness</span><div class="track"><div class="fill w25"></div></div><em>210ms</em></div>
          </div>`,
        tab2Body: `
          <table class="tbl">
            <thead><tr><th>Seq</th><th>Source</th><th>State</th><th>Progress</th></tr></thead>
            <tbody>
              <tr><td>#1</td><td>svc-cadence-demo</td><td class="ok">scaling</td><td>25%</td></tr>
              <tr><td>#2</td><td>svc-cadence-demo</td><td class="warn">warming</td><td>65%</td></tr>
              <tr><td>#3</td><td>svc-cadence-demo</td><td class="ok">ready</td><td>100%</td></tr>
            </tbody>
          </table>
          <details class="fold"><summary>Inspect OSC 7501 Frame Contract</summary><p>Terminal header badges subscribe to SSE cluster events and render real-time replica transitions without polling.</p></details>`,
        tab3Body: `
          <div class="bars">
            <div class="bar-row"><span>CPU Request</span><div class="track"><div class="fill w35"></div></div><em>250m / 1000m</em></div>
            <div class="bar-row"><span>Memory</span><div class="track"><div class="fill w50"></div></div><em>256Mi / 512Mi</em></div>
            <div class="bar-row"><span>Session Turns</span><div class="track"><div class="fill w20"></div></div><em>Quota Gated</em></div>
          </div>
          <p class="note">Autopilot scales idle demo pods back to zero replicas after inactivity while keeping PostgreSQL state durable.</p>`,
        actionLabel: 'Simulate Scale Wake Probe',
        probePrefix: 'replica=1 ready',
      };

    case 'pipeline-monitor':
      return {
        heading: presetTitle || 'CHORD Pipeline Latency Monitor',
        badge: 'CHORD PIPELINE // 4-PHASE STREAM',
        tab1Label: 'Waterfall',
        tab2Label: 'Phase Contracts',
        tab3Label: 'SLA Budget',
        tab1Body: `
          <div class="bars">
            <div class="bar-row"><span>1. TRIAGE</span><div class="track"><div class="fill w10"></div></div><em>2ms</em></div>
            <div class="bar-row"><span>2. SPEC</span><div class="track"><div class="fill w30"></div></div><em>48ms</em></div>
            <div class="bar-row"><span>3. BUILD</span><div class="track"><div class="fill w85"></div></div><em>410ms</em></div>
            <div class="bar-row"><span>4. GATE</span><div class="track"><div class="fill w15"></div></div><em>3ms</em></div>
          </div>
          <div class="pills">${patternList}</div>`,
        tab2Body: `
          <details class="fold" open><summary>TRIAGE -> SPEC</summary><p>Classifies prompt intent, enforces guest quota, and queries Qdrant for bounded architectural patterns.</p></details>
          <details class="fold"><summary>BUILD -> GATE</summary><p>Synthesizes self-contained HTML/CSS, injects strict CSP meta, strips unsafe tags, and awaits operator verdict.</p></details>`,
        tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Fast Mode SLA</span><strong>&lt; 1.5s</strong></div>
            <div class="kpi"><span>Live LLM SLA</span><strong>&lt; 25s</strong></div>
            <div class="kpi"><span>Artifact Cap</span><strong>48 KiB</strong></div>
          </div>
          <p class="note">Each stage persists durable turn telemetry to Postgres so page reloads replay completed SSE frames.</p>`,
        actionLabel: 'Step Phase Latency Check',
        probePrefix: 'phases=4/4 nominal',
      };

    case 'rag-inspector':
      return {
        heading: presetTitle || 'Qdrant Grounded RAG Inspector',
        badge: 'QDRANT // COSINE ABSTENTION',
        tab1Label: 'Score Bands',
        tab2Label: 'Retrieved Chunks',
        tab3Label: 'Abstention Guard',
        tab1Body: `
          <div class="bars">
            <div class="bar-row"><span>Grounded (&gt;=0.72)</span><div class="track"><div class="fill w85"></div></div><em>0.84 PASS</em></div>
            <div class="bar-row"><span>Borderline (0.55)</span><div class="track"><div class="fill warn-fill w55"></div></div><em>0.61 WARN</em></div>
            <div class="bar-row"><span>Abstain (&lt;0.55)</span><div class="track"><div class="fill err-fill w30"></div></div><em>0.38 STOP</em></div>
          </div>
          <p class="note">768-dim embeddinggemma-2 vectors enforce a strict cosine floor before any synthesis runs.</p>`,
        tab2Body: `
          <table class="tbl">
            <thead><tr><th>Collection</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>cadence_patterns</td><td>0.86</td><td class="ok">grounded</td></tr>
              <tr><td>portfolio_dossiers</td><td>0.79</td><td class="ok">grounded</td></tr>
              <tr><td>unmatched_query</td><td>0.41</td><td class="err">abstained</td></tr>
            </tbody>
          </table>
          <div class="pills">${patternList}</div>`,
        tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Cosine Floor</span><strong>0.72</strong></div>
            <div class="kpi"><span>Recall Cap</span><strong>250ms fail-soft</strong></div>
            <div class="kpi"><span>Hallucination</span><strong>Fail-Closed</strong></div>
          </div>
          <details class="fold"><summary>Why fail-closed abstention matters</summary><p>If no vector chunk clears the similarity floor, the service returns grounded: false instead of fabricating claims.</p></details>`,
        actionLabel: 'Run Similarity Threshold Probe',
        probePrefix: 'abstain-guard active',
      };

    case 'security-gate':
      return {
        heading: presetTitle || 'Zero-Trust Gate Audit Panel',
        badge: 'SECURITY GATE // CSP + SANDBOX',
        tab1Label: 'CSP Directives',
        tab2Label: 'Blocked Vectors',
        tab3Label: 'Session Boundary',
        tab1Body: `
          <table class="tbl">
            <thead><tr><th>Directive</th><th>Policy</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>default-src</td><td>'none'</td><td class="ok">LOCKED</td></tr>
              <tr><td>script-src</td><td>sha256-hash only</td><td class="ok">LOCKED</td></tr>
              <tr><td>style-src</td><td>'unsafe-inline' (sanitized)</td><td class="ok">SAFE</td></tr>
              <tr><td>base-uri / form</td><td>'none'</td><td class="ok">LOCKED</td></tr>
            </tbody>
          </table>`,
        tab2Body: `
          <table class="tbl">
            <thead><tr><th>Vector</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td>&lt;iframe&gt; / &lt;object&gt; / &lt;svg&gt;</td><td class="err">STRIPPED</td></tr>
              <tr><td>Arbitrary &lt;script&gt; / on* attrs</td><td class="err">STRIPPED</td></tr>
              <tr><td>javascript: / data: / @import</td><td class="err">BLOCKED</td></tr>
              <tr><td>&lt;meta http-equiv="refresh"&gt;</td><td class="err">STRIPPED</td></tr>
            </tbody>
          </table>`,
        tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Iframe Sandbox</span><strong>allow-scripts only</strong></div>
            <div class="kpi"><span>Origin</span><strong>Opaque (null)</strong></div>
            <div class="kpi"><span>Auth Header</span><strong>HMAC-SHA256</strong></div>
          </div>
          <p class="note">Without allow-same-origin, sandboxed artifacts cannot read cookies, localStorage, or parent DOM state.</p>`,
        actionLabel: 'Verify Sandbox Boundary',
        probePrefix: 'origin=opaque',
      };

    case 'diagnostic-card':
      return {
        heading: presetTitle || 'Solar Forge Sandbox Starter',
        badge: 'SOLAR FORGE // CADENCE GUIDE',
        tab1Label: 'CHORD Flow',
        tab2Label: 'Sandbox Spec',
        tab3Label: 'Try Live LLM',
        tab1Body: `
          <details class="fold" open><summary>1. Triage + 2. Spec</summary><p>Validates guest quota, extracts prompt keywords, and recalls relevant architectural patterns from Qdrant.</p></details>
          <details class="fold"><summary>3. Build + 4. Gate</summary><p>Generates a single-file HTML5+CSS artifact, runs the strict CSP sanitizer, and lets you approve/export or reject/revise.</p></details>`,
        tab2Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Origin</span><strong>Opaque Sandbox</strong></div>
            <div class="kpi"><span>Payload Cap</span><strong>48 KiB UTF-8</strong></div>
            <div class="kpi"><span>CSS Layers</span><strong>4-Layer Tokens</strong></div>
          </div>
          <div class="pills">${patternList}</div>`,
        tab3Body: `
          <p class="note">Switch <strong>Fast Mode</strong> off to invoke Live LLM mode with your own prompt, for example:</p>
          <ul class="list">
            <li>Build a tabbed Kubernetes incident runbook checklist with severity badges</li>
            <li>Build a SQL vs pgvector latency comparison dashboard with CSS bar charts</li>
            <li>Build an interactive release-readiness gate scorecard with collapsible checks</li>
          </ul>`,
        actionLabel: 'Run Sandbox Self-Check',
        probePrefix: 'sandbox active',
      };

    default: {
      const keywords = extractCadencePromptKeywords(rawPrompt);
      const keywordPills =
        keywords.length > 0
          ? keywords.map(k => `<span class="pill">${escapeCadenceHtml(k)}</span>`).join('')
          : '<span class="pill">custom-widget</span>';
      return {
        heading: presetTitle || 'Custom CADENCE Spec Preview',
        badge: 'CUSTOM PROMPT // STRUCTURED PREVIEW',
        tab1Label: 'Prompt Spec',
        tab2Label: 'Detected Scope',
        tab3Label: 'Sandbox Policy',
        tab1Body: `
          <p class="prompt">${safePrompt}</p>
          <p class="note">Toggle <strong>Fast Mode</strong> off for full Live LLM HTML generation, or inspect the extracted CHORD spec tabs above.</p>
          <div class="pills">${patternList}</div>`,
        tab2Body: `
          <div class="pills">${keywordPills}</div>
          <details class="fold" open><summary>Planned Artifact Structure</summary><p>Self-contained Solar Forge HTML5 document using pure-CSS tabs, collapsible details, metric grids, and strict CSP compliance.</p></details>`,
        tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Execution</span><strong>triage -> spec -> build -> gate</strong></div>
            <div class="kpi"><span>Isolation</span><strong>no allow-same-origin</strong></div>
            <div class="kpi"><span>Size Cap</span><strong>48 KiB</strong></div>
          </div>`,
        actionLabel: 'Verify Custom Artifact',
        probePrefix: 'custom check verified',
      };
    }
  }
}

export function buildTailoredCadenceArtifactHtml(input: TailoredCadenceArtifactInput): string {
  const kind = resolveArtifactKind(input.preset, input.prompt);
  const safeSlug = escapeCadenceHtml(input.preset?.slug?.trim() || 'custom');
  const safePrompt = escapeCadenceHtml(input.prompt.trim());
  const patterns = input.recalledPatterns ?? [];
  const spec = buildInteractiveSpec(
    kind,
    input.preset?.title?.trim() ?? '',
    safePrompt,
    patterns,
    input.prompt,
  );
  const safeHeading = escapeCadenceHtml(spec.heading);
  const safeBadge = escapeCadenceHtml(spec.badge);
  const safeKind = escapeCadenceHtml(kind);
  const safePrefix = escapeCadenceHtml(spec.probePrefix);

  const rawHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${safeHeading}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%; scrollbar-width: none; }
  html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #121110; color: #f4efe6; padding: 1rem; }
  .shell { border: 1px solid #d97706; border-radius: 6px; padding: 1rem 1.25rem; background: #1c1a17; width: 100%; min-height: calc(100vh - 2rem); display: flex; flex-direction: column; }
  .badge { color: #f59e0b; font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  h1 { margin: 0.55rem 0 0.35rem; font-size: 1.05rem; color: #ffd300; }
  p { color: #c7bfb2; line-height: 1.5; margin: 0.35rem 0; font-size: 0.82rem; }
  .prompt { border-left: 2px solid #f59e0b; padding-left: 0.6rem; color: #f4efe6; margin-bottom: 0.75rem; }
  .tabs { margin-top: 0.75rem; }
  .tabs input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
  .tab-bar { display: flex; flex-wrap: wrap; gap: 0.35rem; border-bottom: 1px solid #3c3730; padding-bottom: 0.45rem; margin-bottom: 0.75rem; }
  .tab-bar label { padding: 0.3rem 0.65rem; border-radius: 4px; border: 1px solid #3c3730; background: #141311; color: #c7bfb2; font-size: 0.75rem; cursor: pointer; }
  #tab-1:checked ~ .tab-bar label[for="tab-1"],
  #tab-2:checked ~ .tab-bar label[for="tab-2"],
  #tab-3:checked ~ .tab-bar label[for="tab-3"] { border-color: #ffd300; color: #ffd300; background: #26221c; font-weight: 700; }
  .panel { display: none; }
  #tab-1:checked ~ .panel-1,
  #tab-2:checked ~ .panel-2,
  #tab-3:checked ~ .panel-3 { display: block; }
  .kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.5rem; margin-bottom: 0.75rem; }
  .kpi { border: 1px solid #3c3730; border-radius: 4px; padding: 0.55rem; background: #141311; }
  .kpi span { font-size: 0.7rem; color: #9c9487; text-transform: uppercase; }
  .kpi strong { display: block; color: #22c55e; font-size: 0.86rem; margin-top: 0.2rem; }
  .bars { display: grid; gap: 0.45rem; margin-bottom: 0.65rem; }
  .bar-row { display: grid; grid-template-columns: 7.5rem 1fr 4.5rem; align-items: center; gap: 0.5rem; font-size: 0.74rem; }
  .track { height: 0.55rem; background: #141311; border: 1px solid #3c3730; border-radius: 99px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #22c55e); }
  .warn-fill { background: #f59e0b; }
  .err-fill { background: #ef4444; }
  .w10 { width: 10%; } .w15 { width: 15%; } .w20 { width: 20%; } .w25 { width: 25%; } .w30 { width: 30%; }
  .w35 { width: 35%; } .w50 { width: 50%; } .w55 { width: 55%; } .w65 { width: 65%; } .w85 { width: 85%; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin-bottom: 0.6rem; }
  .tbl th, .tbl td { text-align: left; padding: 0.35rem 0.45rem; border-bottom: 1px solid #2c2823; }
  .tbl th { color: #9c9487; }
  .ok { color: #22c55e; font-weight: 700; }
  .warn { color: #f59e0b; font-weight: 700; }
  .err { color: #ef4444; font-weight: 700; }
  .fold { border: 1px solid #3c3730; border-radius: 4px; padding: 0.45rem 0.65rem; background: #141311; margin-bottom: 0.45rem; font-size: 0.78rem; }
  .fold summary { cursor: pointer; color: #ffd300; font-weight: 600; }
  .pills { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
  .pill { padding: 0.15rem 0.5rem; border: 1px solid #3c3730; border-radius: 99px; background: #141311; color: #f59e0b; font-size: 0.7rem; }
  .list { margin: 0.35rem 0 0; padding-left: 1.1rem; color: #f4efe6; font-size: 0.78rem; display: grid; gap: 0.3rem; }
  .note { color: #9c9487; font-size: 0.76rem; }
  .footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-top: auto; padding-top: 0.85rem; border-top: 1px solid #3c3730; }
  .probe { font-size: 0.76rem; color: #22c55e; }
  .btn { background: #ffd300; color: #121110; border: 0; border-radius: 4px; padding: 0.4rem 0.75rem; font: inherit; font-size: 0.78rem; font-weight: 700; cursor: pointer; }
</style>
</head>
<body data-artifact-kind="${safeKind}" data-preset-slug="${safeSlug}">
  <main class="shell">
    <div class="badge"><span>${safeBadge}</span><span>preset: ${safeSlug}</span></div>
    <h1>${safeHeading}</h1>
    <p class="prompt">${safePrompt}</p>
    <div class="tabs">
      <input type="radio" name="cadence-tab" id="tab-1" checked />
      <input type="radio" name="cadence-tab" id="tab-2" />
      <input type="radio" name="cadence-tab" id="tab-3" />
      <div class="tab-bar">
        <label for="tab-1">${escapeCadenceHtml(spec.tab1Label)}</label>
        <label for="tab-2">${escapeCadenceHtml(spec.tab2Label)}</label>
        <label for="tab-3">${escapeCadenceHtml(spec.tab3Label)}</label>
      </div>
      <section class="panel panel-1">${spec.tab1Body}</section>
      <section class="panel panel-2">${spec.tab2Body}</section>
      <section class="panel panel-3">${spec.tab3Body}</section>
    </div>
    <footer class="footer">
      <span class="probe">Probe: <strong id="probe-val" data-probe-prefix="${safePrefix}">${safePrefix}</strong></span>
      <button class="btn" id="ping-btn" type="button">${escapeCadenceHtml(spec.actionLabel)}</button>
    </footer>
  </main>
  <script>${CANONICAL_PROBE_SCRIPT}</script>
</body>
</html>`;

  return sanitizeCadenceArtifactHtml(rawHtml).html;
}
