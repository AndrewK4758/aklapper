package main

import (
	"fmt"
	"html"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const cadencePatternsCollection = "cadence_patterns"

var promptStopWords = map[string]bool{
	"a": true, "an": true, "and": true, "are": true, "as": true, "at": true,
	"be": true, "build": true, "by": true, "card": true, "for": true, "from": true,
	"in": true, "interactive": true, "is": true, "it": true, "of": true, "on": true,
	"or": true, "show": true, "that": true, "the": true, "this": true, "to": true,
	"widget": true, "with": true,
}

func extractPromptKeywords(prompt string, maxCount int) []string {
	if maxCount <= 0 {
		maxCount = 6
	}
	lower := strings.ToLower(prompt)
	var buf strings.Builder
	for i := 0; i < len(lower); i++ {
		c := lower[i]
		if (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' {
			buf.WriteByte(c)
		} else {
			buf.WriteByte(' ')
		}
	}
	seen := make(map[string]bool, maxCount)
	out := make([]string, 0, maxCount)
	for _, word := range strings.Fields(buf.String()) {
		if len(word) < 3 || promptStopWords[word] || seen[word] {
			continue
		}
		seen[word] = true
		out = append(out, word)
		if len(out) >= maxCount {
			break
		}
	}
	return out
}

type interactiveArtifactSpec struct {
	Heading     string
	Badge       string
	Tab1Label   string
	Tab2Label   string
	Tab3Label   string
	Tab1Body    string
	Tab2Body    string
	Tab3Body    string
	ActionLabel string
	ProbePrefix string
}

func resolveArtifactKind(preset *pg.CadencePresetRecord, presetSlug, prompt string) string {
	if preset != nil {
		kind := strings.TrimSpace(preset.ExpectedKind)
		if kind != "" && kind != "html-sandbox" {
			return kind
		}
	}
	switch strings.TrimSpace(presetSlug) {
	case "k8s-pod-telemetry":
		return "pod-telemetry"
	case "chord-pipeline-monitor":
		return "pipeline-monitor"
	case "qdrant-rag-inspector":
		return "rag-inspector"
	case "zero-trust-gate-panel":
		return "security-gate"
	case "solar-forge-starter":
		return "diagnostic-card"
	}
	lower := strings.ToLower(prompt)
	switch {
	case strings.Contains(lower, "pod") || strings.Contains(lower, "gke") || strings.Contains(lower, "replica"):
		return "pod-telemetry"
	case strings.Contains(lower, "pipeline") || strings.Contains(lower, "chord") || strings.Contains(lower, "latency"):
		return "pipeline-monitor"
	case strings.Contains(lower, "qdrant") || strings.Contains(lower, "rag") || strings.Contains(lower, "vector"):
		return "rag-inspector"
	case strings.Contains(lower, "hmac") || strings.Contains(lower, "gate") || strings.Contains(lower, "zero-trust"):
		return "security-gate"
	default:
		return "custom"
	}
}

func nonEmptyOr(val, fallback string) string {
	trimmed := strings.TrimSpace(val)
	if trimmed != "" {
		return trimmed
	}
	return fallback
}

func buildInteractiveSpec(kind, presetTitle, safePrompt string, patterns []string, rawPrompt string) interactiveArtifactSpec {
	patternPills := `<span class="pill">deterministic-interactive</span>`
	if len(patterns) > 0 {
		var b strings.Builder
		for _, p := range patterns {
			b.WriteString(`<span class="pill">`)
			b.WriteString(html.EscapeString(p))
			b.WriteString(`</span>`)
		}
		patternPills = b.String()
	}

	switch kind {
	case "pod-telemetry":
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "GKE Pod Telemetry Widget"),
			Badge:     "GKE AUTOPILOT // SCALE-TO-ZERO",
			Tab1Label: "Lifecycle 0 -> 1",
			Tab2Label: "OSC 7501 Stream",
			Tab3Label: "Autopilot Quotas",
			Tab1Body: `
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
			Tab2Body: `
          <table class="tbl">
            <thead><tr><th>Seq</th><th>Source</th><th>State</th><th>Progress</th></tr></thead>
            <tbody>
              <tr><td>#1</td><td>svc-cadence-demo</td><td class="ok">scaling</td><td>25%</td></tr>
              <tr><td>#2</td><td>svc-cadence-demo</td><td class="warn">warming</td><td>65%</td></tr>
              <tr><td>#3</td><td>svc-cadence-demo</td><td class="ok">ready</td><td>100%</td></tr>
            </tbody>
          </table>
          <details class="fold"><summary>Inspect OSC 7501 Frame Contract</summary><p>Terminal header badges subscribe to SSE cluster events and render real-time replica transitions without polling.</p></details>`,
			Tab3Body: `
          <div class="bars">
            <div class="bar-row"><span>CPU Request</span><div class="track"><div class="fill w35"></div></div><em>250m / 1000m</em></div>
            <div class="bar-row"><span>Memory</span><div class="track"><div class="fill w50"></div></div><em>256Mi / 512Mi</em></div>
            <div class="bar-row"><span>Session Turns</span><div class="track"><div class="fill w20"></div></div><em>Quota Gated</em></div>
          </div>
          <p class="note">Autopilot scales idle demo pods back to zero replicas after inactivity while keeping PostgreSQL state durable.</p>`,
			ActionLabel: "Simulate Scale Wake Probe",
			ProbePrefix: "replica=1 ready",
		}
	case "pipeline-monitor":
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "CHORD Pipeline Latency Monitor"),
			Badge:     "CHORD PIPELINE // 4-PHASE STREAM",
			Tab1Label: "Waterfall",
			Tab2Label: "Phase Contracts",
			Tab3Label: "SLA Budget",
			Tab1Body: `
          <div class="bars">
            <div class="bar-row"><span>1. TRIAGE</span><div class="track"><div class="fill w10"></div></div><em>2ms</em></div>
            <div class="bar-row"><span>2. SPEC</span><div class="track"><div class="fill w30"></div></div><em>48ms</em></div>
            <div class="bar-row"><span>3. BUILD</span><div class="track"><div class="fill w85"></div></div><em>410ms</em></div>
            <div class="bar-row"><span>4. GATE</span><div class="track"><div class="fill w15"></div></div><em>3ms</em></div>
          </div>
          <div class="pills">` + patternPills + `</div>`,
			Tab2Body: `
          <details class="fold" open><summary>TRIAGE -> SPEC</summary><p>Classifies prompt intent, enforces guest quota, and queries Qdrant for bounded architectural patterns.</p></details>
          <details class="fold"><summary>BUILD -> GATE</summary><p>Synthesizes self-contained HTML/CSS, injects strict CSP meta, strips unsafe tags, and awaits operator verdict.</p></details>`,
			Tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Fast Mode SLA</span><strong>&lt; 1.5s</strong></div>
            <div class="kpi"><span>Live LLM SLA</span><strong>&lt; 25s</strong></div>
            <div class="kpi"><span>Artifact Cap</span><strong>48 KiB</strong></div>
          </div>
          <p class="note">Each stage persists durable turn telemetry to Postgres so page reloads replay completed SSE frames.</p>`,
			ActionLabel: "Step Phase Latency Check",
			ProbePrefix: "phases=4/4 nominal",
		}
	case "rag-inspector":
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "Qdrant Grounded RAG Inspector"),
			Badge:     "QDRANT // COSINE ABSTENTION",
			Tab1Label: "Score Bands",
			Tab2Label: "Retrieved Chunks",
			Tab3Label: "Abstention Guard",
			Tab1Body: `
          <div class="bars">
            <div class="bar-row"><span>Grounded (&gt;=0.72)</span><div class="track"><div class="fill w85"></div></div><em>0.84 PASS</em></div>
            <div class="bar-row"><span>Borderline (0.55)</span><div class="track"><div class="fill warn-fill w55"></div></div><em>0.61 WARN</em></div>
            <div class="bar-row"><span>Abstain (&lt;0.55)</span><div class="track"><div class="fill err-fill w30"></div></div><em>0.38 STOP</em></div>
          </div>
          <p class="note">768-dim embeddinggemma-2 vectors enforce a strict cosine floor before any synthesis runs.</p>`,
			Tab2Body: `
          <table class="tbl">
            <thead><tr><th>Collection</th><th>Score</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>cadence_patterns</td><td>0.86</td><td class="ok">grounded</td></tr>
              <tr><td>portfolio_dossiers</td><td>0.79</td><td class="ok">grounded</td></tr>
              <tr><td>unmatched_query</td><td>0.41</td><td class="err">abstained</td></tr>
            </tbody>
          </table>
          <div class="pills">` + patternPills + `</div>`,
			Tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Cosine Floor</span><strong>0.72</strong></div>
            <div class="kpi"><span>Recall Cap</span><strong>250ms fail-soft</strong></div>
            <div class="kpi"><span>Hallucination</span><strong>Fail-Closed</strong></div>
          </div>
          <details class="fold"><summary>Why fail-closed abstention matters</summary><p>If no vector chunk clears the similarity floor, the service returns grounded: false instead of fabricating claims.</p></details>`,
			ActionLabel: "Run Similarity Threshold Probe",
			ProbePrefix: "abstain-guard active",
		}
	case "security-gate":
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "Zero-Trust Gate Audit Panel"),
			Badge:     "SECURITY GATE // CSP + SANDBOX",
			Tab1Label: "CSP Directives",
			Tab2Label: "Blocked Vectors",
			Tab3Label: "Session Boundary",
			Tab1Body: `
          <table class="tbl">
            <thead><tr><th>Directive</th><th>Policy</th><th>Status</th></tr></thead>
            <tbody>
              <tr><td>default-src</td><td>'none'</td><td class="ok">LOCKED</td></tr>
              <tr><td>script-src</td><td>sha256-hash only</td><td class="ok">LOCKED</td></tr>
              <tr><td>style-src</td><td>'unsafe-inline' (sanitized)</td><td class="ok">SAFE</td></tr>
              <tr><td>base-uri / form</td><td>'none'</td><td class="ok">LOCKED</td></tr>
            </tbody>
          </table>`,
			Tab2Body: `
          <table class="tbl">
            <thead><tr><th>Vector</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td>&lt;iframe&gt; / &lt;object&gt; / &lt;svg&gt;</td><td class="err">STRIPPED</td></tr>
              <tr><td>Arbitrary &lt;script&gt; / on* attrs</td><td class="err">STRIPPED</td></tr>
              <tr><td>javascript: / data: / @import</td><td class="err">BLOCKED</td></tr>
              <tr><td>&lt;meta http-equiv="refresh"&gt;</td><td class="err">STRIPPED</td></tr>
            </tbody>
          </table>`,
			Tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Iframe Sandbox</span><strong>allow-scripts only</strong></div>
            <div class="kpi"><span>Origin</span><strong>Opaque (null)</strong></div>
            <div class="kpi"><span>Auth Header</span><strong>HMAC-SHA256</strong></div>
          </div>
          <p class="note">Without allow-same-origin, sandboxed artifacts cannot read cookies, localStorage, or parent DOM state.</p>`,
			ActionLabel: "Verify Sandbox Boundary",
			ProbePrefix: "origin=opaque",
		}
	case "diagnostic-card":
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "Solar Forge Sandbox Starter"),
			Badge:     "SOLAR FORGE // CADENCE GUIDE",
			Tab1Label: "CHORD Flow",
			Tab2Label: "Sandbox Spec",
			Tab3Label: "Try Live LLM",
			Tab1Body: `
          <details class="fold" open><summary>1. Triage + 2. Spec</summary><p>Validates guest quota, extracts prompt keywords, and recalls relevant architectural patterns from Qdrant.</p></details>
          <details class="fold"><summary>3. Build + 4. Gate</summary><p>Generates a single-file HTML5+CSS artifact, runs the strict CSP sanitizer, and lets you approve/export or reject/revise.</p></details>`,
			Tab2Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Origin</span><strong>Opaque Sandbox</strong></div>
            <div class="kpi"><span>Payload Cap</span><strong>48 KiB UTF-8</strong></div>
            <div class="kpi"><span>CSS Layers</span><strong>4-Layer Tokens</strong></div>
          </div>
          <div class="pills">` + patternPills + `</div>`,
			Tab3Body: `
          <p class="note">Switch <strong>Fast Mode</strong> off to invoke Live LLM mode with your own prompt, for example:</p>
          <ul class="list">
            <li>Build a tabbed Kubernetes incident runbook checklist with severity badges</li>
            <li>Build a SQL vs pgvector latency comparison dashboard with CSS bar charts</li>
            <li>Build an interactive release-readiness gate scorecard with collapsible checks</li>
          </ul>`,
			ActionLabel: "Run Sandbox Self-Check",
			ProbePrefix: "sandbox active",
		}
	default:
		keywords := extractPromptKeywords(rawPrompt, 6)
		keywordPills := `<span class="pill">custom-widget</span>`
		if len(keywords) > 0 {
			var kb strings.Builder
			for _, k := range keywords {
				kb.WriteString(`<span class="pill">`)
				kb.WriteString(html.EscapeString(k))
				kb.WriteString(`</span>`)
			}
			keywordPills = kb.String()
		}
		return interactiveArtifactSpec{
			Heading:   nonEmptyOr(presetTitle, "Custom CADENCE Spec Preview"),
			Badge:     "CUSTOM PROMPT // STRUCTURED PREVIEW",
			Tab1Label: "Prompt Spec",
			Tab2Label: "Detected Scope",
			Tab3Label: "Sandbox Policy",
			Tab1Body: `
          <p class="prompt">` + safePrompt + `</p>
          <p class="note">Toggle <strong>Fast Mode</strong> off for full Live LLM HTML generation, or inspect the extracted CHORD spec tabs above.</p>
          <div class="pills">` + patternPills + `</div>`,
			Tab2Body: `
          <div class="pills">` + keywordPills + `</div>
          <details class="fold" open><summary>Planned Artifact Structure</summary><p>Self-contained Solar Forge HTML5 document using pure-CSS tabs, collapsible details, metric grids, and strict CSP compliance.</p></details>`,
			Tab3Body: `
          <div class="kpi-row">
            <div class="kpi"><span>Execution</span><strong>triage -> spec -> build -> gate</strong></div>
            <div class="kpi"><span>Isolation</span><strong>no allow-same-origin</strong></div>
            <div class="kpi"><span>Size Cap</span><strong>48 KiB</strong></div>
          </div>`,
			ActionLabel: "Verify Custom Artifact",
			ProbePrefix: "custom check verified",
		}
	}
}

func buildTailoredArtifactHTML(prompt, presetSlug string, preset *pg.CadencePresetRecord, patterns []string) string {
	kind := resolveArtifactKind(preset, presetSlug, prompt)
	presetTitle := ""
	if preset != nil {
		presetTitle = preset.Title
	}
	safeSlug := html.EscapeString(nonEmptyOr(presetSlug, "custom"))
	safePrompt := html.EscapeString(strings.TrimSpace(prompt))
	spec := buildInteractiveSpec(kind, presetTitle, safePrompt, patterns, prompt)
	safeHeading := html.EscapeString(spec.Heading)
	safeBadge := html.EscapeString(spec.Badge)
	safeKind := html.EscapeString(kind)
	safePrefix := html.EscapeString(spec.ProbePrefix)

	return fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>%s</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; min-height: 100%%; scrollbar-width: none; }
  html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #121110; color: #f4efe6; padding: 1rem; }
  .shell { border: 1px solid #d97706; border-radius: 6px; padding: 1rem 1.25rem; background: #1c1a17; width: 100%%; min-height: calc(100vh - 2rem); display: flex; flex-direction: column; }
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
  .fill { height: 100%%; background: linear-gradient(90deg, #f59e0b, #22c55e); }
  .warn-fill { background: #f59e0b; }
  .err-fill { background: #ef4444; }
  .w10 { width: 10%%; } .w15 { width: 15%%; } .w20 { width: 20%%; } .w25 { width: 25%%; } .w30 { width: 30%%; }
  .w35 { width: 35%%; } .w50 { width: 50%%; } .w55 { width: 55%%; } .w65 { width: 65%%; } .w85 { width: 85%%; }
  .tbl { width: 100%%; border-collapse: collapse; font-size: 0.75rem; margin-bottom: 0.6rem; }
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
<body data-artifact-kind="%s" data-preset-slug="%s">
  <main class="shell">
    <div class="badge"><span>%s</span><span>preset: %s</span></div>
    <h1>%s</h1>
    <p class="prompt">%s</p>
    <div class="tabs">
      <input type="radio" name="cadence-tab" id="tab-1" checked />
      <input type="radio" name="cadence-tab" id="tab-2" />
      <input type="radio" name="cadence-tab" id="tab-3" />
      <div class="tab-bar">
        <label for="tab-1">%s</label>
        <label for="tab-2">%s</label>
        <label for="tab-3">%s</label>
      </div>
      <section class="panel panel-1">%s</section>
      <section class="panel panel-2">%s</section>
      <section class="panel panel-3">%s</section>
    </div>
    <footer class="footer">
      <span class="probe">Probe: <strong id="probe-val" data-probe-prefix="%s">%s</strong></span>
      <button class="btn" id="ping-btn" type="button">%s</button>
    </footer>
  </main>
  <script>%s</script>
</body>
</html>`,
		safeHeading,
		safeKind,
		safeSlug,
		safeBadge,
		safeSlug,
		safeHeading,
		safePrompt,
		html.EscapeString(spec.Tab1Label),
		html.EscapeString(spec.Tab2Label),
		html.EscapeString(spec.Tab3Label),
		spec.Tab1Body,
		spec.Tab2Body,
		spec.Tab3Body,
		safePrefix,
		safePrefix,
		html.EscapeString(spec.ActionLabel),
		canonicalProbeScript,
	)
}
