package pg

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	reindexAdvisoryLockKey = "ai_ask_portfolio_reindex"
	maxDossierChunkChars   = 1400
	maxProfileCoreChars    = 2000
)

type CareerDossierSection struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
}

type CareerDossierRecord struct {
	Slug                   string
	Kind                   string
	Title                  string
	DomainLabel            string
	RoleTitle              string
	Timeframe              string
	Skills                 []string
	SummaryBody            string
	Sections               []CareerDossierSection
	PublishStatus          string
	SanitizationVerifiedAt *time.Time
	SortOrder              int
}

type LexicalDossierHit struct {
	Slug        string
	DocKey      string
	Kind        string
	Title       string
	DomainLabel string
	RoleTitle   string
	SummaryBody string
	Rank        float64
}

func truncateRunes(raw string, maxChars int) string {
	trimmed := strings.TrimSpace(raw)
	if maxChars <= 0 || utf8.RuneCountInString(trimmed) <= maxChars {
		return trimmed
	}
	runes := []rune(trimmed)
	return strings.TrimSpace(string(runes[:maxChars]))
}

func expandCareerDossierChunks(rec CareerDossierRecord) []CorpusDocument {
	docKey := "dossier:" + strings.TrimSpace(rec.Slug)
	metaParts := make([]string, 0, 5)
	if strings.TrimSpace(rec.DomainLabel) != "" {
		metaParts = append(metaParts, "Domain: "+strings.TrimSpace(rec.DomainLabel))
	}
	if strings.TrimSpace(rec.RoleTitle) != "" {
		metaParts = append(metaParts, "Role: "+strings.TrimSpace(rec.RoleTitle))
	}
	if strings.TrimSpace(rec.Timeframe) != "" {
		metaParts = append(metaParts, "Timeframe: "+strings.TrimSpace(rec.Timeframe))
	}
	if len(rec.Skills) > 0 {
		metaParts = append(metaParts, "Skills: "+strings.Join(rec.Skills, ", "))
	}
	summarySnippet := strings.TrimSpace(rec.SummaryBody)
	if len(metaParts) > 0 {
		summarySnippet = strings.TrimSpace(summarySnippet + "\n" + strings.Join(metaParts, " | "))
	}

	chunks := make([]CorpusDocument, 0, 1+len(rec.Sections))
	chunks = append(chunks, CorpusDocument{
		ID:             docKey,
		ChunkIndex:     0,
		Title:          strings.TrimSpace(rec.Title),
		SectionHeading: "Summary",
		Snippet:        truncateRunes(summarySnippet, maxDossierChunkChars),
		Category:       "career_dossier",
		Kind:           strings.TrimSpace(rec.Kind),
		Source:         "postgres",
	})

	for idx, sec := range rec.Sections {
		heading := strings.TrimSpace(sec.Heading)
		body := strings.TrimSpace(sec.Body)
		if heading == "" && body == "" {
			continue
		}
		if heading == "" {
			heading = fmt.Sprintf("Section %d", idx+1)
		}
		chunks = append(chunks, CorpusDocument{
			ID:             docKey,
			ChunkIndex:     idx + 1,
			Title:          strings.TrimSpace(rec.Title),
			SectionHeading: heading,
			Snippet:        truncateRunes(heading+": "+body, maxDossierChunkChars),
			Category:       "career_dossier",
			Kind:           strings.TrimSpace(rec.Kind),
			Source:         "postgres",
		})
	}
	return chunks
}

func queryPublishedCareerDossierChunks(ctx context.Context, q rowQuerier) ([]CorpusDocument, error) {
	rows, err := q.Query(
		ctx,
		`SELECT slug, kind, title, domain_label, role_title, timeframe, skills, summary_body, sections_json::text, sort_order
		 FROM career_dossiers
		 WHERE publish_status = 'published' AND sanitization_verified_at IS NOT NULL
		 ORDER BY sort_order ASC, slug ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("load career_dossiers corpus: %w", err)
	}
	defer rows.Close()

	var out []CorpusDocument
	for rows.Next() {
		var rec CareerDossierRecord
		var sectionsRaw string
		if scanErr := rows.Scan(
			&rec.Slug, &rec.Kind, &rec.Title, &rec.DomainLabel, &rec.RoleTitle,
			&rec.Timeframe, &rec.Skills, &rec.SummaryBody, &sectionsRaw, &rec.SortOrder,
		); scanErr != nil {
			return nil, fmt.Errorf("scan career_dossiers corpus: %w", scanErr)
		}
		rec.PublishStatus = "published"
		if strings.TrimSpace(sectionsRaw) != "" {
			_ = json.Unmarshal([]byte(sectionsRaw), &rec.Sections)
		}
		out = append(out, expandCareerDossierChunks(rec)...)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate career_dossiers corpus: %w", rowsErr)
	}
	return out, nil
}

// UpsertMemoryCareerDossier seeds a career dossier into the in-memory store for isolated unit tests.
func (s *Store) UpsertMemoryCareerDossier(rec CareerDossierRecord) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dossiers == nil {
		s.dossiers = make(map[string]CareerDossierRecord)
	}
	s.dossiers[strings.TrimSpace(rec.Slug)] = rec
}

func (s *Store) publishedMemoryDossiersLocked() []CareerDossierRecord {
	var list []CareerDossierRecord
	for _, rec := range s.dossiers {
		if rec.PublishStatus != "published" || rec.SanitizationVerifiedAt == nil {
			continue
		}
		list = append(list, rec)
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].SortOrder != list[j].SortOrder {
			return list[i].SortOrder < list[j].SortOrder
		}
		return list[i].Slug < list[j].Slug
	})
	return list
}

func (s *Store) loadMemoryCareerDossierChunks() []CorpusDocument {
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	list := s.publishedMemoryDossiersLocked()
	var out []CorpusDocument
	for _, rec := range list {
		out = append(out, expandCareerDossierChunks(rec)...)
	}
	return out
}

// LoadPinnedProfileCore returns the highest-priority published profile_core dossier capped for prompt inclusion.
func (s *Store) LoadPinnedProfileCore(ctx context.Context) (*CorpusDocument, error) {
	if s == nil {
		return nil, nil
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		for _, rec := range s.publishedMemoryDossiersLocked() {
			if rec.Kind == "profile_core" {
				chunks := expandCareerDossierChunks(rec)
				if len(chunks) > 0 {
					doc := chunks[0]
					doc.Snippet = truncateRunes(doc.Snippet, maxProfileCoreChars)
					return &doc, nil
				}
			}
		}
		return nil, nil
	}

	rows, err := s.pool.Query(
		ctx,
		`SELECT slug, kind, title, domain_label, role_title, timeframe, skills, summary_body, sections_json::text, sort_order
		 FROM career_dossiers
		 WHERE kind = 'profile_core' AND publish_status = 'published' AND sanitization_verified_at IS NOT NULL
		 ORDER BY sort_order ASC, slug ASC
		 LIMIT 1`,
	)
	if err != nil {
		return nil, fmt.Errorf("load pinned profile_core dossier: %w", err)
	}
	defer rows.Close()
	if !rows.Next() {
		return nil, rows.Err()
	}
	var rec CareerDossierRecord
	var sectionsRaw string
	if scanErr := rows.Scan(
		&rec.Slug, &rec.Kind, &rec.Title, &rec.DomainLabel, &rec.RoleTitle,
		&rec.Timeframe, &rec.Skills, &rec.SummaryBody, &sectionsRaw, &rec.SortOrder,
	); scanErr != nil {
		return nil, fmt.Errorf("scan pinned profile_core dossier: %w", scanErr)
	}
	if strings.TrimSpace(sectionsRaw) != "" {
		_ = json.Unmarshal([]byte(sectionsRaw), &rec.Sections)
	}
	chunks := expandCareerDossierChunks(rec)
	if len(chunks) == 0 {
		return nil, nil
	}
	doc := chunks[0]
	doc.Snippet = truncateRunes(doc.Snippet, maxProfileCoreChars)
	return &doc, nil
}

// SearchPublishedDossiersLexical queries published career_dossiers using dual english+simple FTS ranking.
func (s *Store) SearchPublishedDossiersLexical(ctx context.Context, query string, limit int) ([]LexicalDossierHit, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" || s == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 8
	}
	if s.pool == nil {
		return s.searchMemoryDossiersLexical(trimmed, limit), nil
	}

	orExpr := buildLexicalOrQuery(trimmed)
	if orExpr == "" {
		return nil, nil
	}

	rows, err := s.pool.Query(
		ctx,
		`WITH q AS (
			SELECT to_tsquery('english', $1) AS q_en,
			       to_tsquery('simple', $1) AS q_simple,
			       websearch_to_tsquery('english', $2) AS q_web_en,
			       websearch_to_tsquery('simple', $2) AS q_web_simple
		)
		SELECT d.slug, d.kind, d.title, d.domain_label, d.role_title, d.summary_body,
		       (
		           GREATEST(ts_rank_cd(d.search_tsv, q.q_en), ts_rank_cd(d.search_tsv, q.q_simple))
		           + CASE WHEN d.search_tsv @@ q.q_web_en OR d.search_tsv @@ q.q_web_simple THEN 0.5 ELSE 0.0 END
		       )::float8 AS rank
		FROM career_dossiers d, q
		WHERE d.publish_status = 'published'
		  AND d.sanitization_verified_at IS NOT NULL
		  AND (d.search_tsv @@ q.q_en OR d.search_tsv @@ q.q_simple)
		ORDER BY rank DESC, d.sort_order ASC, d.slug ASC
		LIMIT $3`,
		orExpr, trimmed, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("lexical search career_dossiers: %w", err)
	}
	defer rows.Close()

	var hits []LexicalDossierHit
	for rows.Next() {
		var hit LexicalDossierHit
		if scanErr := rows.Scan(
			&hit.Slug, &hit.Kind, &hit.Title, &hit.DomainLabel, &hit.RoleTitle, &hit.SummaryBody, &hit.Rank,
		); scanErr != nil {
			return nil, fmt.Errorf("scan lexical dossier hit: %w", scanErr)
		}
		hit.DocKey = "dossier:" + hit.Slug
		if hit.Rank > 0 {
			hits = append(hits, hit)
		}
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate lexical dossier hits: %w", rowsErr)
	}
	return hits, nil
}

func (s *Store) searchMemoryDossiersLexical(query string, limit int) []LexicalDossierHit {
	s.mu.Lock()
	defer s.mu.Unlock()
	orExpr := buildLexicalOrQuery(query)
	if orExpr == "" {
		return nil
	}
	terms := strings.Split(orExpr, " | ")
	var hits []LexicalDossierHit
	for _, rec := range s.publishedMemoryDossiersLocked() {
		haystackParts := []string{rec.Title, rec.DomainLabel, rec.RoleTitle, rec.SummaryBody, strings.Join(rec.Skills, " ")}
		for _, sec := range rec.Sections {
			haystackParts = append(haystackParts, sec.Heading, sec.Body)
		}
		haystack := strings.ToLower(strings.Join(haystackParts, " "))
		matches := 0
		for _, token := range terms {
			if len(token) >= 2 && strings.Contains(haystack, token) {
				matches++
			}
		}
		if matches > 0 {
			hits = append(hits, LexicalDossierHit{
				Slug: rec.Slug, DocKey: "dossier:" + rec.Slug, Kind: rec.Kind,
				Title: rec.Title, DomainLabel: rec.DomainLabel, RoleTitle: rec.RoleTitle,
				SummaryBody: rec.SummaryBody, Rank: float64(matches) / float64(max(1, len(terms))),
			})
		}
	}
	sort.Slice(hits, func(i, j int) bool {
		if hits[i].Rank != hits[j].Rank {
			return hits[i].Rank > hits[j].Rank
		}
		return hits[i].Slug < hits[j].Slug
	})
	if len(hits) > limit {
		hits = hits[:limit]
	}
	return hits
}
