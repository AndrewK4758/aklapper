package main

import (
	"context"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const (
	defaultAnalyticsRateLimitMax = 120
	analyticsRateLimitWindow     = 60 * time.Second
)

type analyticsServiceServer struct {
	deps portalServiceDeps
}

var _ portalv1connect.AnalyticsServiceHandler = (*analyticsServiceServer)(nil)

func newAnalyticsServiceServer(deps portalServiceDeps) *analyticsServiceServer {
	return &analyticsServiceServer{deps: deps}
}

func resolveAnalyticsIngestRateLimitMax() int {
	raw := strings.TrimSpace(os.Getenv("ANALYTICS_INGEST_RATE_LIMIT_MAX"))
	if raw == "" {
		return defaultAnalyticsRateLimitMax
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return defaultAnalyticsRateLimitMax
	}
	return parsed
}

func resolveDailySaltForRequest(explicit string) (string, error) {
	return analytics.ResolveDailySaltSecret(explicit)
}

func (s *analyticsServiceServer) IngestAnalytics(
	ctx context.Context,
	req *connect.Request[portalv1.IngestAnalyticsRequest],
) (*connect.Response[portalv1.IngestAnalyticsResponse], error) {
	corrID := resolveCorrID(ctx)
	clientIP, err := grpckit.ExtractSignedClientIP(req.Header(), s.deps.explicitSecret)
	if err != nil {
		return nil, err
	}

	if valErr := analytics.ValidateBatchBounds(req.Msg); valErr != nil {
		logPortalSeam("BOUNDARY_FAULT", "analytics.ingest.payload_rejected", map[string]any{
			"correlationId": corrID,
			"reason":        valErr.Error(),
		})
		return nil, newPortalError(
			connect.CodeInvalidArgument,
			contracts.ErrCodeValidation,
			http.StatusBadRequest,
			"Invalid analytics payload.",
			"Review event metadata limits and retry.",
			corrID,
			nil,
			nil,
		)
	}

	baseSalt, saltErr := resolveDailySaltForRequest(s.deps.explicitDailySalt)
	if saltErr != nil {
		return nil, newPortalError(
			connect.CodeInternal,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
			nil,
		)
	}

	now := s.deps.now()
	daySalt := analytics.BuildDailySalt(baseSalt, now)
	ipHash := analytics.HashVisitorIP(clientIP, daySalt)

	rlDecision, rlErr := s.deps.store.ConsumePortalRateLimit(
		ctx,
		"analytics:ip:"+ipHash,
		resolveAnalyticsIngestRateLimitMax(),
		analyticsRateLimitWindow,
	)
	if rlErr != nil {
		return nil, mapStoreErrorToConnect(rlErr, corrID)
	}
	if !rlDecision.Allowed {
		logPortalSeam("RULE_DIVERGENCE", "analytics.ingest.rate_limit_branch", map[string]any{
			"branch":        "rate_limited_429",
			"correlationId": corrID,
		})
		retrySec := int32(rlDecision.RetryAfterSeconds)
		return nil, newPortalError(
			connect.CodeResourceExhausted,
			contracts.ErrCodeRateLimited,
			http.StatusTooManyRequests,
			"Too many analytics requests. Slow down and retry shortly.",
			"Wait briefly before sending more analytics batches.",
			corrID,
			nil,
			&retrySec,
		)
	}
	logPortalSeam("RULE_DIVERGENCE", "analytics.ingest.rate_limit_branch", map[string]any{
		"branch":        "allowed",
		"correlationId": corrID,
	})

	fallbackLanding := ""
	if len(req.Msg.GetEvents()) > 0 {
		fallbackLanding = req.Msg.GetEvents()[0].GetPath()
	}
	meta := buildPortalAnalyticsMeta(
		clientIP,
		req.Msg.GetClientContext(),
		req.Msg,
		fallbackLanding,
		s.deps.geoReader,
		baseSalt,
		now,
		corrID,
	)
	ingestRes, err := s.deps.store.IngestPortalAnalyticsTx(
		ctx,
		meta,
		protoEventsToStoreInputs(req.Msg.GetEvents()),
		now,
	)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}

	return connect.NewResponse(&portalv1.IngestAnalyticsResponse{
		Accepted:  int32(ingestRes.Accepted),
		SessionId: ingestRes.SessionID,
		IpHash:    ingestRes.IPHash,
	}), nil
}

func (s *analyticsServiceServer) RecordSsrHit(
	ctx context.Context,
	req *connect.Request[portalv1.RecordSsrHitRequest],
) (*connect.Response[portalv1.RecordSsrHitResponse], error) {
	corrID := resolveCorrID(ctx)
	clientIP, err := grpckit.ExtractSignedClientIP(req.Header(), s.deps.explicitSecret)
	if err != nil {
		return nil, err
	}
	baseSalt, saltErr := resolveDailySaltForRequest(s.deps.explicitDailySalt)
	if saltErr != nil {
		return nil, newPortalError(
			connect.CodeInternal,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
			nil,
		)
	}

	now := s.deps.now()
	pathname := analytics.NormalizeLandingPath(req.Msg.GetPathname())
	meta := buildPortalAnalyticsMeta(
		clientIP,
		req.Msg.GetClientContext(),
		nil,
		pathname,
		s.deps.geoReader,
		baseSalt,
		now,
		corrID,
	)
	events := []pg.PortalAnalyticsEventInput{
		{
			Type:      "page_view",
			Name:      "portal_page_view",
			Path:      pathname,
			Metadata:  map[string]any{"navigation": "ssr", "app": "portal"},
			Timestamp: now.Format(time.RFC3339Nano),
		},
	}
	res, err := s.deps.store.IngestPortalAnalyticsTx(ctx, meta, events, now)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	return connect.NewResponse(&portalv1.RecordSsrHitResponse{
		SessionId: res.SessionID,
	}), nil
}

func (s *analyticsServiceServer) BindGuestSession(
	ctx context.Context,
	req *connect.Request[portalv1.BindGuestSessionRequest],
) (*connect.Response[portalv1.BindGuestSessionResponse], error) {
	corrID := resolveCorrID(ctx)
	clientIP, err := grpckit.ExtractSignedClientIP(req.Header(), s.deps.explicitSecret)
	if err != nil {
		return nil, err
	}
	guestID := strings.TrimSpace(req.Msg.GetGuestSessionId())
	if guestID == "" {
		return connect.NewResponse(&portalv1.BindGuestSessionResponse{}), nil
	}
	baseSalt, saltErr := resolveDailySaltForRequest(s.deps.explicitDailySalt)
	if saltErr != nil {
		return nil, newPortalError(
			connect.CodeInternal,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
			nil,
		)
	}

	now := s.deps.now()
	meta := buildPortalAnalyticsMeta(
		clientIP,
		req.Msg.GetClientContext(),
		nil,
		req.Msg.GetLandingPath(),
		s.deps.geoReader,
		baseSalt,
		now,
		corrID,
	)
	meta.GuestSessionID = &guestID

	sessionID, err := s.deps.store.BindPortalGuestSessionTx(ctx, meta, now)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	return connect.NewResponse(&portalv1.BindGuestSessionResponse{
		SessionId: sessionID,
	}), nil
}
