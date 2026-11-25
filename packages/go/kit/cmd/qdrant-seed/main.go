package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrantseed"
)

func parseCollectionsFlag(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" || strings.EqualFold(trimmed, "all") {
		return []string{qdrantseed.CollectionCadencePatterns, qdrantseed.CollectionPortfolioDocs}, nil
	}
	parts := strings.Split(trimmed, ",")
	var out []string
	seen := make(map[string]struct{})
	for _, part := range parts {
		name := strings.TrimSpace(part)
		if name == "" {
			continue
		}
		if name != qdrantseed.CollectionCadencePatterns && name != qdrantseed.CollectionPortfolioDocs {
			return nil, fmt.Errorf("unsupported collection %q (expected cadence_patterns, portfolio_docs, or all)", name)
		}
		if _, ok := seen[name]; !ok {
			seen[name] = struct{}{}
			out = append(out, name)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no valid collections specified in %q", raw)
	}
	return out, nil
}

func envLookup(env map[string]string, key string) string {
	if env != nil {
		if val, ok := env[key]; ok {
			return val
		}
	}
	return os.Getenv(key)
}

func providerFromEnvMap(env map[string]string) llm.Provider {
	if strings.EqualFold(envLookup(env, "AI_PROVIDER"), "vertex") {
		model := envLookup(env, "VERTEX_MODEL")
		if model == "" {
			model = llm.DefaultVertexModel
		}
		embedModel := envLookup(env, "VERTEX_EMBED_MODEL")
		if embedModel == "" {
			embedModel = llm.DefaultVertexEmbedModel
		}
		location := envLookup(env, "GCP_LOCATION")
		if location == "" {
			location = llm.DefaultVertexLocation
		}
		return &llm.VertexClient{
			ProjectID:   envLookup(env, "GCP_PROJECT_ID"),
			Location:    location,
			Model:       model,
			EmbedModel:  embedModel,
			AccessToken: envLookup(env, "GOOGLE_OAUTH_ACCESS_TOKEN"),
			MetadataURL: envLookup(env, "GCP_METADATA_TOKEN_URL"),
			HTTPClient:  &http.Client{Timeout: 30 * time.Second},
		}
	}
	baseURL := envLookup(env, "LOCAL_LLM_BASE_URL")
	if baseURL == "" {
		baseURL = llm.DefaultLocalBaseURL
	}
	return &llm.LocalClient{
		BaseURL:    baseURL,
		ChatModel:  envLookup(env, "LOCAL_LLM_CHAT_MODEL"),
		EmbedModel: envLookup(env, "LOCAL_LLM_EMBED_MODEL"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func qdrantFromEnvMap(env map[string]string) *qdrant.Client {
	baseURL := strings.TrimRight(envLookup(env, "QDRANT_URL"), "/")
	if baseURL == "" {
		baseURL = qdrant.DefaultURL
	}
	return &qdrant.Client{
		BaseURL:    baseURL,
		APIKey:     envLookup(env, "QDRANT_API_KEY"),
		HTTPClient: &http.Client{Timeout: 15 * time.Second},
	}
}

func openPGStoreFromEnvMap(ctx context.Context, env map[string]string) (*pg.Store, error) {
	dsn := strings.TrimSpace(envLookup(env, "DATABASE_URL"))
	if dsn == "" {
		dsn = pg.DefaultDatabaseURL
	}
	return pg.Open(ctx, pg.Config{DatabaseURL: dsn, MaxConns: 4})
}

func stripDoubleDash(args []string) []string {
	out := make([]string, 0, len(args))
	for _, arg := range args {
		if arg == "--" {
			continue
		}
		out = append(out, arg)
	}
	return out
}

func runCLI(ctx context.Context, args []string, env map[string]string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("qdrant-seed", flag.ContinueOnError)
	fs.SetOutput(stderr)

	collectionsFlag := fs.String("collections", "all", "Comma-separated collections to seed (cadence_patterns, portfolio_docs, or all)")
	dryRunFlag := fs.Bool("dry-run", false, "Validate corpora and confidentiality rules without writing to Qdrant")
	skipPGFlag := fs.Bool("skip-pg", false, "Seed portfolio_docs using curated Go corpus only without connecting to PostgreSQL")
	pruneFlag := fs.Bool("prune", true, "Prune stale or legacy ordinal point IDs after upsert")
	concurrencyFlag := fs.Int("concurrency", 4, "Concurrent embedding worker count (1..8)")

	if err := fs.Parse(stripDoubleDash(args)); err != nil {
		return 1
	}
	if fs.NArg() > 0 {
		_, _ = fmt.Fprintf(stderr, "qdrant-seed error: unexpected positional arguments %v\n", fs.Args())
		return 1
	}

	cols, err := parseCollectionsFlag(*collectionsFlag)
	if err != nil {
		_, _ = fmt.Fprintf(stderr, "qdrant-seed error: %v\n", err)
		return 1
	}

	needsPortfolio := false
	for _, c := range cols {
		if c == qdrantseed.CollectionPortfolioDocs {
			needsPortfolio = true
			break
		}
	}

	var store *pg.Store
	pgDisabled := strings.EqualFold(strings.TrimSpace(envLookup(env, "PG_DISABLE_LIVE")), "true")
	if needsPortfolio && !*skipPGFlag && !pgDisabled {
		pgStore, pgErr := openPGStoreFromEnvMap(ctx, env)
		if pgErr != nil {
			_, _ = fmt.Fprintf(stderr, "UNSOUND_CONDITION qdrant.seed.pg_corpus_unavailable: postgres connection failed (%v); start PostgreSQL or pass --skip-pg / PG_DISABLE_LIVE=true\n", pgErr)
			return 1
		}
		store = pgStore
		defer store.Close()
	}

	opts := qdrantseed.SeedOptions{
		Collections:  cols,
		PruneOrphans: *pruneFlag,
		DryRun:       *dryRunFlag,
		Concurrency:  *concurrencyFlag,
		LogWriter:    stderr,
	}
	results, seedErr := qdrantseed.SeedAll(ctx, providerFromEnvMap(env), qdrantFromEnvMap(env), store, opts)
	if seedErr != nil {
		if errors.Is(seedErr, qdrantseed.ErrReindexLocked) {
			_, _ = fmt.Fprintf(stderr, "UNSOUND_CONDITION ai_ask.reindex.lock_contended: %v\n", seedErr)
			return 1
		}
		_, _ = fmt.Fprintf(stderr, "qdrant-seed error: %v\n", seedErr)
		return 1
	}

	summary := map[string]any{
		"ok":      true,
		"dryRun":  *dryRunFlag,
		"results": results,
	}
	enc := json.NewEncoder(stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(summary); err != nil {
		_, _ = fmt.Fprintf(stderr, "qdrant-seed encode error: %v\n", err)
		return 1
	}
	return 0
}

func main() {
	os.Exit(runCLI(context.Background(), os.Args[1:], nil, os.Stdout, os.Stderr))
}
