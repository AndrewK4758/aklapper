package qdrantseed

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type simCollection struct {
	size     int
	distance string
	points   map[string]qdrant.Point
	intIDs   map[uint64]qdrant.Point
}

type qdrantSimulator struct {
	mu              sync.Mutex
	collections     map[string]*simCollection
	requests        []string
	failUpsert      map[string]int
	failScroll      map[string]int
	failDelete      map[string]int
	dropAfter       map[string]bool
	dropAfterDelete map[string]bool
}

func newQdrantSimulator() *qdrantSimulator {
	return &qdrantSimulator{
		collections:     make(map[string]*simCollection),
		failUpsert:      make(map[string]int),
		failScroll:      make(map[string]int),
		failDelete:      make(map[string]int),
		dropAfter:       make(map[string]bool),
		dropAfterDelete: make(map[string]bool),
	}
}

func (s *qdrantSimulator) server() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		s.mu.Lock()
		s.requests = append(s.requests, r.Method+" "+r.URL.Path)
		s.mu.Unlock()

		path := strings.TrimPrefix(r.URL.Path, "/collections/")
		parts := strings.Split(path, "/")
		if len(parts) == 0 || parts[0] == "" {
			http.NotFound(w, r)
			return
		}
		colName := parts[0]

		switch {
		case r.Method == http.MethodPut && len(parts) == 1:
			s.handlePutCollection(w, r, colName)
		case r.Method == http.MethodGet && len(parts) == 1:
			s.handleGetCollection(w, colName)
		case r.Method == http.MethodPut && len(parts) == 2 && parts[1] == "points":
			s.handlePutPoints(w, r, colName)
		case r.Method == http.MethodPost && len(parts) == 3 && parts[1] == "points" && parts[2] == "scroll":
			s.handleScrollPoints(w, colName)
		case r.Method == http.MethodPost && len(parts) == 3 && parts[1] == "points" && parts[2] == "delete":
			s.handleDeletePoints(w, r, colName)
		default:
			http.NotFound(w, r)
		}
	}))
}

func (s *qdrantSimulator) handlePutCollection(w http.ResponseWriter, r *http.Request, colName string) {
	var body struct {
		Vectors struct {
			Size     int    `json:"size"`
			Distance string `json:"distance"`
		} `json:"vectors"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.collections[colName]; exists {
		w.WriteHeader(http.StatusConflict)
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "error"})
		return
	}
	s.collections[colName] = &simCollection{
		size:     body.Vectors.Size,
		distance: body.Vectors.Distance,
		points:   make(map[string]qdrant.Point),
		intIDs:   make(map[uint64]qdrant.Point),
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"result": true})
}

func (s *qdrantSimulator) handleGetCollection(w http.ResponseWriter, colName string) {
	s.mu.Lock()
	col, exists := s.collections[colName]
	if !exists {
		s.mu.Unlock()
		http.NotFound(w, nil)
		return
	}
	ptsCount := len(col.points) + len(col.intIDs)
	size := col.size
	dist := col.distance
	s.mu.Unlock()
	_ = json.NewEncoder(w).Encode(map[string]any{
		"result": map[string]any{
			"status":       "green",
			"points_count": ptsCount,
			"config": map[string]any{
				"params": map[string]any{
					"vectors": map[string]any{"size": size, "distance": dist},
				},
			},
		},
	})
}

func (s *qdrantSimulator) handlePutPoints(w http.ResponseWriter, r *http.Request, colName string) {
	s.mu.Lock()
	code := s.failUpsert[colName]
	s.mu.Unlock()
	if code > 0 {
		http.Error(w, "upsert error", code)
		return
	}
	var body struct {
		Points []struct {
			ID      json.RawMessage `json:"id"`
			Vector  []float32       `json:"vector"`
			Payload map[string]any  `json:"payload"`
		} `json:"points"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	col, exists := s.collections[colName]
	if !exists {
		s.mu.Unlock()
		http.NotFound(w, r)
		return
	}
	for _, pt := range body.Points {
		var strID string
		if err := json.Unmarshal(pt.ID, &strID); err == nil {
			col.points[strID] = qdrant.Point{ID: strID, Vector: pt.Vector, Payload: pt.Payload}
			continue
		}
		var intID uint64
		if err := json.Unmarshal(pt.ID, &intID); err == nil {
			col.intIDs[intID] = qdrant.Point{ID: intID, Vector: pt.Vector, Payload: pt.Payload}
			continue
		}
		s.mu.Unlock()
		http.Error(w, "invalid point id", http.StatusBadRequest)
		return
	}
	drop := s.dropAfter[colName]
	if drop {
		delete(s.dropAfter, colName)
	}
	s.mu.Unlock()
	if drop {
		if hj, ok := w.(http.Hijacker); ok {
			if conn, _, err := hj.Hijack(); err == nil {
				_ = conn.Close()
				return
			}
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}

func (s *qdrantSimulator) handleScrollPoints(w http.ResponseWriter, colName string) {
	s.mu.Lock()
	code := s.failScroll[colName]
	col, exists := s.collections[colName]
	if code > 0 {
		s.mu.Unlock()
		http.Error(w, "scroll error", code)
		return
	}
	if !exists {
		s.mu.Unlock()
		http.NotFound(w, nil)
		return
	}
	var all []map[string]any
	for id := range col.intIDs {
		all = append(all, map[string]any{"id": id})
	}
	for id := range col.points {
		all = append(all, map[string]any{"id": id})
	}
	s.mu.Unlock()
	_ = json.NewEncoder(w).Encode(map[string]any{
		"result": map[string]any{
			"points":           all,
			"next_page_offset": nil,
		},
	})
}

func (s *qdrantSimulator) handleDeletePoints(w http.ResponseWriter, r *http.Request, colName string) {
	s.mu.Lock()
	code := s.failDelete[colName]
	col, exists := s.collections[colName]
	s.mu.Unlock()
	if code > 0 {
		http.Error(w, "delete error", code)
		return
	}
	if !exists {
		http.NotFound(w, r)
		return
	}
	var body struct {
		Points []json.RawMessage `json:"points"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	for _, raw := range body.Points {
		var strID string
		if err := json.Unmarshal(raw, &strID); err == nil {
			if !qdrant.IsValidPointID(strID) {
				s.mu.Unlock()
				http.Error(w, "stringified non-UUID id rejected by qdrant", http.StatusBadRequest)
				return
			}
			delete(col.points, strID)
			continue
		}
		var intID uint64
		if err := json.Unmarshal(raw, &intID); err == nil {
			delete(col.intIDs, intID)
			continue
		}
		s.mu.Unlock()
		http.Error(w, "invalid delete point id", http.StatusBadRequest)
		return
	}
	dropDelete := s.dropAfterDelete[colName]
	if dropDelete {
		delete(s.dropAfterDelete, colName)
	}
	s.mu.Unlock()
	if dropDelete {
		if hj, ok := w.(http.Hijacker); ok {
			if conn, _, err := hj.Hijack(); err == nil {
				_ = conn.Close()
				return
			}
		}
	}
	_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}

type deterministicEmbedder struct {
	dims        int
	err         error
	emptyAt     int32
	mismatchAt  int32
	calls       atomic.Int32
	inFlight    atomic.Int32
	maxInFlight atomic.Int32
	delay       time.Duration
}

func (e *deterministicEmbedder) Name() string { return "stub-768-embedder" }

func (e *deterministicEmbedder) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	return llm.Completion{}, nil
}

func (e *deterministicEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	cur := e.inFlight.Add(1)
	defer e.inFlight.Add(-1)
	for {
		prev := e.maxInFlight.Load()
		if cur <= prev || e.maxInFlight.CompareAndSwap(prev, cur) {
			break
		}
	}

	if e.delay > 0 {
		select {
		case <-time.After(e.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	if e.err != nil {
		return nil, e.err
	}
	n := e.calls.Add(1)
	if e.emptyAt > 0 && n == e.emptyAt {
		return []float32{}, nil
	}
	size := e.dims
	if e.mismatchAt > 0 && n == e.mismatchAt {
		size = e.dims / 2
	}
	vec := make([]float32, size)
	for i := range vec {
		vec[i] = float32(len(text)%7+1) * 0.01
	}
	return vec, nil
}

func TestIdempotentCadencePatternsSeeding(t *testing.T) {
	t.Parallel()

	sim := newQdrantSimulator()
	srv := sim.server()
	defer srv.Close()

	var logBuf bytes.Buffer
	provider := &deterministicEmbedder{dims: 768}
	client := &qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf

	res1, err := SeedCadencePatterns(context.Background(), provider, client, opts)
	if err != nil {
		t.Fatalf("first SeedCadencePatterns failed: %v", err)
	}
	res2, err := SeedCadencePatterns(context.Background(), provider, client, opts)
	if err != nil {
		t.Fatalf("second SeedCadencePatterns failed: %v", err)
	}

	patterns := CuratedCadencePatterns()
	if res1.Indexed != len(patterns) || res2.Indexed != len(patterns) {
		t.Fatalf("expected %d indexed on both runs, got %d and %d", len(patterns), res1.Indexed, res2.Indexed)
	}
	if res1.VectorSize != 768 || res2.VectorSize != 768 {
		t.Fatalf("expected 768 dims, got %d and %d", res1.VectorSize, res2.VectorSize)
	}

	col := sim.collections[CollectionCadencePatterns]
	if col == nil || len(col.points) != len(patterns) || col.distance != "Cosine" || col.size != 768 {
		t.Fatalf("unexpected collection state: %+v", col)
	}
	for _, p := range patterns {
		expectedID := qdrant.CollectionPointID(CollectionCadencePatterns, p.ID)
		pt, ok := col.points[expectedID]
		if !ok {
			t.Fatalf("missing deterministic UUIDv5 point %s for %s", expectedID, p.ID)
		}
		if title, _ := pt.Payload["title"].(string); title == "" {
			t.Fatalf("missing non-empty title payload for %s", p.ID)
		}
		for _, field := range []string{"docId", "summary", "category", "chordPhase", "source"} {
			if val, _ := pt.Payload[field].(string); val == "" {
				t.Fatalf("missing payload field %q for %s", field, p.ID)
			}
		}
	}

	logs := logBuf.String()
	if !strings.Contains(logs, "RULE_DIVERGENCE") || !strings.Contains(logs, "qdrant.seed.execution_outcome") {
		t.Fatalf("expected RULE_DIVERGENCE seam log, got %s", logs)
	}
	if !strings.Contains(logs, "DELTA_AUDIT_GAP") || !strings.Contains(logs, "qdrant.seed.collection_reconciled") {
		t.Fatalf("expected DELTA_AUDIT_GAP seam log, got %s", logs)
	}
}

func TestPortfolioDocsPrunesLegacyOrdinalsAndDeletedRows(t *testing.T) {
	t.Parallel()

	sim := newQdrantSimulator()
	sim.collections[CollectionPortfolioDocs] = &simCollection{
		size:     768,
		distance: "Cosine",
		points: map[string]qdrant.Point{
			qdrant.CollectionPointID(CollectionPortfolioDocs, "agensi:stale-removed"): {
				ID:     qdrant.CollectionPointID(CollectionPortfolioDocs, "agensi:stale-removed"),
				Vector: make([]float32, 768),
			},
		},
		intIDs: map[uint64]qdrant.Point{
			1: {ID: uint64(1), Vector: make([]float32, 768)},
			2: {ID: uint64(2), Vector: make([]float32, 768)},
			3: {ID: uint64(3), Vector: make([]float32, 768)},
		},
	}
	srv := sim.server()
	defer srv.Close()

	var logBuf bytes.Buffer
	provider := &deterministicEmbedder{dims: 768}
	client := &qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf

	res, err := SeedPortfolioDocs(context.Background(), provider, client, pg.NewMemoryStore(), opts)
	if err != nil {
		t.Fatalf("SeedPortfolioDocs failed: %v", err)
	}
	if res.Pruned != 4 {
		t.Fatalf("expected 4 pruned points (3 legacy uint64 + 1 stale UUID), got %d", res.Pruned)
	}
	col := sim.collections[CollectionPortfolioDocs]
	if len(col.intIDs) != 0 {
		t.Fatalf("expected all legacy uint64 points pruned, remaining=%v", col.intIDs)
	}
	if _, exists := col.points[qdrant.CollectionPointID(CollectionPortfolioDocs, "agensi:stale-removed")]; exists {
		t.Fatal("expected stale UUID point to be deleted")
	}
	for _, doc := range CuratedPortfolioDocs() {
		expectedID := qdrant.PortfolioPointID(doc.ID, 0)
		if _, exists := col.points[expectedID]; !exists {
			t.Fatalf("expected portfolio_docs point %q to use canonical PortfolioPointID(%q, 0)=%q", doc.ID, doc.ID, expectedID)
		}
	}
	// Verify upsert occurred before delete
	upsertIdx, deleteIdx := -1, -1
	for idx, req := range sim.requests {
		if req == "PUT /collections/portfolio_docs/points" && upsertIdx == -1 {
			upsertIdx = idx
		}
		if req == "POST /collections/portfolio_docs/points/delete" && deleteIdx == -1 {
			deleteIdx = idx
		}
	}
	if upsertIdx == -1 || deleteIdx == -1 || deleteIdx < upsertIdx {
		t.Fatalf("expected upsert before prune delete, requests=%v", sim.requests)
	}
}

func TestPortfolioDocsPrunesRetiredMaintenanceAndMilestoneOrphansIdempotently(t *testing.T) {
	t.Parallel()

	staleMilestoneID := qdrant.PortfolioPointID("milestone:solar-forge-theme", 0)
	staleMaintenanceID := qdrant.PortfolioPointID("site:portal-maintenance", 0)

	seedStaleCollection := func() *qdrantSimulator {
		sim := newQdrantSimulator()
		sim.collections[CollectionPortfolioDocs] = &simCollection{
			size:     768,
			distance: "Cosine",
			points: map[string]qdrant.Point{
				staleMilestoneID: {
					ID:     staleMilestoneID,
					Vector: make([]float32, 768),
				},
				staleMaintenanceID: {
					ID:     staleMaintenanceID,
					Vector: make([]float32, 768),
				},
			},
			intIDs: make(map[uint64]qdrant.Point),
		}
		return sim
	}

	// Happy path: SeedPortfolioDocs deletes stale milestone:* and site:portal-maintenance orphans and logs DELTA_AUDIT_GAP.
	sim := seedStaleCollection()
	srv := sim.server()
	defer srv.Close()
	var logBuf bytes.Buffer
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf

	res, err := SeedPortfolioDocs(context.Background(), &deterministicEmbedder{dims: 768}, &qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()}, pg.NewMemoryStore(), opts)
	if err != nil {
		t.Fatalf("SeedPortfolioDocs failed: %v", err)
	}
	if res.Pruned != 2 {
		t.Fatalf("expected 2 pruned retired maintenance/milestone points, got %d", res.Pruned)
	}
	col := sim.collections[CollectionPortfolioDocs]
	if _, exists := col.points[staleMilestoneID]; exists {
		t.Fatal("expected stale milestone:solar-forge-theme point to be pruned")
	}
	if _, exists := col.points[staleMaintenanceID]; exists {
		t.Fatal("expected stale site:portal-maintenance point to be pruned")
	}
	if len(col.points) != res.Indexed {
		t.Fatalf("expected exact active point count %d with zero duplicates, got %d", res.Indexed, len(col.points))
	}
	if !strings.Contains(logBuf.String(), "DELTA_AUDIT_GAP") || !strings.Contains(logBuf.String(), `"pruned":2`) {
		t.Fatalf("expected DELTA_AUDIT_GAP collection_reconciled log with pruned:2, got %s", logBuf.String())
	}

	// Partial failure between upsert and prune converges cleanly on retry.
	partialSim := seedStaleCollection()
	partialSim.failDelete[CollectionPortfolioDocs] = http.StatusInternalServerError
	partialSrv := partialSim.server()
	defer partialSrv.Close()
	partialClient := &qdrant.Client{BaseURL: partialSrv.URL, HTTPClient: partialSrv.Client()}
	partialOpts := DefaultSeedOptions()
	partialOpts.LogWriter = &bytes.Buffer{}

	if _, err := SeedPortfolioDocs(context.Background(), &deterministicEmbedder{dims: 768}, partialClient, pg.NewMemoryStore(), partialOpts); !errors.Is(err, ErrQdrantDelete) {
		t.Fatalf("expected ErrQdrantDelete on mid-prune 500, got %v", err)
	}
	partialSim.mu.Lock()
	delete(partialSim.failDelete, CollectionPortfolioDocs)
	partialSim.mu.Unlock()
	retryPartialRes, err := SeedPortfolioDocs(context.Background(), &deterministicEmbedder{dims: 768}, partialClient, pg.NewMemoryStore(), partialOpts)
	if err != nil {
		t.Fatalf("retry after mid-prune failure failed: %v", err)
	}
	if retryPartialRes.Pruned != 2 || len(partialSim.collections[CollectionPortfolioDocs].points) != retryPartialRes.Indexed {
		t.Fatalf("expected clean orphan convergence after retry, res=%+v len=%d", retryPartialRes, len(partialSim.collections[CollectionPortfolioDocs].points))
	}

	// Post-commit ambiguous fault: Qdrant deletes orphans then resets TCP before HTTP 200; retry converges idempotently.
	ambigSim := seedStaleCollection()
	ambigSim.dropAfterDelete[CollectionPortfolioDocs] = true
	ambigSrv := ambigSim.server()
	defer ambigSrv.Close()
	ambigClient := &qdrant.Client{BaseURL: ambigSrv.URL, HTTPClient: ambigSrv.Client()}
	ambigOpts := DefaultSeedOptions()
	ambigOpts.LogWriter = &bytes.Buffer{}

	if _, err := SeedPortfolioDocs(context.Background(), &deterministicEmbedder{dims: 768}, ambigClient, pg.NewMemoryStore(), ambigOpts); !errors.Is(err, ErrQdrantDelete) {
		t.Fatalf("expected ErrQdrantDelete when TCP resets after delete commit, got %v", err)
	}
	resAfterAmbig, err := SeedPortfolioDocs(context.Background(), &deterministicEmbedder{dims: 768}, ambigClient, pg.NewMemoryStore(), ambigOpts)
	if err != nil {
		t.Fatalf("idempotent retry after post-commit delete fault failed: %v", err)
	}
	if resAfterAmbig.Pruned != 0 {
		t.Fatalf("expected 0 remaining orphans on retry after post-commit delete, got %d", resAfterAmbig.Pruned)
	}
	ambigCol := ambigSim.collections[CollectionPortfolioDocs]
	if _, exists := ambigCol.points[staleMilestoneID]; exists {
		t.Fatal("expected stale milestone point absent after post-commit fault retry")
	}
	if _, exists := ambigCol.points[staleMaintenanceID]; exists {
		t.Fatal("expected stale site:portal-maintenance point absent after post-commit fault retry")
	}
	if len(ambigCol.points) != resAfterAmbig.Indexed {
		t.Fatalf("expected zero duplicate vectors after retry (%d), got %d", resAfterAmbig.Indexed, len(ambigCol.points))
	}
}

func TestEnsureCollectionConflictMismatchAndDryRun(t *testing.T) {
	t.Parallel()

	sim := newQdrantSimulator()
	sim.collections[CollectionCadencePatterns] = &simCollection{
		size:     384,
		distance: "Dot",
		points:   make(map[string]qdrant.Point),
		intIDs:   make(map[uint64]qdrant.Point),
	}
	srv := sim.server()
	defer srv.Close()

	var logBuf bytes.Buffer
	provider := &deterministicEmbedder{dims: 768}
	client := &qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf

	if _, err := SeedCadencePatterns(context.Background(), provider, client, opts); err == nil {
		t.Fatal("expected dimension/distance mismatch error on 409 Conflict")
	}
	if len(sim.collections[CollectionCadencePatterns].points) != 0 {
		t.Fatal("expected zero points written on collection dimension mismatch")
	}
	if !strings.Contains(logBuf.String(), "UNSOUND_CONDITION") || !strings.Contains(logBuf.String(), "qdrant.seed.invalid_vector_config") {
		t.Fatalf("expected UNSOUND_CONDITION log, got %s", logBuf.String())
	}

	// Dry-run executes zero mutating HTTP requests
	drySim := newQdrantSimulator()
	drySrv := drySim.server()
	defer drySrv.Close()
	dryOpts := DefaultSeedOptions()
	dryOpts.DryRun = true
	dryOpts.LogWriter = &bytes.Buffer{}
	res, err := SeedCadencePatterns(context.Background(), provider, &qdrant.Client{BaseURL: drySrv.URL, HTTPClient: drySrv.Client()}, dryOpts)
	if err != nil {
		t.Fatalf("dry-run failed: %v", err)
	}
	if res.Indexed != len(CuratedCadencePatterns()) || len(drySim.requests) != 0 {
		t.Fatalf("expected zero Qdrant requests on dry-run, got %v", drySim.requests)
	}
}

func TestOriginConfidentialityValidation(t *testing.T) {
	t.Parallel()

	patterns := CuratedCadencePatterns()
	if err := ValidateOriginConfidentiality(patterns); err != nil {
		t.Fatalf("compiled cadence_patterns failed Origin Confidentiality check: %v", err)
	}
	portfolio := CuratedPortfolioDocs()
	if err := ValidateOriginConfidentiality(portfolio); err != nil {
		t.Fatalf("compiled portfolio_docs failed Origin Confidentiality check: %v", err)
	}
	// Ensure curated portfolio_docs covers CADENCE lifecycle, CHORD dimensions, pillars, and sandbox guardrails
	joined := strings.ToLower(fmt.Sprintf("%+v", portfolio))
	for _, topic := range []string{"lifecycle", "chord", "pillar", "sandbox"} {
		if !strings.Contains(joined, topic) {
			t.Fatalf("expected curated portfolio_docs to cover topic %q", topic)
		}
	}

	// Construct test poison strings dynamically so source files never hold forbidden literals.
	badSamples := []SeedDocument{
		{ID: "bad-ticket", Title: "Leak", Body: "Ticket " + "AKL" + "-999 details", Source: "postgres"},
		{ID: "bad-dec", Title: "Leak", Body: "See " + "DEC" + "-002 ruling", Source: "postgres"},
		{ID: "bad-ii", Title: "Leak", Body: "Insight " + "II" + "-001 note", Source: "postgres"},
		{ID: "bad-prod", Title: "Leak", Body: "Incident " + "PROD" + "-005", Source: "postgres"},
		{ID: "bad-oq", Title: "Leak", Body: "Open question " + "OQ" + "-1", Source: "postgres"},
		{ID: "bad-repo", Title: "Leak", Body: "Repo /home/ak/projects/" + "aklapper" + "-cadence/specs", Source: "postgres"},
		{ID: "bad-file1", Title: "Leak", Body: "Read " + "triage-context" + ".md", Source: "postgres"},
		{ID: "bad-file2", Title: "Leak", Body: "Read " + "CADENCE_ORG" + ".md", Source: "postgres"},
	}

	sim := newQdrantSimulator()
	srv := sim.server()
	defer srv.Close()
	embedder := &deterministicEmbedder{dims: 768}

	for _, bad := range badSamples {
		var logBuf bytes.Buffer
		opts := DefaultSeedOptions()
		opts.LogWriter = &logBuf
		_, err := seedCollectionWithDocs(
			context.Background(),
			CollectionPortfolioDocs,
			[]SeedDocument{bad},
			embedder,
			&qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()},
			opts,
		)
		if !errors.Is(err, ErrOriginConfidentiality) {
			t.Fatalf("expected ErrOriginConfidentiality for %s, got %v", bad.ID, err)
		}
		if !strings.Contains(err.Error(), bad.ID) {
			t.Fatalf("expected offending doc ID %s in error: %v", bad.ID, err)
		}
		if !strings.Contains(logBuf.String(), "BOUNDARY_FAULT") || !strings.Contains(logBuf.String(), "qdrant.seed.origin_confidentiality_violation") {
			t.Fatalf("expected BOUNDARY_FAULT log for %s, got %s", bad.ID, logBuf.String())
		}
	}
	if embedder.calls.Load() != 0 || len(sim.requests) != 0 {
		t.Fatalf("expected zero embedding or Qdrant calls on sanitization rejection, calls=%d reqs=%v", embedder.calls.Load(), sim.requests)
	}
}

func TestEmbedFailuresChaosAndBoundedConcurrency(t *testing.T) {
	t.Parallel()

	sim := newQdrantSimulator()
	srv := sim.server()
	defer srv.Close()
	client := &qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()}

	// Empty vector aborts before Qdrant mutation
	emptyEmbedder := &deterministicEmbedder{dims: 768, emptyAt: 2}
	var logBuf bytes.Buffer
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf
	if _, err := SeedCadencePatterns(context.Background(), emptyEmbedder, client, opts); err == nil {
		t.Fatal("expected error when embedder returns empty vector")
	}
	if len(sim.requests) != 0 {
		t.Fatalf("expected zero Qdrant requests when embedding fails, got %v", sim.requests)
	}

	// Intra-batch dimension mismatch aborts before Qdrant mutation
	mismatchEmbedder := &deterministicEmbedder{dims: 768, mismatchAt: 2}
	if _, err := SeedCadencePatterns(context.Background(), mismatchEmbedder, client, opts); err == nil {
		t.Fatal("expected error on intra-batch vector dimension mismatch")
	}
	if len(sim.requests) != 0 {
		t.Fatalf("expected zero Qdrant requests on dimension mismatch, got %v", sim.requests)
	}

	// CP-01 slow downstream cancels cleanly via ctx
	slowCtx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	slowEmbedder := &deterministicEmbedder{dims: 768, delay: 120 * time.Millisecond}
	if _, err := SeedCadencePatterns(slowCtx, slowEmbedder, client, opts); err == nil {
		t.Fatal("expected context timeout error on slow downstream")
	}

	// CP-09 bounded worker concurrency respects Concurrency: 4
	concEmbedder := &deterministicEmbedder{dims: 768, delay: 10 * time.Millisecond}
	concOpts := DefaultSeedOptions()
	concOpts.Concurrency = 4
	concOpts.LogWriter = &bytes.Buffer{}
	if _, err := SeedCadencePatterns(context.Background(), concEmbedder, client, concOpts); err != nil {
		t.Fatalf("concurrency seed failed: %v", err)
	}
	if concEmbedder.maxInFlight.Load() > 4 {
		t.Fatalf("expected bounded concurrency <= 4, observed %d", concEmbedder.maxInFlight.Load())
	}

	// CP-12 post-commit ambiguous fault retries idempotently via deterministic UUIDv5
	retrySim := newQdrantSimulator()
	retrySim.dropAfter[CollectionCadencePatterns] = true
	retrySrv := retrySim.server()
	defer retrySrv.Close()
	retryClient := &qdrant.Client{BaseURL: retrySrv.URL, HTTPClient: retrySrv.Client()}
	retryOpts := DefaultSeedOptions()
	retryOpts.LogWriter = &bytes.Buffer{}

	if _, err := SeedCadencePatterns(context.Background(), &deterministicEmbedder{dims: 768}, retryClient, retryOpts); err == nil {
		t.Fatal("expected error on dropped HTTP response after upsert")
	}
	resRetry, err := SeedCadencePatterns(context.Background(), &deterministicEmbedder{dims: 768}, retryClient, retryOpts)
	if err != nil {
		t.Fatalf("CP-12 retry failed: %v", err)
	}
	if len(retrySim.collections[CollectionCadencePatterns].points) != resRetry.Indexed {
		t.Fatalf("expected idempotent convergence to %d points after CP-12 retry, got %d", resRetry.Indexed, len(retrySim.collections[CollectionCadencePatterns].points))
	}

	// Surviving-ID invariance when one document is deleted between runs
	docsInitial := []SeedDocument{
		{ID: "agensi:skill-a", Title: "Skill A", Body: "Alpha capability", Category: "agensi_skills", Source: "postgres"},
		{ID: "agensi:skill-b", Title: "Skill B", Body: "Beta capability", Category: "agensi_skills", Source: "postgres"},
	}
	invSim := newQdrantSimulator()
	invSrv := invSim.server()
	defer invSrv.Close()
	invClient := &qdrant.Client{BaseURL: invSrv.URL, HTTPClient: invSrv.Client()}
	invOpts := DefaultSeedOptions()
	invOpts.LogWriter = &bytes.Buffer{}

	if _, err := seedCollectionWithDocs(context.Background(), CollectionPortfolioDocs, docsInitial, &deterministicEmbedder{dims: 768}, invClient, invOpts); err != nil {
		t.Fatalf("initial surviving-ID seed failed: %v", err)
	}
	skillBID := qdrant.CollectionPointID(CollectionPortfolioDocs, "agensi:skill-b")
	skillAID := qdrant.CollectionPointID(CollectionPortfolioDocs, "agensi:skill-a")
	resAfterDel, err := seedCollectionWithDocs(context.Background(), CollectionPortfolioDocs, docsInitial[1:], &deterministicEmbedder{dims: 768}, invClient, invOpts)
	if err != nil {
		t.Fatalf("post-delete seed failed: %v", err)
	}
	if resAfterDel.Pruned != 1 {
		t.Fatalf("expected 1 pruned point for deleted row, got %d", resAfterDel.Pruned)
	}
	colAfter := invSim.collections[CollectionPortfolioDocs]
	if _, keep := colAfter.points[skillBID]; !keep {
		t.Fatalf("expected surviving UUIDv5 %s to remain unchanged", skillBID)
	}
	if _, gone := colAfter.points[skillAID]; gone {
		t.Fatalf("expected deleted UUIDv5 %s to be pruned", skillAID)
	}
}

func TestDegradedPostgresStoreFailsPortfolioDocsSeed(t *testing.T) {
	t.Setenv("PG_DISABLE_LIVE", "false")
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:1/aklapper?sslmode=disable")

	degraded := pg.OpenBestEffort(context.Background())
	if degraded.OpenError() == nil {
		t.Fatal("expected degraded OpenBestEffort store to record OpenError")
	}

	sim := newQdrantSimulator()
	srv := sim.server()
	defer srv.Close()

	var logBuf bytes.Buffer
	opts := DefaultSeedOptions()
	opts.LogWriter = &logBuf
	_, err := SeedPortfolioDocs(
		context.Background(),
		&deterministicEmbedder{dims: 768},
		&qdrant.Client{BaseURL: srv.URL, HTTPClient: srv.Client()},
		degraded,
		opts,
	)
	if !errors.Is(err, ErrPostgresUnavailable) {
		t.Fatalf("expected ErrPostgresUnavailable, got %v", err)
	}
	if len(sim.requests) != 0 {
		t.Fatalf("expected zero Qdrant requests on degraded PG, got %v", sim.requests)
	}
	if !strings.Contains(logBuf.String(), "UNSOUND_CONDITION") || !strings.Contains(logBuf.String(), "qdrant.seed.pg_corpus_unavailable") {
		t.Fatalf("expected UNSOUND_CONDITION log, got %s", logBuf.String())
	}
}

func TestEmbedConcurrencyPreservesRootCauseWithHTTPClient(t *testing.T) {
	t.Parallel()

	for _, mode := range []string{"empty", "http503"} {
		mode := mode
		t.Run(mode, func(t *testing.T) {
			t.Parallel()
			sim := newQdrantSimulator()
			qSrv := sim.server()
			defer qSrv.Close()

			llmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var req struct {
					Input string `json:"input"`
				}
				_ = json.NewDecoder(r.Body).Decode(&req)
				if strings.Contains(req.Input, "Solar Forge Telemetry Card") {
					select {
					case <-time.After(60 * time.Millisecond):
					case <-r.Context().Done():
						return
					}
					vec := make([]float32, 768)
					vec[0] = 0.1
					_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{{"embedding": vec}}})
					return
				}
				if mode == "empty" {
					_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{{"embedding": []float32{}}}})
					return
				}
				http.Error(w, "embed backend down", http.StatusServiceUnavailable)
			}))
			defer llmSrv.Close()

			provider := &llm.LocalClient{BaseURL: llmSrv.URL + "/v1", EmbedModel: "embedding", HTTPClient: llmSrv.Client()}
			var logBuf bytes.Buffer
			opts := DefaultSeedOptions()
			opts.LogWriter = &logBuf

			_, err := SeedCadencePatterns(context.Background(), provider, &qdrant.Client{BaseURL: qSrv.URL, HTTPClient: qSrv.Client()}, opts)
			if err == nil {
				t.Fatal("expected error")
			}
			if errors.Is(err, context.Canceled) || strings.Contains(err.Error(), "context canceled") {
				t.Fatalf("expected root-cause error instead of context.Canceled: %v", err)
			}
			if strings.Contains(err.Error(), "pattern-solar-forge-telemetry") {
				t.Fatalf("expected root-cause error to identify failing doc rather than slow in-flight doc 0: %v", err)
			}
			if mode == "empty" {
				if !errors.Is(err, ErrInvalidVectorConfig) {
					t.Fatalf("expected ErrInvalidVectorConfig for empty vector via LocalClient.Embed, got %v", err)
				}
				if !strings.Contains(logBuf.String(), "UNSOUND_CONDITION") || !strings.Contains(logBuf.String(), "qdrant.seed.invalid_vector_config") {
					t.Fatalf("expected UNSOUND_CONDITION log on concurrent empty vector, got %s", logBuf.String())
				}
			} else if !errors.Is(err, ErrEmbedOperation) || !strings.Contains(err.Error(), "503") {
				t.Fatalf("expected ErrEmbedOperation 503 root error via LocalClient.Embed, got %v", err)
			}
			if len(sim.requests) != 0 {
				t.Fatalf("expected zero Qdrant HTTP requests, got %v", sim.requests)
			}
		})
	}
}
