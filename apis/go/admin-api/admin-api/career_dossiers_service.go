package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/jackc/pgx/v5"
)

type validatedDossierInput struct {
	privacyInput privacy.CareerDossierInput
	kind         string
	sortOrder    int32
}

func isValidCareerDossierKind(kind string) bool {
	switch kind {
	case "profile_core", "experience", "project", "architecture", "leadership":
		return true
	default:
		return false
	}
}

func validateDossierInput(in *adminv1.CareerDossierUpsertInput, corrID string) (validatedDossierInput, *connect.Error) {
	if in == nil {
		return validatedDossierInput{}, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Career dossier payload is required.", "Provide dossier fields.", corrID, nil)
	}
	slug := strings.TrimSpace(in.GetSlug())
	title := strings.TrimSpace(in.GetTitle())
	kind := strings.TrimSpace(in.GetKind())
	if slug == "" || title == "" || !isValidCareerDossierKind(kind) ||
		containsNul(slug) || containsNul(title) || containsNul(in.GetSummaryBody()) || containsNul(in.GetDomainLabel()) || containsNul(in.GetRoleTitle()) || containsNul(in.GetTimeframe()) {
		return validatedDossierInput{}, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Invalid career dossier fields.", "Provide valid slug, kind, title, and text without NUL bytes.", corrID, nil)
	}
	sections := make([]privacy.CareerDossierSectionInput, 0, len(in.GetSections()))
	for _, sec := range in.GetSections() {
		if containsNul(sec.GetHeading()) || containsNul(sec.GetBody()) {
			return validatedDossierInput{}, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Dossier section contains NUL byte.", "Remove NUL bytes and retry.", corrID, nil)
		}
		sections = append(sections, privacy.CareerDossierSectionInput{Heading: sec.GetHeading(), Body: sec.GetBody()})
	}
	skills := make([]string, 0, len(in.GetSkills()))
	for _, sk := range in.GetSkills() {
		if containsNul(sk) {
			return validatedDossierInput{}, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Dossier skill contains NUL byte.", "Remove NUL bytes and retry.", corrID, nil)
		}
		if t := strings.TrimSpace(sk); t != "" {
			skills = append(skills, t)
		}
	}
	return validatedDossierInput{
		kind:      kind,
		sortOrder: in.GetSortOrder(),
		privacyInput: privacy.CareerDossierInput{
			Slug:        slug,
			Title:       title,
			DomainLabel: strings.TrimSpace(in.GetDomainLabel()),
			RoleTitle:   strings.TrimSpace(in.GetRoleTitle()),
			Timeframe:   strings.TrimSpace(in.GetTimeframe()),
			Skills:      skills,
			SummaryBody: in.GetSummaryBody(),
			Sections:    sections,
		},
	}, nil
}

func scanCareerDossierRow(row pgx.Row) (pg.PortalCareerDossierRecord, error) {
	var rec pg.PortalCareerDossierRecord
	var sectionsRaw string
	var verifiedAt *time.Time
	var updatedAt time.Time
	if err := row.Scan(
		&rec.Slug, &rec.Kind, &rec.Title, &rec.DomainLabel, &rec.RoleTitle, &rec.Timeframe,
		&rec.Skills, &rec.SummaryBody, &sectionsRaw, &rec.PublishStatus,
		&verifiedAt, &rec.DenylistHash, &rec.SortOrder, &updatedAt,
	); err != nil {
		return pg.PortalCareerDossierRecord{}, err
	}
	if rec.Skills == nil {
		rec.Skills = []string{}
	}
	rec.Sections = []pg.PortalCareerDossierSection{}
	_ = json.Unmarshal([]byte(sectionsRaw), &rec.Sections)
	if verifiedAt != nil {
		iso := formatRFC3339Millis(*verifiedAt)
		rec.SanitizationVerifiedAt = &iso
	}
	rec.UpdatedAt = formatRFC3339Millis(updatedAt)
	return rec, nil
}

func (s *adminCmsServiceServer) listAllCareerDossiers(ctx context.Context) ([]*portalv1.CareerDossier, error) {
	rows, err := s.deps.store.Pool().Query(
		ctx,
		`SELECT slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		        COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		        denylist_hash, sort_order, updated_at
		 FROM career_dossiers
		 ORDER BY sort_order ASC, slug ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*portalv1.CareerDossier, 0)
	for rows.Next() {
		rec, scanErr := scanCareerDossierRow(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, toProtoCareerDossier(rec))
	}
	return out, rows.Err()
}

func upsertCareerDossierWith(
	ctx context.Context,
	q interface {
		QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	},
	in validatedDossierInput,
	denylistHash string,
	verifiedAt time.Time,
) (pg.PortalCareerDossierRecord, error) {
	sectionsJSON, err := json.Marshal(in.privacyInput.Sections)
	if err != nil {
		return pg.PortalCareerDossierRecord{}, err
	}
	p := in.privacyInput
	row := q.QueryRow(
		ctx,
		`INSERT INTO career_dossiers (
			slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
			sections_json, publish_status, sanitization_verified_at, denylist_hash, sort_order, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'draft', $10, $11, $12, $10)
		ON CONFLICT (slug) DO UPDATE SET
			kind = EXCLUDED.kind, title = EXCLUDED.title, domain_label = EXCLUDED.domain_label,
			role_title = EXCLUDED.role_title, timeframe = EXCLUDED.timeframe, skills = EXCLUDED.skills,
			summary_body = EXCLUDED.summary_body, sections_json = EXCLUDED.sections_json,
			publish_status = 'draft', sanitization_verified_at = EXCLUDED.sanitization_verified_at,
			denylist_hash = EXCLUDED.denylist_hash, sort_order = EXCLUDED.sort_order, updated_at = EXCLUDED.updated_at
		RETURNING slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		          COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		          denylist_hash, sort_order, updated_at`,
		p.Slug, in.kind, p.Title, p.DomainLabel, p.RoleTitle, p.Timeframe,
		p.Skills, p.SummaryBody, string(sectionsJSON), verifiedAt.UTC(), denylistHash, in.sortOrder,
	)
	return scanCareerDossierRow(row)
}

func (s *adminCmsServiceServer) ListCareerDossiers(
	ctx context.Context,
	req *connect.Request[adminv1.ListCareerDossiersRequest],
) (*connect.Response[adminv1.ListCareerDossiersResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	dossiers, err := s.listAllCareerDossiers(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.ListCareerDossiersResponse{Dossiers: dossiers}), nil
}

func (s *adminCmsServiceServer) UpsertCareerDossier(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertCareerDossierRequest],
) (*connect.Response[adminv1.UpsertCareerDossierResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	in, valErr := validateDossierInput(req.Msg.GetDossier(), corrID)
	if valErr != nil {
		return nil, valErr
	}
	denylist, dlErr := privacy.LoadPolicyDenylistFromEnv()
	if dlErr != nil {
		return nil, mapAdminStoreError(dlErr, corrID)
	}
	dlHash, err := privacy.ScanCareerDossier(in.privacyInput, denylist, privacy.PublishScanOptions{
		RequireConfiguredDenylist: false,
		CorrelationID:             corrID,
		EmitAuditLogs:             true,
	})
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	rec, err := upsertCareerDossierWith(ctx, s.deps.store.Pool(), in, dlHash, s.deps.now())
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertCareerDossierResponse{Dossier: toProtoCareerDossier(rec)}), nil
}

func (s *adminCmsServiceServer) requireDossierSlug(ctx context.Context, headers http.Header, rawSlug string) (string, string, error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, headers, ""); err != nil {
		return "", "", err
	}
	slug := strings.TrimSpace(rawSlug)
	if slug == "" || containsNul(slug) {
		return "", "", newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Dossier slug is required.", "Select a valid career dossier.", corrID, nil)
	}
	return corrID, slug, nil
}

func (s *adminCmsServiceServer) PublishCareerDossier(
	ctx context.Context,
	req *connect.Request[adminv1.PublishCareerDossierRequest],
) (*connect.Response[adminv1.PublishCareerDossierResponse], error) {
	corrID, slug, err := s.requireDossierSlug(ctx, req.Header(), req.Msg.GetSlug())
	if err != nil {
		return nil, err
	}
	denylist, dlErr := privacy.LoadPolicyDenylistFromEnv()
	if dlErr != nil {
		return nil, mapAdminStoreError(dlErr, corrID)
	}
	tx, err := s.deps.store.Pool().Begin(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	existing, err := scanCareerDossierRow(tx.QueryRow(
		ctx,
		`SELECT slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		        COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		        denylist_hash, sort_order, updated_at
		 FROM career_dossiers WHERE slug = $1 FOR UPDATE`,
		slug,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Career dossier not found.", "Refresh dossiers and retry.", corrID, nil)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	sections := make([]privacy.CareerDossierSectionInput, 0, len(existing.Sections))
	for _, sec := range existing.Sections {
		sections = append(sections, privacy.CareerDossierSectionInput{Heading: sec.Heading, Body: sec.Body})
	}
	dlHash, scanErr := privacy.ScanCareerDossier(privacy.CareerDossierInput{
		Slug: existing.Slug, Title: existing.Title, DomainLabel: existing.DomainLabel,
		RoleTitle: existing.RoleTitle, Timeframe: existing.Timeframe, Skills: existing.Skills,
		SummaryBody: existing.SummaryBody, Sections: sections,
	}, denylist, privacy.PublishScanOptions{
		RequireConfiguredDenylist: privacy.IsProductionPolicyEnv(),
		CorrelationID:             corrID,
		EmitAuditLogs:             true,
	})
	if scanErr != nil {
		return nil, mapAdminStoreError(scanErr, corrID)
	}
	verifiedAt := s.deps.now().UTC()
	updated, err := scanCareerDossierRow(tx.QueryRow(
		ctx,
		`UPDATE career_dossiers
		 SET publish_status = 'published', sanitization_verified_at = $2, denylist_hash = $3, updated_at = $2
		 WHERE slug = $1
		 RETURNING slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		           COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		           denylist_hash, sort_order, updated_at`,
		slug, verifiedAt, dlHash,
	))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.PublishCareerDossierResponse{Dossier: toProtoCareerDossier(updated)}), nil
}

func (s *adminCmsServiceServer) UnpublishCareerDossier(
	ctx context.Context,
	req *connect.Request[adminv1.UnpublishCareerDossierRequest],
) (*connect.Response[adminv1.UnpublishCareerDossierResponse], error) {
	corrID, slug, err := s.requireDossierSlug(ctx, req.Header(), req.Msg.GetSlug())
	if err != nil {
		return nil, err
	}
	updated, err := scanCareerDossierRow(s.deps.store.Pool().QueryRow(
		ctx,
		`UPDATE career_dossiers SET publish_status = 'draft', updated_at = NOW() WHERE slug = $1
		 RETURNING slug, kind, title, domain_label, role_title, timeframe, skills, summary_body,
		           COALESCE(sections_json::text, '[]'), publish_status, sanitization_verified_at,
		           denylist_hash, sort_order, updated_at`,
		slug,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Career dossier not found.", "Refresh dossiers and retry.", corrID, nil)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UnpublishCareerDossierResponse{Dossier: toProtoCareerDossier(updated)}), nil
}

func (s *adminCmsServiceServer) DeleteCareerDossier(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteCareerDossierRequest],
) (*connect.Response[adminv1.DeleteCareerDossierResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM career_dossiers WHERE slug = $1`, strings.TrimSpace(req.Msg.GetSlug()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteCareerDossierResponse{Deleted: tag.RowsAffected() > 0}), nil
}

func (s *adminCmsServiceServer) ImportCareerDossiersBatch(
	ctx context.Context,
	req *connect.Request[adminv1.ImportCareerDossiersBatchRequest],
) (*connect.Response[adminv1.ImportCareerDossiersBatchResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	inputs := req.Msg.GetDossiers()
	if len(inputs) == 0 {
		return connect.NewResponse(&adminv1.ImportCareerDossiersBatchResponse{}), nil
	}
	denylist, dlErr := privacy.LoadPolicyDenylistFromEnv()
	if dlErr != nil {
		return nil, mapAdminStoreError(dlErr, corrID)
	}
	type preparedItem struct {
		in           validatedDossierInput
		denylistHash string
	}
	prepared := make([]preparedItem, 0, len(inputs))
	aggregated := make([]privacy.Finding, 0)
	for _, raw := range inputs {
		in, valErr := validateDossierInput(raw, corrID)
		if valErr != nil {
			return nil, valErr
		}
		dlHash, err := privacy.ScanCareerDossier(in.privacyInput, denylist, privacy.PublishScanOptions{
			RequireConfiguredDenylist: false,
			CorrelationID:             corrID,
			EmitAuditLogs:             true,
		})
		if err != nil {
			if pe, ok := privacy.AsPolicyError(err); ok {
				for _, f := range pe.Findings {
					f.Field = in.privacyInput.Slug + "." + f.Field
					aggregated = append(aggregated, f)
				}
				continue
			}
			return nil, mapAdminStoreError(err, corrID)
		}
		prepared = append(prepared, preparedItem{in: in, denylistHash: dlHash})
	}
	if len(aggregated) > 0 {
		return nil, newPrivacyConstraintError(aggregated, "Batch career dossier import blocked by privacy sanitization policy.", corrID)
	}
	tx, err := s.deps.store.Pool().Begin(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	now := s.deps.now()
	saved := make([]*portalv1.CareerDossier, 0, len(prepared))
	for _, item := range prepared {
		rec, uErr := upsertCareerDossierWith(ctx, tx, item.in, item.denylistHash, now)
		if uErr != nil {
			return nil, mapAdminStoreError(uErr, corrID)
		}
		saved = append(saved, toProtoCareerDossier(rec))
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.ImportCareerDossiersBatchResponse{Dossiers: saved}), nil
}
