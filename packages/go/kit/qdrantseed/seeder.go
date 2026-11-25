package qdrantseed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"

	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const (
	CollectionCadencePatterns = "cadence_patterns"
	CollectionPortfolioDocs   = "portfolio_docs"
)

var (
	ErrPostgresUnavailable = errors.New("postgres corpus unavailable")
	ErrInvalidVectorConfig = errors.New("invalid vector config")
	ErrEmbedOperation      = errors.New("embedding operation failed")
	ErrQdrantOperation     = errors.New("qdrant operation failed")
	ErrQdrantScroll        = errors.New("qdrant scroll failed")
	ErrQdrantDelete        = errors.New("qdrant delete failed")
)

type SeedOptions struct {
	Collections  []string
	PruneOrphans bool
	DryRun       bool
	Concurrency  int
	LogWriter    io.Writer
}

func DefaultSeedOptions() SeedOptions {
	return SeedOptions{
		Collections:  []string{CollectionCadencePatterns, CollectionPortfolioDocs},
		PruneOrphans: true,
		DryRun:       false,
		Concurrency:  4,
		LogWriter:    os.Stderr,
	}
}

type CollectionResult struct {
	Collection string `json:"collection"`
	Indexed    int    `json:"indexed"`
	Pruned     int    `json:"pruned"`
	VectorSize int    `json:"vectorSize"`
	Provider   string `json:"provider"`
}

func emitSeam(w io.Writer, seamType, event, collection string, extra map[string]any) {
	if w == nil {
		w = os.Stderr
	}
	payload := map[string]any{"seam_type": seamType, "event": event, "collection": collection}
	for k, v := range extra {
		payload[k] = v
	}
	if raw, err := json.Marshal(payload); err == nil {
		_, _ = fmt.Fprintln(w, string(raw))
	}
}

func clampConcurrency(n int) int {
	if n <= 0 {
		return 4
	}
	if n > 8 {
		return 8
	}
	return n
}

func buildPointPayload(collection string, doc SeedDocument) map[string]any {
	if collection == CollectionCadencePatterns {
		tags := doc.Tags
		if tags == nil {
			tags = []string{}
		}
		return map[string]any{
			"docId": doc.ID, "title": doc.Title, "summary": doc.Body,
			"category": doc.Category, "chordPhase": doc.ChordPhase, "tags": tags, "source": doc.Source,
		}
	}
	return map[string]any{
		"docId": doc.ID, "title": doc.Title, "snippet": doc.Body, "category": doc.Category, "source": doc.Source,
	}
}

func embedAllConcurrently(ctx context.Context, provider llm.Provider, docs []SeedDocument, concurrency int) ([][]float32, int, error) {
	if provider == nil {
		return nil, 0, fmt.Errorf("%w: embedding provider is nil", ErrEmbedOperation)
	}
	workers := clampConcurrency(concurrency)
	vectors := make([][]float32, len(docs))

	workCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	jobs := make(chan int, len(docs))
	for i := range docs {
		jobs <- i
	}
	close(jobs)

	var (
		wg           sync.WaitGroup
		firstErrOnce sync.Once
		firstErr     error
	)
	// Record the root failure atomically before canceling workCtx so sibling context.Canceled
	// errors from aborted HTTP requests can never overwrite ErrInvalidVectorConfig or HTTP diagnostics.
	recordErr := func(err error) {
		firstErrOnce.Do(func() {
			firstErr = err
		})
		cancel()
	}

	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for idx := range jobs {
				if workCtx.Err() != nil {
					recordErr(workCtx.Err())
					return
				}
				vec, err := provider.Embed(workCtx, strings.TrimSpace(docs[idx].Title+"\n"+docs[idx].Body))
				if err != nil {
					if errors.Is(err, llm.ErrEmptyEmbedding) {
						recordErr(fmt.Errorf("%w: doc %q: %w", ErrInvalidVectorConfig, docs[idx].ID, err))
					} else {
						recordErr(fmt.Errorf("%w: doc %q: %v", ErrEmbedOperation, docs[idx].ID, err))
					}
					return
				}
				if len(vec) == 0 {
					recordErr(fmt.Errorf("%w: doc %q returned empty vector", ErrInvalidVectorConfig, docs[idx].ID))
					return
				}
				if dimErr := llm.ValidateEmbeddingDims(vec); dimErr != nil {
					recordErr(fmt.Errorf("%w: doc %q: %v", ErrInvalidVectorConfig, docs[idx].ID, dimErr))
					return
				}
				vectors[idx] = vec
			}
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return nil, 0, firstErr
	}

	vectorSize := 0
	for i := range docs {
		if len(vectors[i]) == 0 {
			return nil, 0, fmt.Errorf("%w: doc %q produced empty vector", ErrInvalidVectorConfig, docs[i].ID)
		}
		if vectorSize == 0 {
			vectorSize = len(vectors[i])
		} else if len(vectors[i]) != vectorSize {
			return nil, 0, fmt.Errorf("%w: intra-batch dimension drift at doc %q (expected %d, got %d)", ErrInvalidVectorConfig, docs[i].ID, vectorSize, len(vectors[i]))
		}
	}
	if vectorSize <= 0 {
		return nil, 0, fmt.Errorf("%w: vector size must be positive", ErrInvalidVectorConfig)
	}
	return vectors, vectorSize, nil
}

func pruneOrphanPoints(ctx context.Context, vectorStore *qdrant.Client, collection string, activeIDs map[string]struct{}) (int, error) {
	existingIDs, err := vectorStore.ListTypedPointIDs(ctx, collection)
	if err != nil {
		return 0, fmt.Errorf("%w: %w: %v", ErrQdrantOperation, ErrQdrantScroll, err)
	}
	var staleIDs []any
	for _, pt := range existingIDs {
		if _, keep := activeIDs[pt.Key]; keep {
			continue
		}
		staleIDs = append(staleIDs, pt.Raw)
	}
	if len(staleIDs) == 0 {
		return 0, nil
	}
	if err := vectorStore.DeletePoints(ctx, collection, staleIDs); err != nil {
		return 0, fmt.Errorf("%w: %w: %v", ErrQdrantOperation, ErrQdrantDelete, err)
	}
	return len(staleIDs), nil
}

func seedCollectionWithDocs(
	ctx context.Context, collection string, docs []SeedDocument,
	provider llm.Provider, vectorStore *qdrant.Client, opts SeedOptions,
) (CollectionResult, error) {
	logW := opts.LogWriter
	providerName := ""
	if provider != nil {
		providerName = provider.Name()
	}

	if err := ValidateOriginConfidentiality(docs); err != nil {
		emitSeam(logW, "BOUNDARY_FAULT", "qdrant.seed.origin_confidentiality_violation", collection, map[string]any{"detail": err.Error()})
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_sanitization"})
		return CollectionResult{}, err
	}
	if opts.DryRun {
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "dry_run"})
		return CollectionResult{Collection: collection, Indexed: len(docs), Provider: providerName}, nil
	}
	if vectorStore == nil {
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_qdrant"})
		return CollectionResult{}, fmt.Errorf("%w: qdrant client is nil", ErrQdrantOperation)
	}

	vectors, vectorSize, err := embedAllConcurrently(ctx, provider, docs, opts.Concurrency)
	if err != nil {
		if errors.Is(err, ErrInvalidVectorConfig) {
			emitSeam(logW, "UNSOUND_CONDITION", "qdrant.seed.invalid_vector_config", collection, map[string]any{"detail": err.Error()})
		}
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_embed"})
		return CollectionResult{}, err
	}
	if err := vectorStore.EnsureCollection(ctx, collection, vectorSize); err != nil {
		emitSeam(logW, "UNSOUND_CONDITION", "qdrant.seed.invalid_vector_config", collection, map[string]any{"detail": err.Error()})
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_qdrant"})
		return CollectionResult{}, fmt.Errorf("%w: %v", ErrQdrantOperation, err)
	}

	points := make([]qdrant.Point, 0, len(docs))
	activeIDs := make(map[string]struct{}, len(docs))
	for i, doc := range docs {
		ptID := qdrant.CollectionPointID(collection, doc.ID)
		activeIDs[ptID] = struct{}{}
		points = append(points, qdrant.Point{ID: ptID, Vector: vectors[i], Payload: buildPointPayload(collection, doc)})
	}
	if err := vectorStore.UpsertPoints(ctx, collection, points); err != nil {
		emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_qdrant"})
		return CollectionResult{}, fmt.Errorf("%w: %v", ErrQdrantOperation, err)
	}

	pruned := 0
	if opts.PruneOrphans {
		var pruneErr error
		if pruned, pruneErr = pruneOrphanPoints(ctx, vectorStore, collection, activeIDs); pruneErr != nil {
			emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "failed_qdrant"})
			return CollectionResult{}, pruneErr
		}
	}

	emitSeam(logW, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", collection, map[string]any{"branch": "succeeded"})
	emitSeam(logW, "DELTA_AUDIT_GAP", "qdrant.seed.collection_reconciled", collection, map[string]any{
		"indexed": len(points), "pruned": pruned, "vectorSize": vectorSize, "provider": providerName,
	})
	return CollectionResult{Collection: collection, Indexed: len(points), Pruned: pruned, VectorSize: vectorSize, Provider: providerName}, nil
}

// SeedCadencePatterns validates, embeds, upserts, and reconciles curated cadence_patterns.
func SeedCadencePatterns(ctx context.Context, provider llm.Provider, vectorStore *qdrant.Client, opts SeedOptions) (CollectionResult, error) {
	return seedCollectionWithDocs(ctx, CollectionCadencePatterns, CuratedCadencePatterns(), provider, vectorStore, opts)
}

// SeedPortfolioDocs loads PostgreSQL corpus docs (if store != nil), merges consolidated curated
// portfolio/methodology docs, validates confidentiality, and upserts + prunes portfolio_docs.
func SeedPortfolioDocs(ctx context.Context, provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store, opts SeedOptions) (CollectionResult, error) {
	var pgDocs []SeedDocument
	if store != nil {
		rawDocs, err := store.LoadCorpusDocs(ctx)
		if err != nil {
			emitSeam(opts.LogWriter, "UNSOUND_CONDITION", "qdrant.seed.pg_corpus_unavailable", CollectionPortfolioDocs, map[string]any{"detail": err.Error()})
			emitSeam(opts.LogWriter, "RULE_DIVERGENCE", "qdrant.seed.execution_outcome", CollectionPortfolioDocs, map[string]any{"branch": "failed_pg"})
			return CollectionResult{}, fmt.Errorf("%w: %v", ErrPostgresUnavailable, err)
		}
		pgDocs = FromPGCorpus(rawDocs)
	}
	return seedCollectionWithDocs(ctx, CollectionPortfolioDocs, MergeSeedDocuments(CuratedPortfolioDocs(), pgDocs), provider, vectorStore, opts)
}

// SeedAll seeds the requested collections (defaulting to cadence_patterns and portfolio_docs).
func SeedAll(ctx context.Context, provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store, opts SeedOptions) ([]CollectionResult, error) {
	cols := opts.Collections
	if len(cols) == 0 {
		cols = []string{CollectionCadencePatterns, CollectionPortfolioDocs}
	}
	results := make([]CollectionResult, 0, len(cols))
	for _, col := range cols {
		var (
			res CollectionResult
			err error
		)
		switch col {
		case CollectionCadencePatterns:
			res, err = SeedCadencePatterns(ctx, provider, vectorStore, opts)
		case CollectionPortfolioDocs:
			res, err = SeedPortfolioDocs(ctx, provider, vectorStore, store, opts)
		default:
			return results, fmt.Errorf("unsupported qdrant collection %q", col)
		}
		if err != nil {
			return results, fmt.Errorf("collection %s failed: %w", col, err)
		}
		results = append(results, res)
	}
	return results, nil
}
