package pg

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type rowQuerier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

// CuratedPortfolioDocs provides high-signal baseline portfolio facts always included during indexing.
func CuratedPortfolioDocs() []CorpusDocument {
	return []CorpusDocument{
		{
			ID:       "curated-stack",
			Title:    "Andrew Klapper -- Core Architecture & Stack",
			Snippet:  "Principal full-stack and cloud systems engineer specializing in TypeScript, React 19, React Router 8 SSR, Fastify 5, Go 1.27 microservices, PostgreSQL 19 with Drizzle ORM, Qdrant vector search, and GCP (Cloud Run scale-to-zero + Direct VPC Egress).",
			Category: "dossier",
			Source:   "curated",
		},
		{
			ID:       "curated-cadence",
			Title:    "CADENCE -- Agentic SDLC & CHORD Pipeline",
			Snippet:  "Designed CADENCE, a specification-driven multi-agent delivery methodology using the CHORD phased workflow (triage, spec, build, gate) with isolated worktrees, deterministic verification gates, and zero-trust sandboxed artifact previews.",
			Category: "dossier",
			Source:   "curated",
		},
		{
			ID:       "curated-security",
			Title:    "Security & Cloud Operations Posture",
			Snippet:  "Implemented WebAuthn Passkeys with optional TOTP 2FA, Argon2id password verification, Cloud Run Direct IAP, OIDC + HMAC-SHA256 signed internal service assertions between Node SSR BFFs and Go microservices, and PostgreSQL CHECK constraints.",
			Category: "dossier",
			Source:   "curated",
		},
		{
			ID:       "curated-ai-rag",
			Title:    "Grounded AI & Dual-Provider LLM Architecture",
			Snippet:  "Built unified LLM and embedding adapters supporting both local llama-swap inference (:11434) and Google Cloud Vertex AI Gemini/text-embedding-005, paired with Qdrant cosine similarity retrieval and strict abstention thresholds.",
			Category: "dossier",
			Source:   "curated",
		},
	}
}

// LoadCorpusDocs loads portfolio documents from PostgreSQL (site_content, agensi_skills,
// roadmap_milestones) combined with curated portfolio dossiers for Qdrant indexing.
// Fails loudly on openErr or SQL/scan errors so reindex never silently indexes partial static docs.
func (s *Store) LoadCorpusDocs(ctx context.Context) ([]CorpusDocument, error) {
	if s != nil && s.openErr != nil {
		return nil, fmt.Errorf("postgres connection unavailable: %w", s.openErr)
	}
	docs := CuratedPortfolioDocs()
	if s == nil || s.pool == nil {
		if s != nil {
			docs = append(docs, s.loadMemoryCareerDossierChunks()...)
		}
		return docs, nil
	}
	creatorHandle := strings.TrimSpace(s.AgensiCreatorHandle)
	if creatorHandle == "" {
		creatorHandle = ResolveAgensiCreatorHandle()
	}
	return loadCorpusDocsFromQuerier(ctx, s.pool, creatorHandle, docs)
}

func loadCorpusDocsFromQuerier(ctx context.Context, q rowQuerier, creatorHandle string, baseDocs []CorpusDocument) ([]CorpusDocument, error) {
	docs := make([]CorpusDocument, len(baseDocs))
	copy(docs, baseDocs)

	siteDocs, err := querySiteContentDocs(ctx, q)
	if err != nil {
		return nil, err
	}
	docs = append(docs, siteDocs...)

	skillDocs, err := queryPublishedCreatorSkills(ctx, q, creatorHandle)
	if err != nil {
		return nil, err
	}
	docs = append(docs, skillDocs...)

	mileDocs, err := queryRoadmapMilestoneDocs(ctx, q)
	if err != nil {
		return nil, err
	}
	docs = append(docs, mileDocs...)

	dossierDocs, err := queryPublishedCareerDossierChunks(ctx, q)
	if err != nil {
		return nil, err
	}
	docs = append(docs, dossierDocs...)

	return docs, nil
}

func querySiteContentDocs(ctx context.Context, q rowQuerier) ([]CorpusDocument, error) {
	rows, err := q.Query(ctx, `SELECT key, markdown_body, metadata_json::text FROM site_content ORDER BY key ASC`)
	if err != nil {
		return nil, fmt.Errorf("load site_content corpus: %w", err)
	}
	defer rows.Close()

	var out []CorpusDocument
	for rows.Next() {
		var key, body, meta string
		if scanErr := rows.Scan(&key, &body, &meta); scanErr != nil {
			return nil, fmt.Errorf("scan site_content corpus: %w", scanErr)
		}
		snippet := strings.TrimSpace(body)
		if len(meta) > 2 && len(meta) <= 600 {
			snippet = strings.TrimSpace(snippet + " " + meta)
		}
		if snippet == "" {
			continue
		}
		out = append(out, CorpusDocument{
			ID:       "site:" + key,
			Title:    "Site Content // " + key,
			Snippet:  snippet,
			Category: "site_content",
			Source:   "postgres",
		})
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate site_content corpus: %w", rowsErr)
	}
	return out, nil
}

func queryPublishedCreatorSkills(ctx context.Context, q rowQuerier, creatorHandle string) ([]CorpusDocument, error) {
	rows, err := q.Query(
		ctx,
		`SELECT slug, name, summary, tags, url FROM agensi_skills WHERE lower(creator_handle) = lower($1) AND is_published = true ORDER BY sort_order ASC, slug ASC`,
		creatorHandle,
	)
	if err != nil {
		return nil, fmt.Errorf("load agensi_skills corpus for %q: %w", creatorHandle, err)
	}
	defer rows.Close()

	var out []CorpusDocument
	for rows.Next() {
		var slug, name, summary, link string
		var tags []string
		if scanErr := rows.Scan(&slug, &name, &summary, &tags, &link); scanErr != nil {
			return nil, fmt.Errorf("scan agensi_skills corpus: %w", scanErr)
		}
		snippet := fmt.Sprintf("%s Tags: %s. URL: %s", summary, strings.Join(tags, ", "), link)
		out = append(out, CorpusDocument{
			ID:       "agensi:" + slug,
			Title:    "Agensi Skill // " + name,
			Snippet:  snippet,
			Category: "agensi_skills",
			Source:   "postgres",
		})
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate agensi_skills corpus: %w", rowsErr)
	}
	return out, nil
}

func queryRoadmapMilestoneDocs(ctx context.Context, q rowQuerier) ([]CorpusDocument, error) {
	rows, err := q.Query(ctx, `SELECT slug, status, label FROM roadmap_milestones WHERE enabled = true ORDER BY sort_order ASC`)
	if err != nil {
		return nil, fmt.Errorf("load roadmap_milestones corpus: %w", err)
	}
	defer rows.Close()

	var out []CorpusDocument
	for rows.Next() {
		var slug, status, label string
		if scanErr := rows.Scan(&slug, &status, &label); scanErr != nil {
			return nil, fmt.Errorf("scan roadmap_milestones corpus: %w", scanErr)
		}
		out = append(out, CorpusDocument{
			ID:       "milestone:" + slug,
			Title:    fmt.Sprintf("Roadmap [%s] // %s", status, slug),
			Snippet:  label,
			Category: "roadmap_milestones",
			Source:   "postgres",
		})
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, fmt.Errorf("iterate roadmap_milestones corpus: %w", rowsErr)
	}
	return out, nil
}
