package main

import (
	"fmt"
	"html"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const cadencePatternsCollection = "cadence_patterns"

type artifactCardModel struct {
	Heading      string
	Badge        string
	Metric1Label string
	Metric1Value string
	Metric2Label string
	Metric2Value string
	ActionLabel  string
	ProbePrefix  string
}

var defaultArtifactCardModel = artifactCardModel{
	Heading:      "Custom CADENCE Artifact",
	Badge:        "CUSTOM PROMPT // TAILORED BUILD",
	Metric1Label: "Execution Mode",
	Metric1Value: "triage -> spec -> build -> gate",
	Metric2Label: "Boundary",
	Metric2Value: "isolated allow-scripts",
	ActionLabel:  "Verify Custom Artifact",
	ProbePrefix:  "custom check verified",
}

var artifactCardModels = map[string]artifactCardModel{
	"pod-telemetry": {
		Heading:      "GKE Pod Telemetry Widget",
		Badge:        "GKE AUTOPILOT // SCALE-TO-ZERO",
		Metric1Label: "Replica State",
		Metric1Value: "0 -> 1 warm probe",
		Metric2Label: "Isolation",
		Metric2Value: `sandbox="allow-scripts"`,
		ActionLabel:  "Simulate Scale Wake Probe",
		ProbePrefix:  "replica=1 ready",
	},
	"pipeline-monitor": {
		Heading:      "CHORD Pipeline Latency Monitor",
		Badge:        "CHORD PIPELINE // FAST STREAM",
		Metric1Label: "Stages",
		Metric1Value: "triage -> spec -> build -> gate",
		Metric2Label: "Target SLA",
		Metric2Value: "<3s end-to-end",
		ActionLabel:  "Step Phase Latency Check",
		ProbePrefix:  "phases=4/4 nominal",
	},
	"rag-inspector": {
		Heading:      "Qdrant Grounded RAG Inspector",
		Badge:        "QDRANT // COSINE ABSTENTION",
		Metric1Label: "Similarity Gate",
		Metric1Value: ">= 0.72 grounded floor",
		Metric2Label: "Recall Cap",
		Metric2Value: "250ms fail-soft",
		ActionLabel:  "Run Similarity Threshold Probe",
		ProbePrefix:  "abstain-guard active",
	},
	"security-gate": {
		Heading:      "Zero-Trust Gate Audit Panel",
		Badge:        "SECURITY GATE // HMAC + COOKIE",
		Metric1Label: "Cookie Boundary",
		Metric1Value: "HttpOnly session isolation",
		Metric2Label: "HTML Policy",
		Metric2Value: "48 KiB sanitized",
		ActionLabel:  "Verify Sandbox Boundary",
		ProbePrefix:  "origin=opaque",
	},
	"diagnostic-card": {
		Heading:      "Solar Forge Sandbox Starter",
		Badge:        "SOLAR FORGE // DIAGNOSTIC",
		Metric1Label: "Pipeline",
		Metric1Value: "triage -> spec -> build -> gate",
		Metric2Label: "Sandbox",
		Metric2Value: "no allow-same-origin",
		ActionLabel:  "Run Sandbox Self-Check",
		ProbePrefix:  "sandbox active",
	},
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

func resolveArtifactModel(kind, presetTitle string) artifactCardModel {
	model, ok := artifactCardModels[kind]
	if !ok {
		model = defaultArtifactCardModel
	}
	if title := strings.TrimSpace(presetTitle); title != "" {
		model.Heading = title
	}
	return model
}

func nonEmptyOr(val, fallback string) string {
	trimmed := strings.TrimSpace(val)
	if trimmed != "" {
		return trimmed
	}
	return fallback
}

func buildTailoredArtifactHTML(prompt, presetSlug string, preset *pg.CadencePresetRecord, patterns []string) string {
	kind := resolveArtifactKind(preset, presetSlug, prompt)
	presetTitle := ""
	if preset != nil {
		presetTitle = preset.Title
	}
	model := resolveArtifactModel(kind, presetTitle)
	safeSlug := html.EscapeString(nonEmptyOr(presetSlug, "custom"))
	safePrompt := html.EscapeString(strings.TrimSpace(prompt))
	safeHeading := html.EscapeString(model.Heading)
	safeBadge := html.EscapeString(model.Badge)
	safeKind := html.EscapeString(kind)
	safePrefix := html.EscapeString(model.ProbePrefix)

	patternNote := "Local deterministic CHORD template"
	if len(patterns) > 0 {
		patternNote = "Qdrant patterns: " + html.EscapeString(strings.Join(patterns, ", "))
	}

	return fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>%s</title>
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
<body data-artifact-kind="%s" data-preset-slug="%s">
  <main class="shell">
    <div class="badge"><span>%s</span><span>preset: %s</span></div>
    <h1>%s</h1>
    <p class="prompt">%s</p>
    <p>%s</p>
    <section class="grid">
      <div class="metric"><span>%s</span><strong>%s</strong></div>
      <div class="metric"><span>%s</span><strong>%s</strong></div>
      <div class="metric"><span>Probe</span><strong id="probe-val" data-probe-prefix="%s">%s</strong></div>
    </section>
    <button class="btn" id="ping-btn" type="button">%s</button>
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
		patternNote,
		html.EscapeString(model.Metric1Label),
		html.EscapeString(model.Metric1Value),
		html.EscapeString(model.Metric2Label),
		html.EscapeString(model.Metric2Value),
		safePrefix,
		safePrefix,
		html.EscapeString(model.ActionLabel),
		canonicalProbeScript,
	)
}
