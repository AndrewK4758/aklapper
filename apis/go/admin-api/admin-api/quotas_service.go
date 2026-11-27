package main

import (
	"context"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
)

type adminQuotasServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminQuotasServiceHandler = (*adminQuotasServiceServer)(nil)

func newAdminQuotasServiceServer(deps adminServiceDeps) *adminQuotasServiceServer {
	return &adminQuotasServiceServer{deps: deps}
}

func (s *adminQuotasServiceServer) ListQuotasAndBuckets(
	ctx context.Context,
	req *connect.Request[adminv1.ListQuotasAndBucketsRequest],
) (*connect.Response[adminv1.ListQuotasAndBucketsResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	pool := s.deps.store.Pool()

	pRows, err := pool.Query(ctx, `SELECT role, max_turns_per_session, max_tokens_per_run, max_daily_global_tokens FROM quota_policies ORDER BY role ASC`)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer pRows.Close()
	policies := make([]*adminv1.QuotaPolicyRecord, 0)
	for pRows.Next() {
		var rec adminv1.QuotaPolicyRecord
		if err := pRows.Scan(&rec.Role, &rec.MaxTurnsPerSession, &rec.MaxTokensPerRun, &rec.MaxDailyGlobalTokens); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		policies = append(policies, &rec)
	}
	if err := pRows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	bRows, err := pool.Query(ctx, `SELECT scope_key, window_start, turns_used, tokens_used FROM rate_limit_buckets ORDER BY window_start DESC, scope_key ASC LIMIT 200`)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer bRows.Close()
	buckets := make([]*adminv1.RateLimitBucketRecord, 0)
	for bRows.Next() {
		var b adminv1.RateLimitBucketRecord
		var ws time.Time
		if err := bRows.Scan(&b.ScopeKey, &ws, &b.TurnsUsed, &b.TokensUsed); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		b.WindowStart = formatRFC3339Millis(ws)
		buckets = append(buckets, &b)
	}
	if err := bRows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.ListQuotasAndBucketsResponse{
		Policies: policies,
		Buckets:  buckets,
	}), nil
}

func (s *adminQuotasServiceServer) UpdateQuotaPolicy(
	ctx context.Context,
	req *connect.Request[adminv1.UpdateQuotaPolicyRequest],
) (*connect.Response[adminv1.UpdateQuotaPolicyResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	role := strings.TrimSpace(req.Msg.GetRole())
	if (role != "guest" && role != "admin") ||
		req.Msg.GetMaxTurnsPerSession() < 1 || req.Msg.GetMaxTurnsPerSession() > 10000 ||
		req.Msg.GetMaxTokensPerRun() < 256 || req.Msg.GetMaxTokensPerRun() > 1000000 ||
		req.Msg.GetMaxDailyGlobalTokens() < 1000 || req.Msg.GetMaxDailyGlobalTokens() > 100000000 {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Quota policy bounds are invalid.", "Provide valid role and positive quota bounds.", corrID, nil)
	}

	var out adminv1.QuotaPolicyRecord
	err := s.deps.store.Pool().QueryRow(
		ctx,
		`INSERT INTO quota_policies (role, max_turns_per_session, max_tokens_per_run, max_daily_global_tokens)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (role) DO UPDATE SET
		   max_turns_per_session = EXCLUDED.max_turns_per_session,
		   max_tokens_per_run = EXCLUDED.max_tokens_per_run,
		   max_daily_global_tokens = EXCLUDED.max_daily_global_tokens
		 RETURNING role, max_turns_per_session, max_tokens_per_run, max_daily_global_tokens`,
		role, req.Msg.GetMaxTurnsPerSession(), req.Msg.GetMaxTokensPerRun(), req.Msg.GetMaxDailyGlobalTokens(),
	).Scan(&out.Role, &out.MaxTurnsPerSession, &out.MaxTokensPerRun, &out.MaxDailyGlobalTokens)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.UpdateQuotaPolicyResponse{Policy: &out}), nil
}

func (s *adminQuotasServiceServer) ResetRateLimitBucket(
	ctx context.Context,
	req *connect.Request[adminv1.ResetRateLimitBucketRequest],
) (*connect.Response[adminv1.ResetRateLimitBucketResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	scopeKey := strings.TrimSpace(req.Msg.GetScopeKey())
	if scopeKey == "" || len(scopeKey) > 256 || containsNul(scopeKey) {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Rate limit scopeKey is required.", "Select a valid bucket.", corrID, nil)
	}
	tag, err := s.deps.store.Pool().Exec(
		ctx,
		`UPDATE rate_limit_buckets SET turns_used = 0, tokens_used = 0, window_start = NOW() WHERE scope_key = $1`,
		scopeKey,
	)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.ResetRateLimitBucketResponse{Reset_: tag.RowsAffected() > 0}), nil
}

func (s *adminQuotasServiceServer) PurgeStaleRateLimitBuckets(
	ctx context.Context,
	req *connect.Request[adminv1.PurgeStaleRateLimitBucketsRequest],
) (*connect.Response[adminv1.PurgeStaleRateLimitBucketsResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	hours := int(req.Msg.GetOlderThanHours())
	if hours <= 0 {
		hours = 24
	}
	if hours > 24*365 {
		hours = 24 * 365
	}
	cutoff := s.deps.now().UTC().Add(-time.Duration(hours) * time.Hour)
	tag, err := s.deps.store.Pool().Exec(ctx, `DELETE FROM rate_limit_buckets WHERE window_start <= $1`, cutoff)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.PurgeStaleRateLimitBucketsResponse{PurgedCount: int32(tag.RowsAffected())}), nil
}
