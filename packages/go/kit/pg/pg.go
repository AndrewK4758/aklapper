package pg

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const DefaultDatabaseURL = "postgres://postgres:postgres@127.0.0.1:5439/aklapper?sslmode=disable"

var (
	ErrRunNotFound         = errors.New("sandbox run not found")
	ErrInvalidVerdict      = errors.New("gate verdict must be approved or rejected")
	ErrInvalidAdminVerdict = errors.New("gate verdict must be approved, rejected, or pending")
)

type Config struct {
	DatabaseURL string
	MaxConns    int
}

func ConfigFromEnv() (Config, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		dsn = DefaultDatabaseURL
	}
	if err := ValidateDSN(dsn); err != nil {
		return Config{}, err
	}
	maxConns := 10
	if raw := os.Getenv("PG_MAX_CONNS"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			return Config{}, errors.New("PG_MAX_CONNS must be a positive integer")
		}
		maxConns = parsed
	}
	return Config{
		DatabaseURL: dsn,
		MaxConns:    maxConns,
	}, nil
}

func ValidateDSN(dsn string) error {
	parsed, err := url.Parse(dsn)
	if err != nil {
		return err
	}
	if parsed.Scheme != "postgres" && parsed.Scheme != "postgresql" {
		return errors.New("DATABASE_URL must use postgres:// or postgresql:// scheme")
	}
	if parsed.Host == "" {
		return errors.New("DATABASE_URL must include a host")
	}
	return nil
}

type QuotaPolicy struct {
	Role                 string
	MaxTurnsPerSession   int
	MaxTokensPerRun      int
	MaxDailyGlobalTokens int
}

type CorpusDocument struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Snippet  string `json:"snippet"`
	Category string `json:"category"`
	Source   string `json:"source"`
}

type SandboxRunInput struct {
	SessionID    string
	IPHash       string
	MenuSlug     string
	Prompt       string
	Status       string
	GateVerdict  string
	TokensIn     int
	TokensOut    int
	ArtifactHTML string
}

type SandboxTurnInput struct {
	RunID       string
	Phase       string
	AgentName   string
	Status      string
	Summary     string
	PayloadJSON map[string]any
	LatencyMs   int
}

type SandboxRun struct {
	RunID        string                  `json:"runId"`
	SessionID    string                  `json:"sessionId"`
	MenuSlug     string                  `json:"menuSlug"`
	Prompt       string                  `json:"prompt"`
	Status       string                  `json:"status"`
	GateVerdict  string                  `json:"gateVerdict"`
	TokensIn     int                     `json:"tokensIn"`
	TokensOut    int                     `json:"tokensOut"`
	ArtifactHTML string                  `json:"artifactHtml"`
	Turns        []contracts.CadenceTurn `json:"turns"`
	CreatedAt    string                  `json:"createdAt"`
}

type memBucket struct {
	turnsUsed  int
	tokensUsed int
	windowDay  string
}

// Store provides PostgreSQL 19 persistence via pgxpool with an optional
// thread-safe in-memory fallback when pool is nil (isolated unit tests).
type Store struct {
	pool     *pgxpool.Pool
	mu       sync.Mutex
	policies map[string]QuotaPolicy
	buckets  map[string]*memBucket
	turns    map[string]*TurnRecord
	runs     []*SandboxRun
	runsByID map[string]*SandboxRun
	turnSeq  int
}

func NewMemoryStore() *Store {
	return &Store{
		policies: defaultPolicies(),
		buckets:  make(map[string]*memBucket),
		turns:    make(map[string]*TurnRecord),
		runsByID: make(map[string]*SandboxRun),
	}
}

func defaultPolicies() map[string]QuotaPolicy {
	return map[string]QuotaPolicy{
		contracts.RoleGuest: {
			Role:                 contracts.RoleGuest,
			MaxTurnsPerSession:   5,
			MaxTokensPerRun:      4000,
			MaxDailyGlobalTokens: 100000,
		},
		contracts.RoleAdmin: {
			Role:                 contracts.RoleAdmin,
			MaxTurnsPerSession:   100,
			MaxTokensPerRun:      32000,
			MaxDailyGlobalTokens: 2000000,
		},
	}
}

func Open(ctx context.Context, cfg Config) (*Store, error) {
	if err := ValidateDSN(cfg.DatabaseURL); err != nil {
		return nil, err
	}
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if cfg.MaxConns > 0 {
		poolCfg.MaxConns = int32(cfg.MaxConns)
	}
	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, err
	}
	return &Store{
		pool:     pool,
		policies: defaultPolicies(),
		buckets:  make(map[string]*memBucket),
		turns:    make(map[string]*TurnRecord),
		runsByID: make(map[string]*SandboxRun),
	}, nil
}

func OpenFromEnv(ctx context.Context) (*Store, error) {
	cfg, err := ConfigFromEnv()
	if err != nil {
		return nil, err
	}
	return Open(ctx, cfg)
}

// OpenFromEnvStrict requires an explicit valid DATABASE_URL and live PostgreSQL 19
// connectivity, refusing both DefaultDatabaseURL and NewMemoryStore fallbacks.
func OpenFromEnvStrict(ctx context.Context) (*Store, error) {
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		return nil, errors.New("DATABASE_URL is required (strict mode refuses default or in-memory fallback)")
	}
	if err := ValidateDSN(dsn); err != nil {
		return nil, err
	}
	maxConns := 10
	if raw := strings.TrimSpace(os.Getenv("PG_MAX_CONNS")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 {
			return nil, errors.New("PG_MAX_CONNS must be a positive integer")
		}
		maxConns = parsed
	}
	return Open(ctx, Config{DatabaseURL: dsn, MaxConns: maxConns})
}

// OpenBestEffort connects to live PG19 when DATABASE_URL is reachable,
// otherwise falls back cleanly to an isolated in-memory Store.
func OpenBestEffort(ctx context.Context) *Store {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true") {
		return NewMemoryStore()
	}
	store, err := OpenFromEnv(ctx)
	if err != nil {
		return NewMemoryStore()
	}
	return store
}

func (s *Store) Close() {
	if s != nil && s.pool != nil {
		s.pool.Close()
	}
}

func (s *Store) IsLivePG() bool {
	return s != nil && s.pool != nil
}

func (s *Store) SetPolicyForTest(policy QuotaPolicy) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.policies == nil {
		s.policies = defaultPolicies()
	}
	s.policies[policy.Role] = policy
}

func normalizeRole(role string) string {
	if role == contracts.RoleAdmin {
		return contracts.RoleAdmin
	}
	return contracts.RoleGuest
}

func normalizeSessionID(sessionID string) string {
	trimmed := strings.TrimSpace(sessionID)
	if trimmed == "" {
		return "anonymous"
	}
	return trimmed
}

func (s *Store) loadPolicy(ctx context.Context, tx pgx.Tx, role string) QuotaPolicy {
	role = normalizeRole(role)
	fallback := defaultPolicies()[role]
	if tx == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		if p, ok := s.policies[role]; ok {
			return p
		}
		return fallback
	}
	var p QuotaPolicy
	p.Role = role
	err := tx.QueryRow(
		ctx,
		`SELECT max_turns_per_session, max_tokens_per_run, max_daily_global_tokens
		 FROM quota_policies WHERE role = $1`,
		role,
	).Scan(&p.MaxTurnsPerSession, &p.MaxTokensPerRun, &p.MaxDailyGlobalTokens)
	if err != nil {
		return fallback
	}
	return p
}

func (s *Store) GetQuotaStatus(ctx context.Context, role, sessionID string) (contracts.QuotaStatus, error) {
	role = normalizeRole(role)
	sessionID = normalizeSessionID(sessionID)
	sessionKey := "session:" + sessionID

	if s == nil || s.pool == nil {
		if s == nil {
			p := defaultPolicies()[role]
			return contracts.QuotaStatus{
				Role:       role,
				TurnsUsed:  0,
				MaxTurns:   p.MaxTurnsPerSession,
				TokensUsed: 0,
				MaxTokens:  p.MaxTokensPerRun * p.MaxTurnsPerSession,
			}, nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		p, ok := s.policies[role]
		if !ok {
			p = defaultPolicies()[role]
		}
		turns, tokens := 0, 0
		if b, exists := s.buckets[sessionKey]; exists {
			turns = b.turnsUsed
			tokens = b.tokensUsed
		}
		return contracts.QuotaStatus{
			Role:       role,
			TurnsUsed:  turns,
			MaxTurns:   p.MaxTurnsPerSession,
			TokensUsed: tokens,
			MaxTokens:  p.MaxTokensPerRun * p.MaxTurnsPerSession,
		}, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	policy := s.loadPolicy(ctx, tx, role)
	var turnsUsed, tokensUsed int
	_ = tx.QueryRow(
		ctx,
		`SELECT turns_used, tokens_used FROM rate_limit_buckets WHERE scope_key = $1`,
		sessionKey,
	).Scan(&turnsUsed, &tokensUsed)

	return contracts.QuotaStatus{
		Role:       role,
		TurnsUsed:  turnsUsed,
		MaxTurns:   policy.MaxTurnsPerSession,
		TokensUsed: tokensUsed,
		MaxTokens:  policy.MaxTokensPerRun * policy.MaxTurnsPerSession,
	}, nil
}

// CheckAndConsumeQuota enforces session and daily global limits atomically and fails closed
// when any quota threshold is exceeded.
func (s *Store) CheckAndConsumeQuota(
	ctx context.Context,
	role, sessionID string,
	turnsDelta, tokensDelta int,
) (contracts.QuotaStatus, bool, error) {
	role = normalizeRole(role)
	sessionID = normalizeSessionID(sessionID)
	if turnsDelta < 0 {
		turnsDelta = 0
	}
	if tokensDelta < 0 {
		tokensDelta = 0
	}

	today := time.Now().UTC().Format("2006-01-02")
	sessionKey := "session:" + sessionID
	globalKey := "global:" + today

	if s == nil || s.pool == nil {
		if s == nil {
			s = NewMemoryStore()
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		policy, ok := s.policies[role]
		if !ok {
			policy = defaultPolicies()[role]
		}
		sb := s.buckets[sessionKey]
		if sb == nil {
			sb = &memBucket{windowDay: today}
			s.buckets[sessionKey] = sb
		}
		gb := s.buckets[globalKey]
		if gb == nil || gb.windowDay != today {
			gb = &memBucket{windowDay: today}
			s.buckets[globalKey] = gb
		}

		maxSessionTokens := policy.MaxTokensPerRun * policy.MaxTurnsPerSession
		if sb.turnsUsed+turnsDelta > policy.MaxTurnsPerSession ||
			tokensDelta > policy.MaxTokensPerRun ||
			gb.tokensUsed+tokensDelta > policy.MaxDailyGlobalTokens {
			return contracts.QuotaStatus{
				Role:       role,
				TurnsUsed:  sb.turnsUsed,
				MaxTurns:   policy.MaxTurnsPerSession,
				TokensUsed: sb.tokensUsed,
				MaxTokens:  maxSessionTokens,
			}, false, nil
		}

		sb.turnsUsed += turnsDelta
		sb.tokensUsed += tokensDelta
		gb.turnsUsed += turnsDelta
		gb.tokensUsed += tokensDelta

		return contracts.QuotaStatus{
			Role:       role,
			TurnsUsed:  sb.turnsUsed,
			MaxTurns:   policy.MaxTurnsPerSession,
			TokensUsed: sb.tokensUsed,
			MaxTokens:  maxSessionTokens,
		}, true, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return contracts.QuotaStatus{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	policy := s.loadPolicy(ctx, tx, role)
	maxSessionTokens := policy.MaxTokensPerRun * policy.MaxTurnsPerSession

	// Ensure both bucket rows exist so FOR UPDATE locks deterministically.
	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
			 VALUES ($1, NOW(), 0, 0)
			 ON CONFLICT (scope_key) DO NOTHING`,
			key,
		); err != nil {
			return contracts.QuotaStatus{}, false, err
		}
	}

	var sessionTurns, sessionTokens int
	if err := tx.QueryRow(
		ctx,
		`SELECT turns_used, tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		sessionKey,
	).Scan(&sessionTurns, &sessionTokens); err != nil {
		return contracts.QuotaStatus{}, false, err
	}

	var globalTokens int
	if err := tx.QueryRow(
		ctx,
		`SELECT tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		globalKey,
	).Scan(&globalTokens); err != nil {
		return contracts.QuotaStatus{}, false, err
	}

	if sessionTurns+turnsDelta > policy.MaxTurnsPerSession ||
		tokensDelta > policy.MaxTokensPerRun ||
		globalTokens+tokensDelta > policy.MaxDailyGlobalTokens {
		return contracts.QuotaStatus{
			Role:       role,
			TurnsUsed:  sessionTurns,
			MaxTurns:   policy.MaxTurnsPerSession,
			TokensUsed: sessionTokens,
			MaxTokens:  maxSessionTokens,
		}, false, nil
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE rate_limit_buckets
		 SET turns_used = turns_used + $2, tokens_used = tokens_used + $3
		 WHERE scope_key = $1`,
		sessionKey,
		turnsDelta,
		tokensDelta,
	); err != nil {
		return contracts.QuotaStatus{}, false, err
	}
	if _, err := tx.Exec(
		ctx,
		`UPDATE rate_limit_buckets
		 SET turns_used = turns_used + $2, tokens_used = tokens_used + $3
		 WHERE scope_key = $1`,
		globalKey,
		turnsDelta,
		tokensDelta,
	); err != nil {
		return contracts.QuotaStatus{}, false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return contracts.QuotaStatus{}, false, err
	}

	return contracts.QuotaStatus{
		Role:       role,
		TurnsUsed:  sessionTurns + turnsDelta,
		MaxTurns:   policy.MaxTurnsPerSession,
		TokensUsed: sessionTokens + tokensDelta,
		MaxTokens:  maxSessionTokens,
	}, true, nil
}

// CuratedPortfolioDocs provides high-signal baseline portfolio facts always included during indexing.
func CuratedPortfolioDocs() []CorpusDocument {
	return []CorpusDocument{
		{
			ID:       "curated-stack",
			Title:    "Andrew Klapper — Core Architecture & Stack",
			Snippet:  "Principal full-stack and cloud systems engineer specializing in TypeScript, React 19, React Router 8 SSR, Fastify 5, Go 1.27 microservices, PostgreSQL 19 with Drizzle ORM, Qdrant vector search, and GCP (Cloud Run + GKE Autopilot scale-from-zero).",
			Category: "dossier",
			Source:   "curated",
		},
		{
			ID:       "curated-cadence",
			Title:    "CADENCE — Agentic SDLC & CHORD Pipeline",
			Snippet:  "Designed CADENCE, a specification-driven multi-agent delivery methodology using the CHORD phased workflow (triage, spec, build, gate) with isolated worktrees, deterministic verification gates, and zero-trust sandboxed artifact previews.",
			Category: "dossier",
			Source:   "curated",
		},
		{
			ID:       "curated-security",
			Title:    "Security & Cloud Operations Posture",
			Snippet:  "Implemented WebAuthn Passkeys with optional TOTP 2FA, HMAC-SHA256 signed internal service assertions between Node SSR BFFs and Go microservices, strict namespace redaction separating portfolio-public from cadence-admin, and PostgreSQL CHECK constraints.",
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
// Fails loudly on SQL/scan errors so reindex never silently indexes partial static docs.
func (s *Store) LoadCorpusDocs(ctx context.Context) ([]CorpusDocument, error) {
	docs := CuratedPortfolioDocs()
	if s == nil || s.pool == nil {
		return docs, nil
	}

	siteDocs, err := s.loadSiteContentDocs(ctx)
	if err != nil {
		return nil, err
	}
	docs = append(docs, siteDocs...)

	skillDocs, err := s.loadAgensiSkillDocs(ctx)
	if err != nil {
		return nil, err
	}
	docs = append(docs, skillDocs...)

	milestoneDocs, err := s.loadRoadmapMilestoneDocs(ctx)
	if err != nil {
		return nil, err
	}
	return append(docs, milestoneDocs...), nil
}

func (s *Store) loadSiteContentDocs(ctx context.Context) ([]CorpusDocument, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, markdown_body, metadata_json::text FROM site_content ORDER BY key ASC`)
	if err != nil {
		return nil, fmt.Errorf("load site_content corpus: %w", err)
	}
	defer rows.Close()

	var docs []CorpusDocument
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
		docs = append(docs, CorpusDocument{
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
	return docs, nil
}

func (s *Store) loadAgensiSkillDocs(ctx context.Context) ([]CorpusDocument, error) {
	rows, err := s.pool.Query(ctx, `SELECT slug, name, summary, tags, url FROM agensi_skills ORDER BY sort_order ASC, slug ASC`)
	if err != nil {
		return nil, fmt.Errorf("load agensi_skills corpus: %w", err)
	}
	defer rows.Close()

	var docs []CorpusDocument
	for rows.Next() {
		var slug, name, summary, link string
		var tags []string
		if scanErr := rows.Scan(&slug, &name, &summary, &tags, &link); scanErr != nil {
			return nil, fmt.Errorf("scan agensi_skills corpus: %w", scanErr)
		}
		snippet := fmt.Sprintf("%s Tags: %s. URL: %s", summary, strings.Join(tags, ", "), link)
		docs = append(docs, CorpusDocument{
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
	return docs, nil
}

func (s *Store) loadRoadmapMilestoneDocs(ctx context.Context) ([]CorpusDocument, error) {
	rows, err := s.pool.Query(ctx, `SELECT slug, status, label FROM roadmap_milestones WHERE enabled = true ORDER BY sort_order ASC`)
	if err != nil {
		return nil, fmt.Errorf("load roadmap_milestones corpus: %w", err)
	}
	defer rows.Close()

	var docs []CorpusDocument
	for rows.Next() {
		var slug, status, label string
		if scanErr := rows.Scan(&slug, &status, &label); scanErr != nil {
			return nil, fmt.Errorf("scan roadmap_milestones corpus: %w", scanErr)
		}
		docs = append(docs, CorpusDocument{
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
	return docs, nil
}

func newUUIDv4() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (s *Store) CreateSandboxRun(ctx context.Context, input SandboxRunInput) (string, error) {
	if input.GateVerdict == "" {
		input.GateVerdict = "pending"
	}
	if input.Status == "" {
		input.Status = "ready"
	}
	if input.MenuSlug == "" {
		input.MenuSlug = "cadence"
	}
	if input.IPHash == "" {
		input.IPHash = "local"
	}
	input.SessionID = normalizeSessionID(input.SessionID)

	if s == nil || s.pool == nil {
		if s == nil {
			return newUUIDv4(), nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		id := newUUIDv4()
		run := &SandboxRun{
			RunID:        id,
			SessionID:    input.SessionID,
			MenuSlug:     input.MenuSlug,
			Prompt:       input.Prompt,
			Status:       input.Status,
			GateVerdict:  input.GateVerdict,
			TokensIn:     input.TokensIn,
			TokensOut:    input.TokensOut,
			ArtifactHTML: input.ArtifactHTML,
			Turns:        []contracts.CadenceTurn{},
			CreatedAt:    time.Now().UTC().Format(time.RFC3339),
		}
		s.runs = append([]*SandboxRun{run}, s.runs...)
		s.runsByID[id] = run
		return id, nil
	}

	var id string
	err := s.pool.QueryRow(
		ctx,
		`INSERT INTO sandbox_runs
		 (session_id, ip_hash, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, artifact_html)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id::text`,
		input.SessionID,
		input.IPHash,
		input.MenuSlug,
		input.Prompt,
		input.Status,
		input.GateVerdict,
		input.TokensIn,
		input.TokensOut,
		input.ArtifactHTML,
	).Scan(&id)
	return id, err
}

func (s *Store) InsertSandboxTurn(ctx context.Context, input SandboxTurnInput) (contracts.CadenceTurn, error) {
	payload := input.PayloadJSON
	if payload == nil {
		payload = map[string]any{}
	}
	if input.Summary != "" {
		payload["summary"] = input.Summary
	}

	if s == nil || s.pool == nil {
		now := time.Now().UTC().Format(time.RFC3339)
		turn := contracts.CadenceTurn{
			Phase:     input.Phase,
			AgentName: input.AgentName,
			Status:    input.Status,
			Summary:   input.Summary,
			LatencyMs: input.LatencyMs,
			Payload:   payload,
			CreatedAt: now,
		}
		if s != nil {
			s.mu.Lock()
			s.turnSeq++
			turn.ID = s.turnSeq
			if run, ok := s.runsByID[input.RunID]; ok {
				run.Turns = append(run.Turns, turn)
			}
			s.mu.Unlock()
		}
		return turn, nil
	}

	rawJSON, err := json.Marshal(payload)
	if err != nil {
		return contracts.CadenceTurn{}, err
	}
	var id int
	var createdAt time.Time
	err = s.pool.QueryRow(
		ctx,
		`INSERT INTO sandbox_turns (run_id, phase, agent_name, status, payload_json, latency_ms)
		 VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6)
		 RETURNING id, created_at`,
		input.RunID,
		input.Phase,
		input.AgentName,
		input.Status,
		string(rawJSON),
		input.LatencyMs,
	).Scan(&id, &createdAt)
	if err != nil {
		return contracts.CadenceTurn{}, err
	}

	return contracts.CadenceTurn{
		ID:        id,
		Phase:     input.Phase,
		AgentName: input.AgentName,
		Status:    input.Status,
		Summary:   input.Summary,
		LatencyMs: input.LatencyMs,
		Payload:   payload,
		CreatedAt: createdAt.UTC().Format(time.RFC3339),
	}, nil
}

func (s *Store) ListSandboxRuns(ctx context.Context, sessionID string, limit int) ([]SandboxRun, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	sessionID = strings.TrimSpace(sessionID)

	if s == nil || s.pool == nil {
		if s == nil {
			return []SandboxRun{}, nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		out := make([]SandboxRun, 0, limit)
		for _, r := range s.runs {
			if sessionID != "" && r.SessionID != sessionID {
				continue
			}
			copied := *r
			copied.Turns = append([]contracts.CadenceTurn(nil), r.Turns...)
			out = append(out, copied)
			if len(out) >= limit {
				break
			}
		}
		return out, nil
	}

	var (
		rows pgx.Rows
		err  error
	)
	if sessionID != "" {
		rows, err = s.pool.Query(
			ctx,
			`SELECT id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at
			 FROM sandbox_runs
			 WHERE session_id = $1
			 ORDER BY created_at DESC
			 LIMIT $2`,
			sessionID,
			limit,
		)
	} else {
		rows, err = s.pool.Query(
			ctx,
			`SELECT id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at
			 FROM sandbox_runs
			 ORDER BY created_at DESC
			 LIMIT $1`,
			limit,
		)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	runs := make([]SandboxRun, 0, limit)
	for rows.Next() {
		var r SandboxRun
		var createdAt time.Time
		if err := rows.Scan(
			&r.RunID,
			&r.SessionID,
			&r.MenuSlug,
			&r.Prompt,
			&r.Status,
			&r.GateVerdict,
			&r.TokensIn,
			&r.TokensOut,
			&r.ArtifactHTML,
			&createdAt,
		); err != nil {
			return nil, err
		}
		r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		r.Turns = []contracts.CadenceTurn{}
		runs = append(runs, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range runs {
		turns, turnErr := s.loadTurnsForRun(ctx, runs[i].RunID)
		if turnErr == nil {
			runs[i].Turns = turns
		}
	}
	return runs, nil
}

func (s *Store) loadTurnsForRun(ctx context.Context, runID string) ([]contracts.CadenceTurn, error) {
	rows, err := s.pool.Query(
		ctx,
		`SELECT id, phase, agent_name, status, payload_json::text, latency_ms, created_at
		 FROM sandbox_turns
		 WHERE run_id = $1::uuid
		 ORDER BY id ASC`,
		runID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []contracts.CadenceTurn{}
	for rows.Next() {
		var t contracts.CadenceTurn
		var payloadText string
		var createdAt time.Time
		if err := rows.Scan(&t.ID, &t.Phase, &t.AgentName, &t.Status, &payloadText, &t.LatencyMs, &createdAt); err != nil {
			return nil, err
		}
		var payload map[string]any
		_ = json.Unmarshal([]byte(payloadText), &payload)
		t.Payload = payload
		if summary, ok := payload["summary"].(string); ok {
			t.Summary = summary
		}
		t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		out = append(out, t)
	}
	return out, rows.Err()
}

func isValidUUIDString(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		isHex := (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
		if !isHex {
			return false
		}
	}
	return true
}

func (s *Store) GetSandboxRunSummary(ctx context.Context) (int, int, error) {
	if s == nil || s.pool == nil {
		if s == nil {
			return 0, 0, nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		total := len(s.runs)
		pending := 0
		for _, r := range s.runs {
			if r.GateVerdict == "pending" {
				pending++
			}
		}
		return total, pending, nil
	}

	var total, pending int
	err := s.pool.QueryRow(
		ctx,
		`SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int
		 FROM sandbox_runs`,
	).Scan(&total, &pending)
	if err != nil {
		return 0, 0, err
	}
	return total, pending, nil
}

func (s *Store) UpdateSandboxGateVerdict(ctx context.Context, runID, verdict string) (*SandboxRun, error) {
	if verdict != "approved" && verdict != "rejected" {
		return nil, ErrInvalidVerdict
	}
	return s.setSandboxGateVerdict(ctx, runID, verdict)
}

func (s *Store) OverrideSandboxGateVerdict(ctx context.Context, runID, verdict string) (*SandboxRun, error) {
	if verdict != "approved" && verdict != "rejected" && verdict != "pending" {
		return nil, ErrInvalidAdminVerdict
	}
	return s.setSandboxGateVerdict(ctx, runID, verdict)
}

func (s *Store) setSandboxGateVerdict(ctx context.Context, runID, verdict string) (*SandboxRun, error) {
	if s == nil || s.pool == nil {
		if s == nil {
			return nil, ErrRunNotFound
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok {
			return nil, ErrRunNotFound
		}
		run.GateVerdict = verdict
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	if !isValidUUIDString(runID) {
		return nil, ErrRunNotFound
	}

	var r SandboxRun
	var createdAt time.Time
	err := s.pool.QueryRow(
		ctx,
		`UPDATE sandbox_runs
		 SET gate_verdict = $2
		 WHERE id = $1::uuid
		 RETURNING id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at`,
		runID,
		verdict,
	).Scan(
		&r.RunID,
		&r.SessionID,
		&r.MenuSlug,
		&r.Prompt,
		&r.Status,
		&r.GateVerdict,
		&r.TokensIn,
		&r.TokensOut,
		&r.ArtifactHTML,
		&createdAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotFound
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	turns, _ := s.loadTurnsForRun(ctx, r.RunID)
	r.Turns = turns
	return &r, nil
}
