package main

import (
	"context"
	"fmt"
	"strings"
	"time"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
)

func (s *adminAnalyticsServiceServer) GetOverviewData(
	ctx context.Context,
	req *connect.Request[adminv1.GetOverviewDataRequest],
) (*connect.Response[adminv1.GetOverviewDataResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), req.Msg.GetSessionId())
	if err != nil {
		return nil, err
	}
	contentJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "admin-home")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	pool := s.deps.store.Pool()
	now := s.deps.now().UTC()
	cutoff24h := now.Add(-24 * time.Hour)
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)

	menuRows, err := pool.Query(ctx, `SELECT slug, key_shortcut, title, description, admin_only, sort_order, enabled FROM menu_items ORDER BY sort_order ASC, slug ASC`)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer menuRows.Close()
	menuItems := make([]*adminv1.MenuItem, 0)
	for menuRows.Next() {
		var m adminv1.MenuItem
		if err := menuRows.Scan(&m.Slug, &m.KeyShortcut, &m.Title, &m.Description, &m.AdminOnly, &m.SortOrder, &m.Enabled); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		menuItems = append(menuItems, &m)
	}
	if err := menuRows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	var contactCount, sessions24h, events24h, totalRuns, pendingGates int32
	var dailyTokensUsed, dailyTokenCap int64
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM contact_submissions`).Scan(&contactCount); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM analytics_sessions WHERE app = 'portal' AND is_bot = false AND started_at >= $1`, cutoff24h).Scan(&sessions24h); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM analytics_events e INNER JOIN analytics_sessions s ON s.session_id = e.session_id WHERE s.app = 'portal' AND s.is_bot = false AND e.created_at >= $1`, cutoff24h).Scan(&events24h); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int, COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int FROM sandbox_runs WHERE is_golden = false`).Scan(&totalRuns, &pendingGates); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `SELECT COALESCE(SUM(tokens_in + tokens_out), 0)::bigint FROM sandbox_runs WHERE is_golden = false AND created_at >= $1`, startOfDay).Scan(&dailyTokensUsed); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if err := pool.QueryRow(ctx, `SELECT COALESCE((SELECT max_daily_global_tokens::bigint FROM quota_policies WHERE role = 'guest' LIMIT 1), 100000)`).Scan(&dailyTokenCap); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if dailyTokenCap < 1 {
		dailyTokenCap = 1
	}

	handle := adminSession.Handle
	if req.Msg.Handle != nil && strings.TrimSpace(*req.Msg.Handle) != "" {
		handle = strings.TrimSpace(*req.Msg.Handle)
	}
	passkeyCount := int32(adminSession.PasskeyCount)
	if req.Msg.PasskeyCount != nil {
		passkeyCount = *req.Msg.PasskeyCount
	}
	totpEnabled := adminSession.TotpEnabled
	if req.Msg.TotpEnabled != nil {
		totpEnabled = *req.Msg.TotpEnabled
	}

	return connect.NewResponse(&adminv1.GetOverviewDataResponse{
		ContentJson: contentJSON,
		MenuItems:   menuItems,
		PostgresHealth: &adminv1.AdminServiceHealth{
			Name:   "PostgreSQL 19",
			Status: "ok",
			Detail: fmt.Sprintf("%d menu routes · %d inbox messages", len(menuItems), contactCount),
		},
		Metrics: &adminv1.AdminOverviewMetrics{
			ContactCount:     contactCount,
			Sessions_24H:     sessions24h,
			Events_24H:       events24h,
			DailyTokensUsed:  dailyTokensUsed,
			DailyTokenCap:    dailyTokenCap,
			TotalSandboxRuns: totalRuns,
			PendingGates:     pendingGates,
		},
		Security: &adminv1.AdminSecuritySummary{
			Handle:       handle,
			PasskeyCount: passkeyCount,
			TotpEnabled:  totpEnabled,
		},
	}), nil
}
