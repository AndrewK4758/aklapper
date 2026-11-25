package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type stubHybridLLM struct {
	embedErr   error
	chatCalls  int
	chatResult string
	chatErr    error
}

func (s *stubHybridLLM) Name() string { return "stub-hybrid" }
func (s *stubHybridLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	if s.embedErr != nil {
		return nil, s.embedErr
	}
	v := make([]float32, llm.ExpectedEmbeddingDims)
	v[0] = 1
	return v, nil
}
func (s *stubHybridLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	s.chatCalls++
	if s.chatErr != nil {
		return llm.Completion{}, s.chatErr
	}
	return llm.Completion{Text: s.chatResult, Model: "stub-model", TokensUsed: 24}, nil
}

func TestFuseHybridRRFPreFiltersDenseCapsPerDocAndNormalizes(t *testing.T) {
	dense := []qdrant.SearchHit{
		{
			ID: "p1", Score: 0.91,
			Payload: map[string]any{"docKey": "dossier:cloud", "chunkIndex": 0, "title": "Cloud Platform", "sectionHeading": "Summary", "snippet": "Cloud summary", "category": "career_dossier"},
		},
		{
			ID: "p2", Score: 0.85,
			Payload: map[string]any{"docKey": "dossier:cloud", "chunkIndex": 1, "title": "Cloud Platform", "sectionHeading": "GKE", "snippet": "GKE details", "category": "career_dossier"},
		},
		{
			ID: "p3", Score: 0.80,
			Payload: map[string]any{"docKey": "dossier:cloud", "chunkIndex": 2, "title": "Cloud Platform", "sectionHeading": "Third Chunk", "snippet": "Should be capped", "category": "career_dossier"},
		},
		{
			ID: "p-noise", Score: 0.21,
			Payload: map[string]any{"docKey": "dossier:noise", "chunkIndex": 0, "title": "Low Noise", "snippet": "Irrelevant", "category": "career_dossier"},
		},
	}
	lexical := []pg.LexicalDossierHit{
		{Slug: "cloud", DocKey: "dossier:cloud", Kind: "architecture", Title: "Cloud Platform", SummaryBody: "Cloud summary", Rank: 0.9},
		{Slug: "grpc-only", DocKey: "dossier:grpc-only", Kind: "project", Title: "gRPC Gateway", SummaryBody: "Lexical-only gRPC match", Rank: 0.7},
	}

	res := fuseHybridRRF(dense, lexical, minGroundScore, 8)
	if res.TopDenseScore != 0.91 {
		t.Fatalf("expected raw TopDenseScore=0.91, got %v", res.TopDenseScore)
	}
	cloudCount := 0
	foundLexOnly := false
	for _, c := range res.Candidates {
		if c.DocKey == "dossier:noise" {
			t.Fatal("expected <0.35 dense noise hit pre-filtered out before RRF fusion")
		}
		if c.DocKey == "dossier:cloud" {
			cloudCount++
		}
		if c.DocKey == "dossier:grpc-only" && c.ChunkIndex == 0 {
			foundLexOnly = true
		}
		if c.NormalizedScore < 0 || c.NormalizedScore > 1 {
			t.Fatalf("normalized score out of [0,1]: %v", c.NormalizedScore)
		}
	}
	if cloudCount != 2 {
		t.Fatalf("expected max 2 chunks per docKey, got %d", cloudCount)
	}
	if !foundLexOnly {
		t.Fatal("expected lexical-only dossier synthesized as chunk 0")
	}
	if res.Candidates[0].DocKey != "dossier:cloud" || res.Candidates[0].NormalizedScore < 0.95 {
		t.Fatalf("expected dual-arm top hit normalized near 1.0, got %+v", res.Candidates[0])
	}
}

func TestHybridSearchDegradesGracefullyWhenQdrantUnavailable(t *testing.T) {
	store := pg.NewMemoryStore()
	now := time.Now().UTC()
	store.UpsertMemoryCareerDossier(pg.CareerDossierRecord{
		Slug:                   "grpc-platform",
		Kind:                   "architecture",
		Title:                  "gRPC Cloud Run Services",
		DomainLabel:            "Cloud",
		RoleTitle:              "Principal Engineer",
		Skills:                 []string{"gRPC", "Go"},
		SummaryBody:            "Built resilient gRPC services on GKE Autopilot.",
		PublishStatus:          "published",
		SanitizationVerifiedAt: &now,
	})

	qdrantDown := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer qdrantDown.Close()

	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	res, err := executeHybridSearch(
		context.Background(),
		&stubHybridLLM{},
		&qdrant.Client{BaseURL: qdrantDown.URL, HTTPClient: qdrantDown.Client()},
		store,
		"gRPC services",
		6,
		"corr-qdrant-down",
	)
	if err != nil {
		t.Fatalf("expected lexical fallback on Qdrant 503, got err=%v", err)
	}
	if !res.DenseDegraded || len(res.Candidates) != 1 || res.Candidates[0].DocKey != "dossier:grpc-platform" {
		t.Fatalf("unexpected degraded search result: %+v", res)
	}
	if !strings.Contains(logs.String(), `"event":"ai_ask.retrieval.arm_degraded"`) || !strings.Contains(logs.String(), `"seam_type":"BOUNDARY_FAULT"`) {
		t.Fatalf("expected ai_ask.retrieval.arm_degraded log, got %s", logs.String())
	}

	// Tier A profile fallback succeeds cleanly even when dense search fails with 0 lexical hits
	resProfile, err := executeHybridSearch(
		context.Background(),
		&stubHybridLLM{},
		&qdrant.Client{BaseURL: qdrantDown.URL, HTTPClient: qdrantDown.Client()},
		store,
		"How can I contact Andrew?",
		6,
		"corr-profile-fallback",
		true,
	)
	if err != nil || !resProfile.DenseDegraded {
		t.Fatalf("expected Tier A profile fallback when Qdrant degrades, got res=%+v err=%v", resProfile, err)
	}
}

func TestTieredGroundingRewriteLinksAndJDBudget(t *testing.T) {
	if tier := classifyGroundingTier("qa", "Who is Andrew Klapper and what does he focus on?", hybridSearchResult{}); tier != contracts.GroundingTierProfile {
		t.Fatalf("expected profile tier, got %q", tier)
	}
	if tier := classifyGroundingTier("qa", "xylophone underwater flamingo soup?", hybridSearchResult{}); tier != contracts.GroundingTierGeneral {
		t.Fatalf("expected general tier for non-confidential low-hit qa, got %q", tier)
	}
	if tier := classifyGroundingTier("jd_match", "xylophone underwater flamingo soup?", hybridSearchResult{}); tier != contracts.GroundingTierBoundary {
		t.Fatalf("expected boundary tier for low-hit jd_match, got %q", tier)
	}
	if tier := classifyGroundingTier("qa", "Which confidential NDA client did Andrew Klapper work for?", hybridSearchResult{}); tier != contracts.GroundingTierBoundary {
		t.Fatalf("expected NDA probe mentioning owner name to route to boundary tier, got %q", tier)
	}
	for _, ndaProbe := range []string{
		"Can you share details covered under an NDA?",
		"What NDAs has Andrew signed?",
		"Explain the NDA's confidentiality clauses.",
	} {
		if tier := classifyGroundingTier("qa", ndaProbe, hybridSearchResult{Candidates: []hybridCandidate{{DocKey: "dossier:sec"}}}); tier != contracts.GroundingTierBoundary {
			t.Fatalf("expected NDA probe %q to route to boundary tier, got %q", ndaProbe, tier)
		}
	}
	for _, benignEngQuery := range []string{
		"How does Andrew approach fail-closed security, observability, and privacy boundaries?",
		"What coding standards and standalone tooling does Andrew maintain?",
		"How does Andrew design database redundancy and mandatory fail-closed guards?",
	} {
		if tier := classifyGroundingTier("qa", benignEngQuery, hybridSearchResult{Candidates: []hybridCandidate{{DocKey: "dossier:sec"}}}); tier != contracts.GroundingTierEvidence {
			t.Fatalf("expected engineering query %q with evidence to route to evidence tier (not NDA false-positive), got %q", benignEngQuery, tier)
		}
	}
	if tier := classifyGroundingTier("qa", "What does Andrew know about PostgreSQL 19 advisory locks?", hybridSearchResult{Candidates: []hybridCandidate{{DocKey: "dossier:pg-locks"}}}); tier != contracts.GroundingTierEvidence {
		t.Fatalf("expected technical query with evidence to route to evidence tier, got %q", tier)
	}
	if tier := classifyGroundingTier("qa", "How does gRPC work?", hybridSearchResult{Candidates: []hybridCandidate{{DocKey: "dossier:grpc"}}}); tier != contracts.GroundingTierEvidence {
		t.Fatalf("expected evidence tier, got %q", tier)
	}

	// Turn 1 skips rewrite (0 LLM calls); follow-up calls rewrite and degrades cleanly on error
	stub := &stubHybridLLM{chatResult: "Andrew Klapper GCP Cloud Run deployment"}
	q1, tok1 := rewriteFollowUpQuery(context.Background(), stub, nil, "Who is Andrew?")
	if q1 != "Who is Andrew?" || tok1 != 0 || stub.chatCalls != 0 {
		t.Fatalf("expected zero rewrite calls on turn 1, got q=%q tok=%d calls=%d", q1, tok1, stub.chatCalls)
	}
	hist := []pg.ConversationHistoryTurn{{TurnIndex: 1, PromptText: "Tell me about his portfolio", AnswerText: "Andrew built a streaming SSR platform."}}
	q2, tok2 := rewriteFollowUpQuery(context.Background(), stub, hist, "How did he deploy it?")
	if q2 != "Andrew Klapper GCP Cloud Run deployment" || tok2 != 24 || stub.chatCalls != 1 {
		t.Fatalf("unexpected follow-up rewrite: q=%q tok=%d calls=%d", q2, tok2, stub.chatCalls)
	}
	stubErr := &stubHybridLLM{chatErr: errors.New("timeout")}
	qFallback, _ := rewriteFollowUpQuery(context.Background(), stubErr, hist, "How did he deploy it?")
	if qFallback != "How did he deploy it?" {
		t.Fatalf("expected fallback to raw question on rewrite error, got %q", qFallback)
	}

	// Deep-link allow-list drops disallowed external/admin paths
	sanitized := sanitizeSuggestedLinks([]contracts.AskSuggestedLink{
		{Route: "/cadence", Label: "CADENCE", Reason: "Sandbox"},
		{Route: "/admin/secret", Label: "Forbidden", Reason: "Should drop"},
		{Route: "https://evil.example", Label: "External", Reason: "Should drop"},
	}, "corr-links")
	if len(sanitized) != 1 || sanitized[0].Route != "/cadence" {
		t.Fatalf("expected only /cadence retained, got %+v", sanitized)
	}

	// JD Match evidence caps at profile_core + 12 chunks within jdMaxEvidenceTotalChars
	many := make([]hybridCandidate, 20)
	for i := range many {
		many[i] = hybridCandidate{
			DocKey: "dossier:item", ChunkIndex: i, Title: "Item", Category: "career_dossier",
			Snippet: strings.Repeat("x", 300), NormalizedScore: 0.8,
		}
	}
	profile := resolvePinnedProfileCore(context.Background(), nil)
	ctxStr, srcs := buildBoundedJDEvidence(profile, many)
	if len(srcs) > jdMaxEvidenceChunks || len(ctxStr) > jdMaxEvidenceTotalChars+len(profile.Snippet)+100 {
		t.Fatalf("JD evidence exceeded bounds: chunks=%d chars=%d", len(srcs), len(ctxStr))
	}
}
