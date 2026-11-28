package main

import (
	"context"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
)

func (s *adminCmsServiceServer) listAllTerminalData(ctx context.Context) (
	[]*adminv1.AdminTerminalProfileRow,
	[]*adminv1.AdminTerminalCommandRow,
	[]*adminv1.AdminTerminalInitialEntryRow,
	[]*adminv1.AdminTerminalDirectoryEntryRow,
	error,
) {
	pool := s.deps.store.Pool()
	profiles, err := queryRows(ctx, pool, `SELECT slug, banner_title, banner_meta, os_label, directory, vcs_branch, vcs_state, context_label, placeholder, quick_commands FROM terminal_profiles WHERE slug <> $1 ORDER BY slug ASC`, []any{retiredMaintenanceKey},
		func(scan func(...any) error) (*adminv1.AdminTerminalProfileRow, error) {
			var r adminv1.AdminTerminalProfileRow
			if err := scan(&r.Slug, &r.BannerTitle, &r.BannerMeta, &r.OsLabel, &r.Directory, &r.VcsBranch, &r.VcsState, &r.ContextLabel, &r.Placeholder, &r.QuickCommands); err != nil {
				return nil, err
			}
			if r.QuickCommands == nil {
				r.QuickCommands = []string{}
			}
			return &r, nil
		})
	if err != nil {
		return nil, nil, nil, nil, err
	}

	commands, err := queryRows(ctx, pool, `SELECT id, profile_slug, name, description, kind, output, target_route, allowed_routes, error_template, sort_order FROM terminal_commands WHERE profile_slug <> $1 ORDER BY profile_slug ASC, sort_order ASC, id ASC`, []any{retiredMaintenanceKey},
		func(scan func(...any) error) (*adminv1.AdminTerminalCommandRow, error) {
			var r adminv1.AdminTerminalCommandRow
			if err := scan(&r.Id, &r.ProfileSlug, &r.Name, &r.Description, &r.Kind, &r.Output, &r.TargetRoute, &r.AllowedRoutes, &r.ErrorTemplate, &r.SortOrder); err != nil {
				return nil, err
			}
			if r.AllowedRoutes == nil {
				r.AllowedRoutes = []string{}
			}
			return &r, nil
		})
	if err != nil {
		return nil, nil, nil, nil, err
	}

	iRows, err := pool.Query(ctx, `SELECT id, profile_slug, command, output, status, duration_label, timestamp_label, sort_order FROM terminal_initial_entries WHERE profile_slug <> $1 ORDER BY profile_slug ASC, sort_order ASC, id ASC`, retiredMaintenanceKey)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	defer iRows.Close()
	entries := make([]*adminv1.AdminTerminalInitialEntryRow, 0)
	for iRows.Next() {
		var r adminv1.AdminTerminalInitialEntryRow
		if err := iRows.Scan(&r.Id, &r.ProfileSlug, &r.Command, &r.Output, &r.Status, &r.DurationLabel, &r.TimestampLabel, &r.SortOrder); err != nil {
			return nil, nil, nil, nil, err
		}
		entries = append(entries, &r)
	}
	if err := iRows.Err(); err != nil {
		return nil, nil, nil, nil, err
	}

	dRows, err := pool.Query(ctx, `SELECT id, profile_slug, name, description, sort_order, enabled FROM terminal_directory_entries WHERE profile_slug <> $1 ORDER BY profile_slug ASC, sort_order ASC, id ASC`, retiredMaintenanceKey)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	defer dRows.Close()
	dirs := make([]*adminv1.AdminTerminalDirectoryEntryRow, 0)
	for dRows.Next() {
		var r adminv1.AdminTerminalDirectoryEntryRow
		if err := dRows.Scan(&r.Id, &r.ProfileSlug, &r.Name, &r.Description, &r.SortOrder, &r.Enabled); err != nil {
			return nil, nil, nil, nil, err
		}
		dirs = append(dirs, &r)
	}
	return profiles, commands, entries, dirs, dRows.Err()
}

func (s *adminCmsServiceServer) UpsertTerminalProfile(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertTerminalProfileRequest],
) (*connect.Response[adminv1.UpsertTerminalProfileResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	slug := strings.TrimSpace(req.Msg.GetSlug())
	if retiredErr := checkRetiredMaintenanceTarget(slug, "terminal_profile", corrID); retiredErr != nil {
		return nil, retiredErr
	}
	if slug == "" || containsNul(slug) || containsNul(req.Msg.GetBannerTitle()) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Terminal profile slug is required.", "Provide valid terminal profile fields.", corrID, nil)
	}
	quick := req.Msg.GetQuickCommands()
	if quick == nil {
		quick = []string{}
	}
	var out adminv1.AdminTerminalProfileRow
	err := s.deps.store.Pool().QueryRow(
		ctx,
		`INSERT INTO terminal_profiles (slug, banner_title, banner_meta, os_label, directory, vcs_branch, vcs_state, context_label, placeholder, quick_commands)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		 ON CONFLICT (slug) DO UPDATE SET
		   banner_title = EXCLUDED.banner_title,
		   banner_meta = EXCLUDED.banner_meta,
		   os_label = EXCLUDED.os_label,
		   directory = EXCLUDED.directory,
		   vcs_branch = EXCLUDED.vcs_branch,
		   vcs_state = EXCLUDED.vcs_state,
		   context_label = EXCLUDED.context_label,
		   placeholder = EXCLUDED.placeholder,
		   quick_commands = EXCLUDED.quick_commands
		 RETURNING slug, banner_title, banner_meta, os_label, directory, vcs_branch, vcs_state, context_label, placeholder, quick_commands`,
		slug, req.Msg.GetBannerTitle(), req.Msg.GetBannerMeta(), req.Msg.GetOsLabel(), req.Msg.GetDirectory(),
		req.Msg.GetVcsBranch(), req.Msg.GetVcsState(), req.Msg.GetContextLabel(), req.Msg.GetPlaceholder(), quick,
	).Scan(&out.Slug, &out.BannerTitle, &out.BannerMeta, &out.OsLabel, &out.Directory, &out.VcsBranch, &out.VcsState, &out.ContextLabel, &out.Placeholder, &out.QuickCommands)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertTerminalProfileResponse{Profile: &out}), nil
}

func (s *adminCmsServiceServer) UpsertTerminalCommand(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertTerminalCommandRequest],
) (*connect.Response[adminv1.UpsertTerminalCommandResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	profileSlug := strings.TrimSpace(req.Msg.GetProfileSlug())
	if retiredErr := checkRetiredMaintenanceTarget(profileSlug, "terminal_command", corrID); retiredErr != nil {
		return nil, retiredErr
	}
	name := strings.TrimSpace(req.Msg.GetName())
	if profileSlug == "" || name == "" || containsNul(profileSlug) || containsNul(name) || containsNul(req.Msg.GetOutput()) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Terminal command profileSlug and name are required.", "Review command fields.", corrID, nil)
	}
	allowed := req.Msg.GetAllowedRoutes()
	if allowed == nil {
		allowed = []string{}
	}
	targetRoute := optString(req.Msg.TargetRoute)
	errorTemplate := optString(req.Msg.ErrorTemplate)

	pool := s.deps.store.Pool()
	var out adminv1.AdminTerminalCommandRow
	if req.Msg.Id != nil && *req.Msg.Id > 0 {
		err := pool.QueryRow(
			ctx,
			`UPDATE terminal_commands
			 SET profile_slug = $2, name = $3, description = $4, kind = $5, output = $6,
			     target_route = $7, allowed_routes = $8, error_template = $9, sort_order = $10
			 WHERE id = $1
			 RETURNING id, profile_slug, name, description, kind, output, target_route, allowed_routes, error_template, sort_order`,
			*req.Msg.Id, profileSlug, name, req.Msg.GetDescription(), req.Msg.GetKind(), req.Msg.GetOutput(),
			targetRoute, allowed, errorTemplate, req.Msg.GetSortOrder(),
		).Scan(&out.Id, &out.ProfileSlug, &out.Name, &out.Description, &out.Kind, &out.Output, &out.TargetRoute, &out.AllowedRoutes, &out.ErrorTemplate, &out.SortOrder)
		if err == nil {
			return connect.NewResponse(&adminv1.UpsertTerminalCommandResponse{Command: &out}), nil
		}
	}
	err := pool.QueryRow(
		ctx,
		`INSERT INTO terminal_commands (profile_slug, name, description, kind, output, target_route, allowed_routes, error_template, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 ON CONFLICT (profile_slug, name) DO UPDATE SET
		   description = EXCLUDED.description, kind = EXCLUDED.kind, output = EXCLUDED.output,
		   target_route = EXCLUDED.target_route, allowed_routes = EXCLUDED.allowed_routes,
		   error_template = EXCLUDED.error_template, sort_order = EXCLUDED.sort_order
		 RETURNING id, profile_slug, name, description, kind, output, target_route, allowed_routes, error_template, sort_order`,
		profileSlug, name, req.Msg.GetDescription(), req.Msg.GetKind(), req.Msg.GetOutput(),
		targetRoute, allowed, errorTemplate, req.Msg.GetSortOrder(),
	).Scan(&out.Id, &out.ProfileSlug, &out.Name, &out.Description, &out.Kind, &out.Output, &out.TargetRoute, &out.AllowedRoutes, &out.ErrorTemplate, &out.SortOrder)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertTerminalCommandResponse{Command: &out}), nil
}

func (s *adminCmsServiceServer) DeleteTerminalCommand(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteTerminalCommandRequest],
) (*connect.Response[adminv1.DeleteTerminalCommandResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	if req.Msg.GetId() <= 0 {
		return connect.NewResponse(&adminv1.DeleteTerminalCommandResponse{Deleted: false}), nil
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM terminal_commands WHERE id = $1`, req.Msg.GetId())
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteTerminalCommandResponse{Deleted: tag.RowsAffected() > 0}), nil
}

func (s *adminCmsServiceServer) UpsertTerminalInitialEntry(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertTerminalInitialEntryRequest],
) (*connect.Response[adminv1.UpsertTerminalInitialEntryResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	profileSlug := strings.TrimSpace(req.Msg.GetProfileSlug())
	if retiredErr := checkRetiredMaintenanceTarget(profileSlug, "terminal_initial_entry", corrID); retiredErr != nil {
		return nil, retiredErr
	}
	cmd := strings.TrimSpace(req.Msg.GetCommand())
	if profileSlug == "" || cmd == "" || containsNul(profileSlug) || containsNul(cmd) || containsNul(req.Msg.GetOutput()) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Terminal initial entry profileSlug and command are required.", "Review entry fields.", corrID, nil)
	}
	pool := s.deps.store.Pool()
	var out adminv1.AdminTerminalInitialEntryRow
	if req.Msg.Id != nil && *req.Msg.Id > 0 {
		err := pool.QueryRow(
			ctx,
			`UPDATE terminal_initial_entries
			 SET profile_slug = $2, command = $3, output = $4, status = $5, duration_label = $6, timestamp_label = $7, sort_order = $8
			 WHERE id = $1
			 RETURNING id, profile_slug, command, output, status, duration_label, timestamp_label, sort_order`,
			*req.Msg.Id, profileSlug, cmd, req.Msg.GetOutput(), req.Msg.GetStatus(), req.Msg.GetDurationLabel(), req.Msg.GetTimestampLabel(), req.Msg.GetSortOrder(),
		).Scan(&out.Id, &out.ProfileSlug, &out.Command, &out.Output, &out.Status, &out.DurationLabel, &out.TimestampLabel, &out.SortOrder)
		if err == nil {
			return connect.NewResponse(&adminv1.UpsertTerminalInitialEntryResponse{Entry: &out}), nil
		}
	}
	err := pool.QueryRow(
		ctx,
		`INSERT INTO terminal_initial_entries (profile_slug, command, output, status, duration_label, timestamp_label, sort_order)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 ON CONFLICT (profile_slug, sort_order) DO UPDATE SET
		   command = EXCLUDED.command, output = EXCLUDED.output, status = EXCLUDED.status,
		   duration_label = EXCLUDED.duration_label, timestamp_label = EXCLUDED.timestamp_label
		 RETURNING id, profile_slug, command, output, status, duration_label, timestamp_label, sort_order`,
		profileSlug, cmd, req.Msg.GetOutput(), req.Msg.GetStatus(), req.Msg.GetDurationLabel(), req.Msg.GetTimestampLabel(), req.Msg.GetSortOrder(),
	).Scan(&out.Id, &out.ProfileSlug, &out.Command, &out.Output, &out.Status, &out.DurationLabel, &out.TimestampLabel, &out.SortOrder)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertTerminalInitialEntryResponse{Entry: &out}), nil
}

func (s *adminCmsServiceServer) DeleteTerminalInitialEntry(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteTerminalInitialEntryRequest],
) (*connect.Response[adminv1.DeleteTerminalInitialEntryResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	if req.Msg.GetId() <= 0 {
		return connect.NewResponse(&adminv1.DeleteTerminalInitialEntryResponse{Deleted: false}), nil
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM terminal_initial_entries WHERE id = $1`, req.Msg.GetId())
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteTerminalInitialEntryResponse{Deleted: tag.RowsAffected() > 0}), nil
}

func (s *adminCmsServiceServer) UpsertTerminalDirectoryEntry(
	ctx context.Context,
	req *connect.Request[adminv1.UpsertTerminalDirectoryEntryRequest],
) (*connect.Response[adminv1.UpsertTerminalDirectoryEntryResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	profileSlug := strings.TrimSpace(req.Msg.GetProfileSlug())
	if retiredErr := checkRetiredMaintenanceTarget(profileSlug, "terminal_directory_entry", corrID); retiredErr != nil {
		return nil, retiredErr
	}
	name := strings.TrimSpace(req.Msg.GetName())
	if profileSlug == "" || name == "" || containsNul(profileSlug) || containsNul(name) || containsNul(req.Msg.GetDescription()) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Terminal directory entry profileSlug and name are required.", "Review directory entry fields.", corrID, nil)
	}
	pool := s.deps.store.Pool()
	var out adminv1.AdminTerminalDirectoryEntryRow
	if req.Msg.Id != nil && *req.Msg.Id > 0 {
		err := pool.QueryRow(
			ctx,
			`UPDATE terminal_directory_entries
			 SET profile_slug = $2, name = $3, description = $4, sort_order = $5, enabled = $6
			 WHERE id = $1
			 RETURNING id, profile_slug, name, description, sort_order, enabled`,
			*req.Msg.Id, profileSlug, name, req.Msg.GetDescription(), req.Msg.GetSortOrder(), req.Msg.GetEnabled(),
		).Scan(&out.Id, &out.ProfileSlug, &out.Name, &out.Description, &out.SortOrder, &out.Enabled)
		if err == nil {
			return connect.NewResponse(&adminv1.UpsertTerminalDirectoryEntryResponse{Entry: &out}), nil
		}
	}
	err := pool.QueryRow(
		ctx,
		`INSERT INTO terminal_directory_entries (profile_slug, name, description, sort_order, enabled)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (profile_slug, name) DO UPDATE SET
		   description = EXCLUDED.description, sort_order = EXCLUDED.sort_order, enabled = EXCLUDED.enabled
		 RETURNING id, profile_slug, name, description, sort_order, enabled`,
		profileSlug, name, req.Msg.GetDescription(), req.Msg.GetSortOrder(), req.Msg.GetEnabled(),
	).Scan(&out.Id, &out.ProfileSlug, &out.Name, &out.Description, &out.SortOrder, &out.Enabled)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpsertTerminalDirectoryEntryResponse{Entry: &out}), nil
}

func (s *adminCmsServiceServer) DeleteTerminalDirectoryEntry(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteTerminalDirectoryEntryRequest],
) (*connect.Response[adminv1.DeleteTerminalDirectoryEntryResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	if req.Msg.GetId() <= 0 {
		return connect.NewResponse(&adminv1.DeleteTerminalDirectoryEntryResponse{Deleted: false}), nil
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM terminal_directory_entries WHERE id = $1`, req.Msg.GetId())
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.DeleteTerminalDirectoryEntryResponse{Deleted: tag.RowsAffected() > 0}), nil
}
