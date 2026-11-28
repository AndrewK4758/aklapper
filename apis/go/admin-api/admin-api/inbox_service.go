package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	"github.com/jackc/pgx/v5"
)

type adminInboxServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminInboxServiceHandler = (*adminInboxServiceServer)(nil)

func newAdminInboxServiceServer(deps adminServiceDeps) *adminInboxServiceServer {
	return &adminInboxServiceServer{deps: deps}
}

func scanInboxItemRow(row pgx.Row) (*adminv1.AdminInboxItem, error) {
	var item adminv1.AdminInboxItem
	var createdAt time.Time
	if err := row.Scan(
		&item.Id, &item.Name, &item.Email, &item.Phone, &item.Message,
		&item.AttachmentName, &item.AttachmentMimeType, &item.AttachmentSizeBytes, &item.AttachmentSha256,
		&createdAt,
	); err != nil {
		return nil, err
	}
	item.CreatedAt = formatRFC3339Millis(createdAt)
	return &item, nil
}

func (s *adminInboxServiceServer) loadVisitorContextMap(ctx context.Context, contactIDs []string) (map[string]*adminv1.InboxVisitorContext, error) {
	out := make(map[string]*adminv1.InboxVisitorContext, len(contactIDs))
	if len(contactIDs) == 0 {
		return out, nil
	}
	rows, err := s.deps.store.Pool().Query(
		ctx,
		`SELECT
			cs.id::text AS contact_id,
			cs.analytics_session_id,
			COALESCE(cs.guest_session_id, s.guest_session_id) AS effective_guest_session_id,
			s.country,
			s.region,
			s.city,
			s.asn_org,
			s.referrer_host,
			s.referrer_category,
			s.landing_path,
			s.ref_param,
			s.utm_source,
			s.utm_campaign,
			s.device_type,
			s.os_name,
			s.browser_name,
			s.started_at,
			COALESCE(s.last_seen_at, s.started_at) AS last_seen_at,
			COALESCE(ev.viewed_paths, ARRAY[]::text[]) AS viewed_paths,
			COALESCE(ev.pane_open_count, 0)::int AS pane_open_count,
			COALESCE(atx.ask_turn_count, 0)::int AS ask_turn_count,
			atx.latest_ask_prompt_excerpt
		FROM contact_submissions cs
		LEFT JOIN analytics_sessions s ON s.session_id = cs.analytics_session_id
		LEFT JOIN LATERAL (
			SELECT
				COALESCE((
					SELECT ARRAY_AGG(vp.path ORDER BY vp.first_seen ASC)
					FROM (
						SELECT e.path, MIN(e.created_at) AS first_seen
						FROM analytics_events e
						WHERE e.session_id = s.session_id AND e.type = 'page_view'
						GROUP BY e.path
						ORDER BY MIN(e.created_at) ASC
						LIMIT 6
					) vp
				), ARRAY[]::text[]) AS viewed_paths,
				(
					SELECT COUNT(*)::int
					FROM analytics_events e
					WHERE e.session_id = s.session_id AND e.name = 'pane_open'
				) AS pane_open_count
		) ev ON s.session_id IS NOT NULL
		LEFT JOIN LATERAL (
			SELECT
				COUNT(*)::int AS ask_turn_count,
				(
					SELECT LEFT(at2.prompt_text, 160)
					FROM ask_turns at2
					WHERE at2.session_id = COALESCE(cs.guest_session_id, s.guest_session_id)
					  AND at2.prompt_text IS NOT NULL
					  AND BTRIM(at2.prompt_text) <> ''
					ORDER BY at2.created_at DESC
					LIMIT 1
				) AS latest_ask_prompt_excerpt
			FROM ask_turns at
			WHERE COALESCE(cs.guest_session_id, s.guest_session_id) IS NOT NULL
			  AND at.session_id = COALESCE(cs.guest_session_id, s.guest_session_id)
		) atx ON true
		WHERE cs.id = ANY($1::uuid[])`,
		contactIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var contactID string
		var ctxRow adminv1.InboxVisitorContext
		var startedAt, lastSeenAt *time.Time
		if scanErr := rows.Scan(
			&contactID, &ctxRow.AnalyticsSessionId, &ctxRow.GuestSessionId,
			&ctxRow.Country, &ctxRow.Region, &ctxRow.City, &ctxRow.AsnOrg,
			&ctxRow.ReferrerHost, &ctxRow.ReferrerCategory, &ctxRow.LandingPath,
			&ctxRow.RefParam, &ctxRow.UtmSource, &ctxRow.UtmCampaign,
			&ctxRow.DeviceType, &ctxRow.OsName, &ctxRow.BrowserName,
			&startedAt, &lastSeenAt, &ctxRow.ViewedPaths,
			&ctxRow.PaneOpenCount, &ctxRow.AskTurnCount, &ctxRow.LatestAskPromptExcerpt,
		); scanErr != nil {
			return nil, scanErr
		}
		if optString(ctxRow.AnalyticsSessionId) == nil && optString(ctxRow.GuestSessionId) == nil {
			continue
		}
		ctxRow.StartedAt = optionalRFC3339Millis(startedAt)
		ctxRow.LastSeenAt = optionalRFC3339Millis(lastSeenAt)
		if ctxRow.ViewedPaths == nil {
			ctxRow.ViewedPaths = []string{}
		}
		if len(ctxRow.ViewedPaths) > 6 {
			ctxRow.ViewedPaths = ctxRow.ViewedPaths[:6]
		}
		out[contactID] = &ctxRow
	}
	return out, rows.Err()
}

func (s *adminInboxServiceServer) ListContactSubmissions(
	ctx context.Context,
	req *connect.Request[adminv1.ListContactSubmissionsRequest],
) (*connect.Response[adminv1.ListContactSubmissionsResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	query := strings.TrimSpace(req.Msg.GetQuery())
	if containsNul(query) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Invalid search query.", "Remove NUL characters and retry.", corrID, nil)
	}
	pageSize := int(req.Msg.GetPageSize())
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	page := int(req.Msg.GetPage())
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * pageSize
	selectedID := ""
	if req.Msg.SelectedId != nil && contracts.ValidateUUID(strings.TrimSpace(*req.Msg.SelectedId)) {
		selectedID = strings.TrimSpace(*req.Msg.SelectedId)
	}

	pool := s.deps.store.Pool()
	var totalCount int32
	var rows pgx.Rows
	var err error
	const selectCols = `id::text, name, email, phone, message, attachment_name, attachment_mime_type, attachment_size_bytes, attachment_sha256, created_at`
	if query != "" {
		pattern := "%" + query + "%"
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM contact_submissions WHERE name ILIKE $1 OR email ILIKE $1 OR message ILIKE $1 OR COALESCE(attachment_name, '') ILIKE $1`, pattern).Scan(&totalCount)
		if err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		rows, err = pool.Query(ctx, `SELECT `+selectCols+` FROM contact_submissions WHERE name ILIKE $1 OR email ILIKE $1 OR message ILIKE $1 OR COALESCE(attachment_name, '') ILIKE $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, pattern, pageSize, offset)
	} else {
		err = pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM contact_submissions`).Scan(&totalCount)
		if err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		rows, err = pool.Query(ctx, `SELECT `+selectCols+` FROM contact_submissions ORDER BY created_at DESC LIMIT $1 OFFSET $2`, pageSize, offset)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer rows.Close()

	items := make([]*adminv1.AdminInboxItem, 0)
	var pinned *adminv1.AdminInboxItem
	for rows.Next() {
		item, scanErr := scanInboxItemRow(rows)
		if scanErr != nil {
			return nil, mapAdminStoreError(scanErr, corrID)
		}
		items = append(items, item)
		if selectedID != "" && item.Id == selectedID {
			pinned = item
		}
	}
	if err := rows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	if selectedID != "" && pinned == nil && query == "" {
		fetched, fErr := scanInboxItemRow(pool.QueryRow(ctx, `SELECT `+selectCols+` FROM contact_submissions WHERE id = $1::uuid LIMIT 1`, selectedID))
		if fErr == nil {
			pinned = fetched
		} else if !errors.Is(fErr, pgx.ErrNoRows) {
			return nil, mapAdminStoreError(fErr, corrID)
		}
	}

	idSet := make(map[string]struct{}, len(items)+1)
	idList := make([]string, 0, len(items)+1)
	for _, it := range items {
		if _, seen := idSet[it.Id]; !seen {
			idSet[it.Id] = struct{}{}
			idList = append(idList, it.Id)
		}
	}
	if pinned != nil {
		if _, seen := idSet[pinned.Id]; !seen {
			idList = append(idList, pinned.Id)
		}
	}
	ctxMap, err := s.loadVisitorContextMap(ctx, idList)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	for _, it := range items {
		it.VisitorContext = ctxMap[it.Id]
	}
	if pinned != nil {
		pinned.VisitorContext = ctxMap[pinned.Id]
	}

	var respSelectedID *string
	if pinned != nil {
		idCopy := pinned.Id
		respSelectedID = &idCopy
	}
	return connect.NewResponse(&adminv1.ListContactSubmissionsResponse{
		Items:        items,
		TotalCount:   totalCount,
		Page:         int32(page),
		PageSize:     int32(pageSize),
		Query:        query,
		SelectedId:   respSelectedID,
		SelectedItem: pinned,
	}), nil
}

func (s *adminInboxServiceServer) DeleteContactSubmission(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteContactSubmissionRequest],
) (*connect.Response[adminv1.DeleteContactSubmissionResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), "")
	if err != nil {
		return nil, err
	}
	id := strings.TrimSpace(req.Msg.GetId())
	if !contracts.ValidateUUID(id) {
		return connect.NewResponse(&adminv1.DeleteContactSubmissionResponse{Deleted: false}), nil
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM contact_submissions WHERE id = $1::uuid`, id)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	deleted := tag.RowsAffected() > 0
	if deleted {
		logAdminSeam("DELTA_AUDIT_GAP", "admin_api.inbox.submissions_deleted", map[string]any{
			"actor":         adminSession.Handle,
			"count":         1,
			"correlationId": corrID,
		})
	}
	return connect.NewResponse(&adminv1.DeleteContactSubmissionResponse{Deleted: deleted}), nil
}

func (s *adminInboxServiceServer) DeleteContactSubmissions(
	ctx context.Context,
	req *connect.Request[adminv1.DeleteContactSubmissionsRequest],
) (*connect.Response[adminv1.DeleteContactSubmissionsResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), "")
	if err != nil {
		return nil, err
	}
	seen := make(map[string]struct{})
	validIDs := make([]string, 0, len(req.Msg.GetIds()))
	for _, raw := range req.Msg.GetIds() {
		id := strings.TrimSpace(raw)
		if contracts.ValidateUUID(id) {
			if _, ok := seen[id]; !ok {
				seen[id] = struct{}{}
				validIDs = append(validIDs, id)
			}
		}
	}
	if len(validIDs) == 0 {
		return connect.NewResponse(&adminv1.DeleteContactSubmissionsResponse{DeletedCount: 0}), nil
	}
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM contact_submissions WHERE id = ANY($1::uuid[])`, validIDs)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	count := int32(tag.RowsAffected())
	if count > 0 {
		logAdminSeam("DELTA_AUDIT_GAP", "admin_api.inbox.submissions_deleted", map[string]any{
			"actor":         adminSession.Handle,
			"count":         count,
			"correlationId": corrID,
		})
	}
	return connect.NewResponse(&adminv1.DeleteContactSubmissionsResponse{DeletedCount: count}), nil
}
