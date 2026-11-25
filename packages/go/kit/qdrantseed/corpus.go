package qdrantseed

import "github.com/AndrewK4758/aklapper/packages/go/kit/pg"

// SeedDocument defines one vector-indexed document or starter pattern.
type SeedDocument struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	Body       string   `json:"body"`
	Category   string   `json:"category"`
	Source     string   `json:"source"`
	ChordPhase string   `json:"chordPhase,omitempty"`
	Tags       []string `json:"tags,omitempty"`
}

// CuratedCadencePatterns returns self-contained public-safe starter patterns for cadence_patterns.
func CuratedCadencePatterns() []SeedDocument {
	return []SeedDocument{
		{
			ID:         "pattern-solar-forge-telemetry",
			Title:      "Solar Forge Telemetry Card",
			Body:       "Single-file dark telemetry monitor widget displaying live pod phase badges, latency spark metrics, and sandbox self-check controls using CSS custom property tokens.",
			Category:   "telemetry",
			ChordPhase: "build",
			Tags:       []string{"telemetry", "monitor", "widget", "solar-forge", "card"},
			Source:     "curated",
		},
		{
			ID:         "pattern-chord-triage-scope",
			Title:      "CHORD Triage & Blast Radius Classifier",
			Body:       "Classifies incoming feature and bug prompts into explicit scope boundaries, risk triggers, and affected bounded contexts before architectural design starts.",
			Category:   "methodology",
			ChordPhase: "triage",
			Tags:       []string{"triage", "classification", "scope", "chord"},
			Source:     "curated",
		},
		{
			ID:         "pattern-chord-spec-matrix",
			Title:      "CHORD 5-Dimension Behavioral Contract",
			Body:       "Decomposes every acceptance criterion into Conditions, Handling, Outcomes, Rules, and Deltas paired with observability seams and fail-closed edge paths.",
			Category:   "methodology",
			ChordPhase: "spec",
			Tags:       []string{"spec", "chord", "conditions", "outcomes", "contracts"},
			Source:     "curated",
		},
		{
			ID:         "pattern-sandbox-iframe-isolation",
			Title:      "Zero-Trust Sandboxed Preview Frame",
			Body:       "Renders generated HTML5 artifacts inside an iframe sandbox restricted to allow-scripts without allow-same-origin while stripping escape hatches such as nested iframes or cookie access.",
			Category:   "security",
			ChordPhase: "gate",
			Tags:       []string{"sandbox", "iframe", "security", "sanitizer", "gate"},
			Source:     "curated",
		},
		{
			ID:         "pattern-streaming-ssr-suspense",
			Title:      "Streaming SSR Suspense Boundary",
			Body:       "Streams deferred route loader promises through a generic Suspense boundary with deterministic deadline classification and wire-safe error payloads.",
			Category:   "architecture",
			ChordPhase: "build",
			Tags:       []string{"ssr", "suspense", "streaming", "react-router", "resilience"},
			Source:     "curated",
		},
		{
			ID:         "pattern-quota-gate-dashboard",
			Title:      "Transactional Quota & Rate-Limit Meter",
			Body:       "Tracks per-session and global daily token budgets using atomic PostgreSQL FOR UPDATE transactions with fail-closed HTTP 429 enforcement.",
			Category:   "resilience",
			ChordPhase: "gate",
			Tags:       []string{"quota", "rate-limit", "postgres", "dashboard", "meter"},
			Source:     "curated",
		},
		{
			ID:         "pattern-grounded-rag-citations",
			Title:      "Grounded Vector Retrieval Citation Panel",
			Body:       "Queries Qdrant Cosine similarity vectors with strict score thresholds and abstains fail-closed when grounded source evidence falls below minimum confidence.",
			Category:   "ai",
			ChordPhase: "spec",
			Tags:       []string{"qdrant", "rag", "citations", "embeddings", "ai"},
			Source:     "curated",
		},
		{
			ID:         "pattern-deterministic-seed-reconciler",
			Title:      "Deterministic UUIDv5 Vector Reconciler",
			Body:       "Derives collection-scoped RFC-4122 UUIDv5 point identifiers, verifies collection dimensions on conflict, upserts idempotently, and prunes stale records post-upsert.",
			Category:   "data",
			ChordPhase: "build",
			Tags:       []string{"qdrant", "uuidv5", "idempotent", "seeding", "reconciliation"},
			Source:     "curated",
		},
	}
}

// CuratedPortfolioDocs returns consolidated public-safe CADENCE methodology and portfolio architecture docs.
func CuratedPortfolioDocs() []SeedDocument {
	base := FromPGCorpus(pg.CuratedPortfolioDocs())
	extra := []SeedDocument{
		{
			ID:       "curated:architecture",
			Title:    "Portfolio Architecture // Cloud Run SSR + GKE Scale-to-Zero Go",
			Body:     "Andrew Klapper's Solar Forge v2 portfolio pairs React 19 + React Router 8 + Fastify 5 SSR on Cloud Run with scale-from-zero distroless Go microservices on GKE Autopilot, PostgreSQL 19, Qdrant cosine vector search, and strict 4-layer CSS tokens.",
			Category: "architecture",
			Source:   "curated",
		},
		{
			ID:       "curated:cadence-sandbox",
			Title:    "CADENCE CHORD Sandbox // Security & Quota Guardrails",
			Body:     "The CADENCE Builder runs a 4-phase CHORD pipeline (triage, spec, build, gate) persisted to PostgreSQL 19 sandbox_runs and sandbox_turns, enforcing transactional session/daily quotas, HTML sanitization, and an iframe strictly sandboxed with allow-scripts without allow-same-origin.",
			Category: "security",
			Source:   "curated",
		},
		{
			ID:       "curated:ai-rag",
			Title:    "Grounded AI Retrieval // Vertex AI + Local Llama-Swap + Qdrant",
			Body:     "Unified Node and Go LLM providers support local llama-swap on :11434 (embedding model alias) and live Google Cloud Vertex AI text-embedding-005 / Gemini endpoints, paired with Qdrant cosine similarity thresholds (0.35) and strict fail-closed abstention when evidence is missing or weak.",
			Category: "ai",
			Source:   "curated",
		},
		{
			ID:       "curated:cadence-lifecycle",
			Title:    "CADENCE Methodology // End-to-End Lifecycle Phases",
			Body:     "CADENCE stands for Contextual Architecture, Decomposition, Execution, Navigation, Consolidation, and Enshrinement. Work flows sequentially from context grounding and divergent design exploration to behavioral specification, BDD red-green-refactor implementation, adversarial review gates, and archival knowledge capture.",
			Category: "cadence",
			Source:   "curated",
		},
		{
			ID:       "curated:chord-dimensions",
			Title:    "CADENCE CHORD Pipeline // Five Behavioral Dimensions",
			Body:     "Every acceptance criterion in CADENCE is analyzed across five CHORD dimensions: Conditions (preconditions and edge triggers), Handling (control flow and guards), Outcomes (observable postconditions and error codes), Rules (non-negotiable invariants), and Deltas (exact state changes).",
			Category: "cadence",
			Source:   "curated",
		},
		{
			ID:       "curated:engineering-pillars",
			Title:    "CADENCE Engineering Pillars & Precedence Hierarchy",
			Body:     "CADENCE resolves architectural trade-offs by strict pillar precedence: Security Boundary Posture and Data & Audit Fidelity outrank Surface Compatibility, Operational Resilience, Structural Simplicity, and Agentic Ergonomics so low-level convenience never compromises safety or durability.",
			Category: "cadence",
			Source:   "curated",
		},
		{
			ID:       "curated:sandbox-guardrails",
			Title:    "CADENCE Sandbox Guardrails & Deterministic Vector Hygiene",
			Body:     "Interactive sandbox execution isolates untrusted artifacts in a strict iframe sandbox, enforces transactional PostgreSQL quotas, validates origin confidentiality before vector embedding, and uses collection-scoped UUIDv5 point IDs so repeated Qdrant indexing stays idempotent.",
			Category: "security",
			Source:   "curated",
		},
	}
	return MergeSeedDocuments(base, extra)
}

// FromPGCorpus converts pg.CorpusDocument values into SeedDocument entries.
func FromPGCorpus(docs []pg.CorpusDocument) []SeedDocument {
	out := make([]SeedDocument, 0, len(docs))
	for _, d := range docs {
		out = append(out, SeedDocument{
			ID:       d.ID,
			Title:    d.Title,
			Body:     d.Snippet,
			Category: d.Category,
			Source:   d.Source,
		})
	}
	return out
}

// MergeSeedDocuments combines document slices while preserving order and deduplicating by ID.
func MergeSeedDocuments(groups ...[]SeedDocument) []SeedDocument {
	seen := make(map[string]struct{})
	var merged []SeedDocument
	for _, group := range groups {
		for _, doc := range group {
			if _, ok := seen[doc.ID]; ok {
				continue
			}
			seen[doc.ID] = struct{}{}
			merged = append(merged, doc)
		}
	}
	return merged
}
