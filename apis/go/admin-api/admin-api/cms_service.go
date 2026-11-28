package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type adminCmsServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminCmsServiceHandler = (*adminCmsServiceServer)(nil)

func newAdminCmsServiceServer(deps adminServiceDeps) *adminCmsServiceServer {
	return &adminCmsServiceServer{deps: deps}
}

func (s *adminCmsServiceServer) GetAdminChrome(
	ctx context.Context,
	req *connect.Request[adminv1.GetAdminChromeRequest],
) (*connect.Response[adminv1.GetAdminChromeResponse], error) {
	corrID := resolveCorrID(ctx)
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok {
		return nil, newAdminError(connect.CodeUnauthenticated, contracts.ErrCodeUnauthorized, http.StatusUnauthorized, "Authentication required.", "Provide valid internal credentials.", corrID, nil)
	}
	allowedServiceChrome := claims.Role == internalauth.RoleService && claims.Sub == adminChromeSubject
	if !allowedServiceChrome {
		if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
			return nil, err
		}
	}
	chromeJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "admin-chrome")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.GetAdminChromeResponse{
		ChromeJson: chromeJSON,
	}), nil
}

func (s *adminCmsServiceServer) GetAdminWorkspaceBootstrap(
	ctx context.Context,
	req *connect.Request[adminv1.GetAdminWorkspaceBootstrapRequest],
) (*connect.Response[adminv1.GetAdminWorkspaceBootstrapResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), req.Msg.GetSessionId()); err != nil {
		return nil, err
	}
	chromeJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "admin-chrome")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	terminal, err := s.deps.store.LoadTerminalProfile(ctx, "admin-ops")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.GetAdminWorkspaceBootstrapResponse{
		ChromeJson: chromeJSON,
		Terminal:   toProtoTerminalProfile(terminal),
	}), nil
}

func (s *adminCmsServiceServer) GetCmsData(
	ctx context.Context,
	req *connect.Request[adminv1.GetCmsDataRequest],
) (*connect.Response[adminv1.GetCmsDataResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	pool := s.deps.store.Pool()
	if pool == nil {
		return nil, mapAdminStoreError(pg.ErrSiteContentMissing, corrID)
	}

	creatorHandle := agensi.ResolveConfigFromEnv().CreatorHandle
	if req.Msg.CreatorHandle != nil && strings.TrimSpace(*req.Msg.CreatorHandle) != "" {
		creatorHandle = strings.TrimSpace(*req.Msg.CreatorHandle)
	}

	siteContents, err := s.listSiteContents(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	menuItems, err := s.listMenuItems(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	profiles, commands, initialEntries, dirEntries, err := s.listAllTerminalData(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	skills, err := s.deps.store.QueryCreatorPublishedAgensiSkills(ctx, creatorHandle)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	syncState, err := s.deps.store.ReadAgensiSyncState(ctx, creatorHandle)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	presets, err := s.listCadencePresetsAllowEmpty(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	dossiers, err := s.listAllCareerDossiers(ctx)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	return connect.NewResponse(&adminv1.GetCmsDataResponse{
		SiteContents:             siteContents,
		MenuItems:                menuItems,
		TerminalProfiles:         profiles,
		TerminalCommands:         commands,
		TerminalInitialEntries:   initialEntries,
		TerminalDirectoryEntries: dirEntries,
		AgensiSkills:             toProtoAgensiSkills(skills),
		AgensiSyncState:          toProtoAgensiSyncState(syncState),
		CadencePresets:           presets,
		CareerDossiers:           dossiers,
	}), nil
}

func (s *adminCmsServiceServer) listSiteContents(ctx context.Context) ([]*adminv1.SiteContentRow, error) {
	rows, err := s.deps.store.Pool().Query(ctx, `SELECT key, markdown_body, metadata_json::text, updated_at FROM site_content WHERE key <> $1 ORDER BY key ASC`, retiredMaintenanceKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*adminv1.SiteContentRow, 0)
	for rows.Next() {
		var r adminv1.SiteContentRow
		var updatedAt time.Time
		if err := rows.Scan(&r.Key, &r.MarkdownBody, &r.MetadataJson, &updatedAt); err != nil {
			return nil, err
		}
		r.UpdatedAt = formatRFC3339Millis(updatedAt)
		out = append(out, &r)
	}
	return out, rows.Err()
}

func (s *adminCmsServiceServer) listMenuItems(ctx context.Context) ([]*adminv1.MenuItem, error) {
	rows, err := s.deps.store.Pool().Query(ctx, `SELECT slug, key_shortcut, title, description, admin_only, sort_order, enabled FROM menu_items ORDER BY sort_order ASC, slug ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*adminv1.MenuItem, 0)
	for rows.Next() {
		var m adminv1.MenuItem
		if err := rows.Scan(&m.Slug, &m.KeyShortcut, &m.Title, &m.Description, &m.AdminOnly, &m.SortOrder, &m.Enabled); err != nil {
			return nil, err
		}
		out = append(out, &m)
	}
	return out, rows.Err()
}

func (s *adminCmsServiceServer) listCadencePresetsAllowEmpty(ctx context.Context) ([]*portalv1.CadencePreset, error) {
	rows, err := s.deps.store.Pool().Query(ctx, `SELECT slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order FROM cadence_presets ORDER BY sort_order ASC, slug ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]*portalv1.CadencePreset, 0)
	for rows.Next() {
		var p portalv1.CadencePreset
		if err := rows.Scan(&p.Slug, &p.Title, &p.StarterPrompt, &p.ExpectedKind, &p.StarterArtifactHtml, &p.SortOrder); err != nil {
			return nil, err
		}
		out = append(out, &p)
	}
	return out, rows.Err()
}

func (s *adminCmsServiceServer) UpsertSiteContent(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertSiteContentRequest],
) (*connect.Response[adminv1.UpsertSiteContentResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	canonicalMeta, valErr := validateAndSanitizeSiteContent(req.Msg.GetKey(), req.Msg.GetMarkdownBody(), req.Msg.GetMetadataJson(), corrID)
	if valErr != nil {
		return nil, valErr
	}
	key := strings.TrimSpace(req.Msg.GetKey())
	var out adminv1.SiteContentRow
	var updatedAt time.Time
	err := s.deps.store.Pool().QueryRow(
		ctx,
		`INSERT INTO site_content (key, markdown_body, metadata_json, updated_at)
		 VALUES ($1, $2, $3::jsonb, NOW())
		 ON CONFLICT (key) DO UPDATE SET
		   markdown_body = EXCLUDED.markdown_body,
		   metadata_json = EXCLUDED.metadata_json,
		   updated_at = NOW()
		 RETURNING key, markdown_body, metadata_json::text, updated_at`,
		key, req.Msg.GetMarkdownBody(), canonicalMeta,
	).Scan(&out.Key, &out.MarkdownBody, &out.MetadataJson, &updatedAt)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	out.UpdatedAt = formatRFC3339Millis(updatedAt)
	return connect.NewResponse(&adminv1.UpsertSiteContentResponse{Row: &out}), nil
}

func (s *adminCmsServiceServer) UpsertMenuItem(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertMenuItemRequest],
) (*connect.Response[adminv1.UpsertMenuItemResponse], error) {
	desc := strings.TrimSpace(req.Msg.GetDescription())
	corrID, fields, err := s.authorizeAndValidateFields(
		ctx, req.Header(),
		"Menu item slug, keyShortcut, and title are required.", "Review menu fields.",
		[]string{req.Msg.GetSlug(), req.Msg.GetKeyShortcut(), req.Msg.GetTitle()},
		[]string{desc},
	)
	if err != nil {
		return nil, err
	}
	slug, shortcut, title := fields[0], fields[1], fields[2]
	var item adminv1.MenuItem
	err = s.deps.store.Pool().QueryRow(
		ctx,
		`INSERT INTO menu_items (slug, key_shortcut, title, description, admin_only, sort_order, enabled)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (slug) DO UPDATE SET
		   key_shortcut = EXCLUDED.key_shortcut,
		   title = EXCLUDED.title,
		   description = EXCLUDED.description,
		   admin_only = EXCLUDED.admin_only,
		   sort_order = EXCLUDED.sort_order,
		   enabled = EXCLUDED.enabled
		 RETURNING slug, key_shortcut, title, description, admin_only, sort_order, enabled`,
		slug, shortcut, title, desc, req.Msg.GetAdminOnly(), req.Msg.GetSortOrder(), req.Msg.GetEnabled(),
	).Scan(&item.Slug, &item.KeyShortcut, &item.Title, &item.Description, &item.AdminOnly, &item.SortOrder, &item.Enabled)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertMenuItemResponse{Item: &item}), nil
}

func (s *adminCmsServiceServer) DeleteMenuItem(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteMenuItemRequest],
) (*connect.Response[adminv1.DeleteMenuItemResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM menu_items WHERE slug = $1`, strings.TrimSpace(req.Msg.GetSlug()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteMenuItemResponse{Deleted: tag.RowsAffected() > 0}), nil
}

func (s *adminCmsServiceServer) UpsertCadencePreset(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertCadencePresetRequest],
) (*connect.Response[adminv1.UpsertCadencePresetResponse], error) {
	corrID, fields, err := s.authorizeAndValidateFields(
		ctx, req.Header(),
		"Preset slug, title, starterPrompt, and expectedKind are required.", "Review preset fields.",
		[]string{req.Msg.GetSlug(), req.Msg.GetTitle(), req.Msg.GetStarterPrompt(), req.Msg.GetExpectedKind()},
		[]string{req.Msg.GetStarterArtifactHtml()},
	)
	if err != nil {
		return nil, err
	}
	slug, title, prompt, kind := fields[0], fields[1], fields[2], fields[3]
	var out portalv1.CadencePreset
	err = s.deps.store.Pool().QueryRow(
		ctx,
		`INSERT INTO cadence_presets (slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 ON CONFLICT (slug) DO UPDATE SET
		   title = EXCLUDED.title,
		   starter_prompt = EXCLUDED.starter_prompt,
		   expected_kind = EXCLUDED.expected_kind,
		   starter_artifact_html = EXCLUDED.starter_artifact_html,
		   sort_order = EXCLUDED.sort_order
		 RETURNING slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order`,
		slug, title, prompt, kind, req.Msg.GetStarterArtifactHtml(), req.Msg.GetSortOrder(),
	).Scan(&out.Slug, &out.Title, &out.StarterPrompt, &out.ExpectedKind, &out.StarterArtifactHtml, &out.SortOrder)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertCadencePresetResponse{Preset: &out}), nil
}

func (s *adminCmsServiceServer) DeleteCadencePreset(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteCadencePresetRequest],
) (*connect.Response[adminv1.DeleteCadencePresetResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM cadence_presets WHERE slug = $1`, strings.TrimSpace(req.Msg.GetSlug()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteCadencePresetResponse{Deleted: tag.RowsAffected() > 0}), nil
}

func (s *adminCmsServiceServer) SyncAgensiCatalog(
	ctx context.Context,
	req *connect.Request[adminv1.SyncAgensiCatalogRequest],
) (*connect.Response[adminv1.SyncAgensiCatalogResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	cfg := agensi.ResolveConfigFromEnv()
	if req.Msg.CreatorHandle != nil && strings.TrimSpace(*req.Msg.CreatorHandle) != "" {
		cfg.CreatorHandle = strings.TrimSpace(*req.Msg.CreatorHandle)
	}
	startedAt := s.deps.now()
	preState, err := s.deps.store.ReadAgensiSyncState(ctx, cfg.CreatorHandle)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	existingSkills, err := s.deps.store.QueryCreatorPublishedAgensiSkills(ctx, cfg.CreatorHandle)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	var preSynced *time.Time
	etag := ""
	if preState != nil {
		preSynced = preState.LastSyncedAt
		if !req.Msg.GetForceRefresh() && len(existingSkills) > 0 && preState.ETag != nil {
			etag = *preState.ETag
		}
	}
	fetchRes := agensi.FetchCreatorCatalog(ctx, cfg, agensi.FetchOptions{
		CorrelationID: corrID,
		ETag:          etag,
		HTTPClient:    s.deps.agensiHTTPClient,
	})
	if !fetchRes.OK {
		safeMsg := agensi.ScrubSecret(fetchRes.Message, cfg.APIKey)
		_, _ = s.deps.store.RecordAgensiFailureTx(ctx, cfg.CreatorHandle, safeMsg, startedAt)
		return nil, newAdminError(connect.CodeUnavailable, contracts.ErrCodeUpstreamUnavailable, http.StatusServiceUnavailable, safeMsg, "Verify Agensi upstream availability and retry.", corrID, nil)
	}
	committed, err := s.deps.store.CommitAgensiSyncTx(ctx, pg.CommitAgensiSyncInput{
		CreatorHandle:      cfg.CreatorHandle,
		TTLSeconds:         cfg.TTLSeconds,
		ForceRefresh:       req.Msg.GetForceRefresh(),
		NotModified:        fetchRes.NotModified,
		Items:              fetchRes.Items,
		ETag:               fetchRes.ETag,
		FetchedAt:          fetchRes.FetchedAt,
		PreFetchLastSynced: preSynced,
		CorrelationID:      corrID,
		StartedAt:          startedAt,
	})
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	st := committed.SyncState
	return connect.NewResponse(&adminv1.SyncAgensiCatalogResponse{
		CreatorHandle: committed.CreatorHandle,
		Skills:        toProtoAgensiSkills(committed.Skills),
		SyncState:     toProtoAgensiSyncState(&st),
	}), nil
}
