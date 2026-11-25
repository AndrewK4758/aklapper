package main

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const (
	rrfConstant        = 60.0
	rrfArmLimit        = 8
	rrfMaxChunksPerDoc = 2
	rrfNormDenom       = 2.0 / (rrfConstant + 1.0)
)

type hybridCandidate struct {
	DocKey          string
	ChunkIndex      int
	Title           string
	SectionHeading  string
	Category        string
	Kind            string
	Snippet         string
	DenseScore      float64
	LexicalRank     int
	RRFScore        float64
	NormalizedScore float64
}

type hybridSearchResult struct {
	Candidates      []hybridCandidate
	TopDenseScore   float64
	LexicalHitCount int
	DenseDegraded   bool
	LexicalDegraded bool
}

func intFromPayload(payload map[string]any, key string) int {
	if payload == nil {
		return 0
	}
	switch v := payload[key].(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func extractDocKeyFromPayload(payload map[string]any, fallbackID any) string {
	if key := stringFromPayload(payload, "docKey", ""); key != "" {
		return key
	}
	return stringFromPayload(payload, "docId", fmt.Sprintf("%v", fallbackID))
}

// fuseHybridRRF pre-filters Qdrant dense hits by hit.Score >= minScore, fuses keyed by
// (docKey, chunkIndex) with PG19 lexical hits via 1/(60+rank), caps at max 2 chunks per docKey,
// and normalizes display scores cleanly into [0.0, 1.0].
func fuseHybridRRF(
	denseHits []qdrant.SearchHit,
	lexicalHits []pg.LexicalDossierHit,
	minScore float64,
	maxCandidates int,
) hybridSearchResult {
	if maxCandidates <= 0 {
		maxCandidates = 8
	}

	topDense := 0.0
	type chunkKey struct {
		docKey     string
		chunkIndex int
	}

	byChunk := make(map[chunkKey]*hybridCandidate)
	docChunks := make(map[string][]*hybridCandidate)

	// Dense arm: pre-filter strictly at minScore before RRF fusion.
	denseRank := 0
	for _, hit := range denseHits {
		if hit.Score > topDense {
			topDense = hit.Score
		}
		if hit.Score < minScore {
			continue
		}
		denseRank++
		docKey := extractDocKeyFromPayload(hit.Payload, hit.ID)
		chunkIdx := max(0, intFromPayload(hit.Payload, "chunkIndex"))
		k := chunkKey{docKey: docKey, chunkIndex: chunkIdx}
		contrib := 1.0 / (rrfConstant + float64(denseRank))
		if existing, ok := byChunk[k]; ok {
			existing.RRFScore += contrib
			if hit.Score > existing.DenseScore {
				existing.DenseScore = hit.Score
			}
			continue
		}
		cand := &hybridCandidate{
			DocKey:         docKey,
			ChunkIndex:     chunkIdx,
			Title:          stringFromPayload(hit.Payload, "title", "Portfolio Evidence"),
			SectionHeading: stringFromPayload(hit.Payload, "sectionHeading", ""),
			Category:       stringFromPayload(hit.Payload, "category", "portfolio"),
			Kind:           stringFromPayload(hit.Payload, "dossierKind", ""),
			Snippet:        stringFromPayload(hit.Payload, "snippet", ""),
			DenseScore:     hit.Score,
			RRFScore:       contrib,
		}
		byChunk[k] = cand
		docChunks[docKey] = append(docChunks[docKey], cand)
	}

	// Lexical arm: add 1/(60+lexRank) to matching dense chunks of that docKey, or synthesize
	// a chunk-0 summary candidate when no dense chunk of that docKey passed >= minScore.
	for i, lex := range lexicalHits {
		lexRank := i + 1
		contrib := 1.0 / (rrfConstant + float64(lexRank))
		if existingList := docChunks[lex.DocKey]; len(existingList) > 0 {
			for _, cand := range existingList {
				cand.RRFScore += contrib
				if cand.LexicalRank == 0 || lexRank < cand.LexicalRank {
					cand.LexicalRank = lexRank
				}
			}
			continue
		}
		k := chunkKey{docKey: lex.DocKey, chunkIndex: 0}
		cand := &hybridCandidate{
			DocKey:         lex.DocKey,
			ChunkIndex:     0,
			Title:          strings.TrimSpace(lex.Title),
			SectionHeading: "Summary",
			Category:       "career_dossier",
			Kind:           lex.Kind,
			Snippet:        strings.TrimSpace(lex.SummaryBody),
			LexicalRank:    lexRank,
			RRFScore:       contrib,
		}
		byChunk[k] = cand
		docChunks[lex.DocKey] = []*hybridCandidate{cand}
	}

	all := make([]hybridCandidate, 0, len(byChunk))
	for _, cand := range byChunk {
		norm := math.Min(1.0, cand.RRFScore/rrfNormDenom)
		if norm < 0 {
			norm = 0
		}
		cand.NormalizedScore = math.Round(norm*10000) / 10000
		all = append(all, *cand)
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].RRFScore != all[j].RRFScore {
			return all[i].RRFScore > all[j].RRFScore
		}
		if all[i].DenseScore != all[j].DenseScore {
			return all[i].DenseScore > all[j].DenseScore
		}
		if all[i].DocKey != all[j].DocKey {
			return all[i].DocKey < all[j].DocKey
		}
		return all[i].ChunkIndex < all[j].ChunkIndex
	})

	perDocCount := make(map[string]int)
	capped := make([]hybridCandidate, 0, min(len(all), maxCandidates))
	for _, cand := range all {
		if perDocCount[cand.DocKey] >= rrfMaxChunksPerDoc {
			continue
		}
		perDocCount[cand.DocKey]++
		capped = append(capped, cand)
		if len(capped) >= maxCandidates {
			break
		}
	}

	return hybridSearchResult{
		Candidates:      capped,
		TopDenseScore:   topDense,
		LexicalHitCount: len(lexicalHits),
	}
}

func executeHybridSearch(
	ctx context.Context,
	provider llm.Provider,
	vectorStore *qdrant.Client,
	store *pg.Store,
	queryText string,
	maxCandidates int,
	corrID string,
) (hybridSearchResult, error) {
	var (
		wg        sync.WaitGroup
		lexHits   []pg.LexicalDossierHit
		lexErr    error
		denseHits []qdrant.SearchHit
		denseErr  error
	)

	wg.Add(2)
	go func() {
		defer wg.Done()
		if store == nil {
			return
		}
		lexHits, lexErr = store.SearchPublishedDossiersLexical(ctx, queryText, rrfArmLimit)
	}()
	go func() {
		defer wg.Done()
		if provider == nil || vectorStore == nil {
			denseErr = fmt.Errorf("dense retrieval dependency unavailable")
			return
		}
		vec, err := embedQueryText(ctx, provider, queryText)
		if err != nil {
			denseErr = err
			return
		}
		denseHits, denseErr = vectorStore.Search(ctx, portfolioCollection, vec, rrfArmLimit)
	}()
	wg.Wait()

	if denseErr != nil && len(lexHits) == 0 {
		return hybridSearchResult{}, denseErr
	}
	if lexErr != nil && denseErr != nil {
		return hybridSearchResult{}, denseErr
	}

	res := fuseHybridRRF(denseHits, lexHits, minGroundScore, maxCandidates)
	if denseErr != nil {
		res.DenseDegraded = true
		logAskEvent("ai_ask.retrieval.arm_degraded", map[string]any{
			"seam_type":     "BOUNDARY_FAULT",
			"arm":           "dense",
			"lexicalHits":   len(lexHits),
			"correlationId": corrID,
		})
	}
	if lexErr != nil {
		res.LexicalDegraded = true
		logAskEvent("ai_ask.retrieval.arm_degraded", map[string]any{
			"seam_type":     "BOUNDARY_FAULT",
			"arm":           "lexical",
			"denseHits":     len(denseHits),
			"correlationId": corrID,
		})
	}
	return res, nil
}

func candidatesToAskSources(candidates []hybridCandidate) []contracts.AskSource {
	sources := make([]contracts.AskSource, 0, len(candidates))
	for _, c := range candidates {
		id := c.DocKey
		if c.ChunkIndex > 0 {
			id = fmt.Sprintf("%s#%d", c.DocKey, c.ChunkIndex)
		}
		sources = append(sources, contracts.AskSource{
			ID:             id,
			DocKey:         c.DocKey,
			Title:          c.Title,
			SectionHeading: c.SectionHeading,
			Snippet:        c.Snippet,
			Score:          c.NormalizedScore,
			Category:       c.Category,
		})
	}
	return sources
}
