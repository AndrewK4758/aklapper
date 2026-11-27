package pg

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

type PortalCareerDossierSection struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
}

type PortalCareerDossierRecord struct {
	Slug                   string
	Kind                   string
	Title                  string
	DomainLabel            string
	RoleTitle              string
	Timeframe              string
	Skills                 []string
	SummaryBody            string
	Sections               []PortalCareerDossierSection
	PublishStatus          string
	SanitizationVerifiedAt *string
	DenylistHash           *string
	SortOrder              int
	UpdatedAt              string
}

func (s *Store) ListPublishedPortalCareerDossiers(ctx context.Context) ([]PortalCareerDossierRecord, error) {
	if s == nil || s.pool == nil {
		return []PortalCareerDossierRecord{}, nil
	}
	rows, err := s.pool.Query(
		ctx,
		`SELECT slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		        COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		        denylist_hash, sort_order, updated_at
		 FROM career_dossiers
		 WHERE publish_status = 'published' AND sanitization_verified_at IS NOT NULL
		 ORDER BY sort_order ASC, slug ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]PortalCareerDossierRecord, 0)
	for rows.Next() {
		var rec PortalCareerDossierRecord
		var sectionsRaw string
		var verifiedAt *time.Time
		var updatedAt time.Time
		if scanErr := rows.Scan(
			&rec.Slug,
			&rec.Kind,
			&rec.Title,
			&rec.DomainLabel,
			&rec.RoleTitle,
			&rec.Timeframe,
			&rec.Skills,
			&rec.SummaryBody,
			&sectionsRaw,
			&rec.PublishStatus,
			&verifiedAt,
			&rec.DenylistHash,
			&rec.SortOrder,
			&updatedAt,
		); scanErr != nil {
			return nil, scanErr
		}
		if rec.Skills == nil {
			rec.Skills = []string{}
		}
		rec.Sections = []PortalCareerDossierSection{}
		_ = json.Unmarshal([]byte(sectionsRaw), &rec.Sections)
		if verifiedAt != nil {
			s := verifiedAt.UTC().Format(time.RFC3339Nano)
			rec.SanitizationVerifiedAt = &s
		}
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339Nano)
		out = append(out, rec)
	}
	return out, rows.Err()
}

func (s *Store) ListPortalCadencePresets(ctx context.Context) ([]contracts.CadencePreset, error) {
	if s == nil || s.pool == nil {
		return nil, ErrCadencePresetsEmpty
	}
	rows, err := s.pool.Query(
		ctx,
		`SELECT slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order
		 FROM cadence_presets
		 ORDER BY sort_order ASC, slug ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]contracts.CadencePreset, 0)
	for rows.Next() {
		var p contracts.CadencePreset
		if scanErr := rows.Scan(&p.Slug, &p.Title, &p.StarterPrompt, &p.ExpectedKind, &p.StarterArtifactHTML, &p.SortOrder); scanErr != nil {
			return nil, scanErr
		}
		out = append(out, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, ErrCadencePresetsEmpty
	}
	return out, nil
}

// GetPortalGuestQuota reads guest quota_policies and strictly session:<sessionID> from
// rate_limit_buckets (never querying auth:* or global:* so portal_app RLS is respected).
func (s *Store) GetPortalGuestQuota(ctx context.Context, sessionID string) (contracts.QuotaStatus, error) {
	policy := defaultPolicies()[contracts.RoleGuest]
	if s == nil || s.pool == nil {
		return contracts.QuotaStatus{
			Role:      contracts.RoleGuest,
			MaxTurns:  policy.MaxTurnsPerSession,
			MaxTokens: policy.MaxTokensPerRun,
		}, nil
	}

	var p QuotaPolicy
	err := s.pool.QueryRow(
		ctx,
		`SELECT role, max_turns_per_session, max_tokens_per_run, max_daily_global_tokens
		 FROM quota_policies
		 WHERE role = $1
		 LIMIT 1`,
		contracts.RoleGuest,
	).Scan(&p.Role, &p.MaxTurnsPerSession, &p.MaxTokensPerRun, &p.MaxDailyGlobalTokens)
	if err == nil {
		policy = p
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return contracts.QuotaStatus{}, err
	}

	status := contracts.QuotaStatus{
		Role:      contracts.RoleGuest,
		MaxTurns:  policy.MaxTurnsPerSession,
		MaxTokens: policy.MaxTokensPerRun,
	}

	trimmed := strings.TrimSpace(sessionID)
	if trimmed == "" {
		return status, nil
	}
	var turnsUsed, tokensUsed int
	bErr := s.pool.QueryRow(
		ctx,
		`SELECT turns_used, tokens_used FROM rate_limit_buckets WHERE scope_key = $1 LIMIT 1`,
		"session:"+trimmed,
	).Scan(&turnsUsed, &tokensUsed)
	if bErr == nil {
		status.TurnsUsed = turnsUsed
		status.TokensUsed = tokensUsed
	} else if !errors.Is(bErr, pgx.ErrNoRows) {
		return contracts.QuotaStatus{}, bErr
	}
	return status, nil
}
