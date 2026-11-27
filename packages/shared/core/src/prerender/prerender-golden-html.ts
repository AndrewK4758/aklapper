import {
  CANONICAL_PROBE_SCRIPT,
  escapeCadenceHtml,
  sanitizeCadenceArtifactHtml,
} from '../cadence-html-sanitizer.ts';

export interface GoldenHtmlSpec {
  readonly slug: string;
  readonly kind: string;
  readonly badge: string;
  readonly heading: string;
  readonly subtitle: string;
  readonly tab1: { readonly label: string; readonly body: string };
  readonly tab2: { readonly label: string; readonly body: string };
  readonly tab3: { readonly label: string; readonly body: string };
  readonly probePrefix: string;
  readonly actionLabel: string;
}

export function buildGoldenShowcaseHtml(spec: GoldenHtmlSpec): string {
  const raw = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeCadenceHtml(spec.heading)}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; width: 100%; overflow-x: hidden; scrollbar-width: none; }
  html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #121110; color: #f4efe6; padding: 0.75rem; }
  .shell { border: 1px solid #d97706; border-radius: 6px; padding: 0.85rem 1rem; background: #1c1a17; width: 100%; max-width: 100%; display: flex; flex-direction: column; gap: 0.55rem; }
  .badge { color: #f59e0b; font-size: 0.68rem; letter-spacing: 0.08em; text-transform: uppercase; display: flex; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  h1 { margin: 0; font-size: 1rem; color: #ffd300; }
  .sub { margin: 0; color: #c7bfb2; font-size: 0.76rem; line-height: 1.4; border-left: 2px solid #f59e0b; padding-left: 0.55rem; }
  .tabs { display: flex; flex-direction: column; gap: 0.5rem; }
  .tabs input[type="radio"] { position: absolute; opacity: 0; pointer-events: none; }
  .tab-bar { display: flex; flex-wrap: wrap; gap: 0.35rem; border-bottom: 1px solid #3c3730; padding-bottom: 0.4rem; }
  .tab-bar label { padding: 0.28rem 0.6rem; border-radius: 4px; border: 1px solid #3c3730; background: #141311; color: #c7bfb2; font-size: 0.72rem; cursor: pointer; }
  #t1:checked ~ .tab-bar label[for="t1"],
  #t2:checked ~ .tab-bar label[for="t2"],
  #t3:checked ~ .tab-bar label[for="t3"] { border-color: #ffd300; color: #ffd300; background: #26221c; font-weight: 700; }
  .panel { display: none; }
  #t1:checked ~ .p1, #t2:checked ~ .p2, #t3:checked ~ .p3 { display: block; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: 0.45rem; margin-bottom: 0.45rem; }
  .kpi { border: 1px solid #3c3730; border-radius: 4px; padding: 0.45rem 0.55rem; background: #141311; }
  .kpi span { display: block; font-size: 0.66rem; color: #9c9487; text-transform: uppercase; }
  .kpi strong { display: block; font-size: 0.8rem; color: #22c55e; margin-top: 0.15rem; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
  .tbl th, .tbl td { text-align: left; padding: 0.3rem 0.4rem; border-bottom: 1px solid #2c2823; vertical-align: top; }
  .tbl th { color: #9c9487; font-size: 0.68rem; text-transform: uppercase; }
  .ok { color: #22c55e; font-weight: 700; }
  .warn { color: #f59e0b; font-weight: 700; }
  .err { color: #ef4444; font-weight: 700; }
  .fold { border: 1px solid #3c3730; border-radius: 4px; padding: 0.35rem 0.55rem; background: #141311; margin-bottom: 0.35rem; font-size: 0.74rem; }
  .fold summary { cursor: pointer; color: #ffd300; font-weight: 600; }
  .fold p { margin: 0.3rem 0 0; color: #c7bfb2; line-height: 1.4; }
  .bars { display: grid; gap: 0.35rem; }
  .bar-row { display: grid; grid-template-columns: 7.5rem 1fr 4.5rem; align-items: center; gap: 0.45rem; font-size: 0.72rem; }
  .track { height: 0.48rem; background: #141311; border: 1px solid #3c3730; border-radius: 99px; overflow: hidden; }
  .fill { height: 100%; background: linear-gradient(90deg, #f59e0b, #22c55e); }
  .w25 { width: 25%; } .w50 { width: 50%; } .w75 { width: 75%; } .w100 { width: 100%; }
  .footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.45rem; padding-top: 0.5rem; border-top: 1px solid #3c3730; }
  .probe { font-size: 0.72rem; color: #22c55e; }
  .btn { background: #ffd300; color: #121110; border: 0; border-radius: 4px; padding: 0.32rem 0.65rem; font: inherit; font-size: 0.72rem; font-weight: 700; cursor: pointer; }
</style>
</head>
<body data-artifact-kind="${escapeCadenceHtml(spec.kind)}" data-preset-slug="${escapeCadenceHtml(spec.slug)}">
  <main class="shell">
    <div class="badge"><span>${escapeCadenceHtml(spec.badge)}</span><span>showcase: ${escapeCadenceHtml(spec.slug)}</span></div>
    <h1>${escapeCadenceHtml(spec.heading)}</h1>
    <p class="sub">${escapeCadenceHtml(spec.subtitle)}</p>
    <div class="tabs">
      <input type="radio" name="cadence-showcase-tab" id="t1" checked />
      <input type="radio" name="cadence-showcase-tab" id="t2" />
      <input type="radio" name="cadence-showcase-tab" id="t3" />
      <div class="tab-bar">
        <label for="t1">${escapeCadenceHtml(spec.tab1.label)}</label>
        <label for="t2">${escapeCadenceHtml(spec.tab2.label)}</label>
        <label for="t3">${escapeCadenceHtml(spec.tab3.label)}</label>
      </div>
      <section class="panel p1">${spec.tab1.body}</section>
      <section class="panel p2">${spec.tab2.body}</section>
      <section class="panel p3">${spec.tab3.body}</section>
    </div>
    <footer class="footer">
      <span class="probe">Probe: <strong id="probe-val" data-probe-prefix="${escapeCadenceHtml(spec.probePrefix)}">${escapeCadenceHtml(spec.probePrefix)}</strong></span>
      <button class="btn" id="ping-btn" type="button">${escapeCadenceHtml(spec.actionLabel)}</button>
    </footer>
  </main>
  <script>${CANONICAL_PROBE_SCRIPT}</script>
</body>
</html>`;
  return sanitizeCadenceArtifactHtml(raw).html;
}

export const GOLDEN_SHOWCASE_HTML: Readonly<Record<string, string>> = {
  'chord-decomposition-workbench': buildGoldenShowcaseHtml({
    slug: 'chord-decomposition-workbench',
    kind: 'chord-workbench',
    badge: 'CADENCE METHODOLOGY // CHORD SPECIFICATION',
    heading: 'CHORD Behavioral Decomposition Workbench',
    subtitle:
      'Maps every acceptance criterion into Conditions, Handling, Outcomes, Rules, and Deltas before any code is authored.',
    tab1: {
      label: 'CHORD Matrix',
      body: `<table class="tbl"><thead><tr><th>Axis</th><th>Contract</th><th>Status</th></tr></thead><tbody>
        <tr><td><strong>Conditions</strong></td><td>Pre-conditions, auth principal, rate-limit state, edge inputs</td><td class="ok">BOUNDED</td></tr>
        <tr><td><strong>Handling</strong></td><td>Deterministic state transition + fail-closed error mapping</td><td class="ok">SPECIFIED</td></tr>
        <tr><td><strong>Outcomes</strong></td><td>Observable wire response, HTTP status, UI state invariant</td><td class="ok">TESTABLE</td></tr>
        <tr><td><strong>Rules</strong></td><td>Non-negotiable security, CSP, and concurrency invariants</td><td class="warn">ENFORCED</td></tr>
        <tr><td><strong>Deltas</strong></td><td>Exact DB rows, buckets, and audit seams mutated</td><td class="ok">AUDITED</td></tr>
      </tbody></table>`,
    },
    tab2: {
      label: 'Observability Seams',
      body: `<div class="grid">
        <div class="kpi"><span>UNSOUND_CONDITION</span><strong>Auth / Ownership Drift</strong></div>
        <div class="kpi"><span>RULE_DIVERGENCE</span><strong>Fallback / Cache Branch</strong></div>
        <div class="kpi"><span>BOUNDARY_FAULT</span><strong>Privacy / Upstream Fail</strong></div>
        <div class="kpi"><span>DELTA_AUDIT_GAP</span><strong>Terminal Commit Audit</strong></div>
      </div>
      <details class="fold" open><summary>Why seams bind directly to CHORD</summary><p>Every structural invariant emits a typed JSON event so production drift alerts immediately without scraping raw logs.</p></details>`,
    },
    tab3: {
      label: 'Gherkin BDD',
      body: `<details class="fold" open><summary>Given / When / Then Verification</summary><p><strong>Given</strong> a verified guest session and active quota policy<br/><strong>When</strong> the CHORD pipeline executes triage, spec, build, and gate<br/><strong>Then</strong> all 4 turns persist atomically and the artifact passes strict SHA-256 CSP checks.</p></details>
      <div class="bars"><div class="bar-row"><span>BDD Coverage</span><div class="track"><div class="fill w100"></div></div><em>100% ACs</em></div></div>`,
    },
    probePrefix: 'chord=5/5 axes verified',
    actionLabel: 'Verify CHORD Contract',
  }),
  'change-tier-gate-matrix': buildGoldenShowcaseHtml({
    slug: 'change-tier-gate-matrix',
    kind: 'tier-gate-matrix',
    badge: 'CADENCE METHODOLOGY // RISK GOVERNANCE',
    heading: 'Change-Tier Blast-Radius & Gate Matrix',
    subtitle:
      'Proportional governance: scales architectural scrutiny, challenger reviews, and human approval gates to real blast radius.',
    tab1: {
      label: 'Tier Matrix',
      body: `<table class="tbl"><thead><tr><th>Tier</th><th>Trigger</th><th>Spec & Challenge</th><th>Gates</th></tr></thead><tbody>
        <tr><td class="ok"><strong>Trivial</strong></td><td>Copy / docs / isolated tweak</td><td>Lightweight note</td><td>Gate 3</td></tr>
        <tr><td class="ok"><strong>Low</strong></td><td>Single-module additive change</td><td>CHORD spec + unit tests</td><td>Gates 1, 3</td></tr>
        <tr><td class="warn"><strong>Medium</strong></td><td>Cross-module API or state change</td><td>Design options + Challenger</td><td>Gates 1, 2, 3</td></tr>
        <tr><td class="err"><strong>High</strong></td><td>Multi-service / DB migration / security</td><td>Full 6W×4L + Cold Breaker + Audit</td><td>Gates 1–4</td></tr>
      </tbody></table>`,
    },
    tab2: {
      label: 'Human Gates 1–4',
      body: `<div class="grid">
        <div class="kpi"><span>Gate 1</span><strong>Spec & OQ Approval</strong></div>
        <div class="kpi"><span>Gate 2</span><strong>Pre-PR Adversarial Review</strong></div>
        <div class="kpi"><span>Gate 3</span><strong>CI Green & Merge</strong></div>
        <div class="kpi"><span>Gate 4</span><strong>Production Verification</strong></div>
      </div>
      <details class="fold" open><summary>Why High Tier mandates Gate 4</summary><p>Live cluster ingress, SSE flush behavior, and production telemetry cannot be proven solely in local mocks.</p></details>`,
    },
    tab3: {
      label: 'Blast-Radius Score',
      body: `<div class="bars">
        <div class="bar-row"><span>Trivial</span><div class="track"><div class="fill w25"></div></div><em>1 surface</em></div>
        <div class="bar-row"><span>Low</span><div class="track"><div class="fill w50"></div></div><em>1 context</em></div>
        <div class="bar-row"><span>Medium</span><div class="track"><div class="fill w75"></div></div><em>2+ modules</em></div>
        <div class="bar-row"><span>High</span><div class="track"><div class="fill w100"></div></div><em>Cross-service</em></div>
      </div>`,
    },
    probePrefix: 'tiers=4 gates=1..4 active',
    actionLabel: 'Check Gate Escalation',
  }),
  'expand-contract-migration': buildGoldenShowcaseHtml({
    slug: 'expand-contract-migration',
    kind: 'expand-contract-migration',
    badge: 'CADENCE METHODOLOGY // ZERO-DOWNTIME DATA',
    heading: 'Expand/Contract Zero-Downtime Migration Blueprint',
    subtitle:
      'Guarantees old and new pods run concurrently during rollout and proves apply -> rollback -> reapply on ephemeral PostgreSQL 19.',
    tab1: {
      label: '3-Phase Rollout',
      body: `<table class="tbl"><thead><tr><th>Phase</th><th>DDL / Code Action</th><th>Old Pods</th><th>New Pods</th></tr></thead><tbody>
        <tr><td><strong>1. Expand</strong></td><td>ADD COLUMN nullable or safe DEFAULT + partial indexes</td><td class="ok">COMPATIBLE</td><td class="ok">COMPATIBLE</td></tr>
        <tr><td><strong>2. Migrate</strong></td><td>Idempotent backfill + dual-read verification</td><td class="ok">COMPATIBLE</td><td class="ok">COMPATIBLE</td></tr>
        <tr><td><strong>3. Contract</strong></td><td>Separate release drops deprecated columns after drain</td><td class="warn">RETIRED</td><td class="ok">ACTIVE</td></tr>
      </tbody></table>`,
    },
    tab2: {
      label: 'Rollback Proof',
      body: `<div class="grid">
        <div class="kpi"><span>Step 1</span><strong>Apply Up SQL</strong></div>
        <div class="kpi"><span>Step 2</span><strong>Seed + Verify</strong></div>
        <div class="kpi"><span>Step 3</span><strong>Down SQL Clean</strong></div>
        <div class="kpi"><span>Step 4</span><strong>Reapply + Bootstrap</strong></div>
      </div>
      <details class="fold" open><summary>Golden Cleanup Ordering</summary><p>Down migration deletes seeded Golden rows before dropping CHECK constraints and additive columns so visitor rows survive intact.</p></details>`,
    },
    tab3: {
      label: 'Safety Invariants',
      body: `<details class="fold" open><summary>Ephemeral PG19 Only</summary><p>Migration tests spin up a tmpfs PostgreSQL 19 container and never connect to local dev or production databases.</p></details>
      <details class="fold"><summary>Idempotent DDL Guards</summary><p>Every ADD COLUMN, CREATE INDEX, and CONSTRAINT uses IF NOT EXISTS / pg_constraint checks for safe re-execution.</p></details>`,
    },
    probePrefix: 'up->down->up=reversible',
    actionLabel: 'Verify Rollback Safety',
  }),
  'five-boundary-resilience-audit': buildGoldenShowcaseHtml({
    slug: 'five-boundary-resilience-audit',
    kind: 'resilience-chaos-audit',
    badge: 'CADENCE METHODOLOGY // RESILIENCE & CHAOS',
    heading: '5-Boundary Resilience & Chaos Audit',
    subtitle:
      'Stress-tests every stateful pipeline across caller resets, post-commit disconnects, lock races, cache drift, and coupled-tuple writes.',
    tab1: {
      label: '5 Boundaries',
      body: `<table class="tbl"><thead><tr><th>Boundary</th><th>Failure Mode</th><th>Mitigation</th></tr></thead><tbody>
        <tr><td><strong>1. Caller Reset</strong></td><td>Tab reload mid-stream</td><td class="ok">Cancel + Quota Refund TX</td></tr>
        <tr><td><strong>2. Post-Commit</strong></td><td>Socket drop after LLM finishes</td><td class="ok">WithoutCancel 5s Commit</td></tr>
        <tr><td><strong>3. Post-Lock</strong></td><td>Concurrent stream claims</td><td class="ok">CAS pending -&gt; running</td></tr>
        <tr><td><strong>4. Temporal Drift</strong></td><td>Preset edited in CMS</td><td class="ok">presetRevisionHash key</td></tr>
        <tr><td><strong>5. Coupled Tuple</strong></td><td>Run status vs quota bucket</td><td class="ok">FOR UPDATE strict order</td></tr>
      </tbody></table>`,
    },
    tab2: {
      label: 'Lock Order',
      body: `<div class="grid">
        <div class="kpi"><span>Lock #1</span><strong>sandbox_runs</strong></div>
        <div class="kpi"><span>Lock #2</span><strong>session:&lt;id&gt;</strong></div>
        <div class="kpi"><span>Lock #3</span><strong>global:&lt;UTC day&gt;</strong></div>
      </div>
      <details class="fold" open><summary>Zero Deadlocks & Zero Double-Refunds</summary><p>RefundSandboxRunQuotaTx re-validates status IN (pending, running) AND is_golden = false before decrementing buckets with GREATEST(0, ...).</p></details>`,
    },
    tab3: {
      label: 'Memory & Privacy',
      body: `<div class="bars">
        <div class="bar-row"><span>JSON Buffer Cap</span><div class="track"><div class="fill w50"></div></div><em>96 KiB max</em></div>
        <div class="bar-row"><span>HTML Cap</span><div class="track"><div class="fill w25"></div></div><em>48 KiB max</em></div>
        <div class="bar-row"><span>StreamGuard</span><div class="track"><div class="fill w100"></div></div><em>Fail-Closed</em></div>
      </div>`,
    },
    probePrefix: 'boundaries=5/5 resilient',
    actionLabel: 'Run Chaos Probe',
  }),
  'spec-challenge-proof-ledger': buildGoldenShowcaseHtml({
    slug: 'spec-challenge-proof-ledger',
    kind: 'spec-proof-ledger',
    badge: 'CADENCE METHODOLOGY // EMPIRICAL EVIDENCE',
    heading: 'Spec Challenge & Empirical Proof Ledger',
    subtitle:
      'Eliminates hallucinated assumptions before coding by tagging every technical claim as Observed, Absence, Inferred, or Unknown.',
    tab1: {
      label: 'Evidence Classes',
      body: `<table class="tbl"><thead><tr><th>Class</th><th>Proof Standard</th><th>Gate 1 Action</th></tr></thead><tbody>
        <tr><td class="ok"><strong>Observed</strong></td><td>Verified file:line, symbol, or command output</td><td class="ok">PASS</td></tr>
        <tr><td class="ok"><strong>Absence</strong></td><td>Verified grep/glob confirming non-existence</td><td class="ok">PASS</td></tr>
        <tr><td class="warn"><strong>Inferred</strong></td><td>Derived from 2+ observed facts; explicitly labeled</td><td class="warn">REVIEW</td></tr>
        <tr><td class="err"><strong>Unknown</strong></td><td>Unproved assumption or competing product trade-off</td><td class="err">HALT -> OQ</td></tr>
      </tbody></table>`,
    },
    tab2: {
      label: '7-Check Challenger',
      body: `<div class="grid">
        <div class="kpi"><span>Fact Verification</span><strong>100% Grounded</strong></div>
        <div class="kpi"><span>Sibling Scan</span><strong>All Callers Found</strong></div>
        <div class="kpi"><span>Certainty Gate</span><strong>halt=0 Unproved</strong></div>
      </div>
      <details class="fold" open><summary>Zero-Trust Spec Challenge</summary><p>An independent challenger re-verifies every file path, schema constraint, and sibling caller before Gate 1 approval.</p></details>`,
    },
    tab3: {
      label: 'Proof Coverage',
      body: `<div class="bars">
        <div class="bar-row"><span>Observed</span><div class="track"><div class="fill w100"></div></div><em>Verified</em></div>
        <div class="bar-row"><span>Open Questions</span><div class="track"><div class="fill w25"></div></div><em>Human Ruled</em></div>
      </div>`,
    },
    probePrefix: 'evidence=grounded halt=0',
    actionLabel: 'Validate Proof Ledger',
  }),
};
