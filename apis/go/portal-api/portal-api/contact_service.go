package main

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
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
	defaultContactRateLimitMax = 20
	contactRateLimitWindow     = 60 * time.Second
)

type contactServiceServer struct {
	deps portalServiceDeps
}

var _ portalv1connect.ContactServiceHandler = (*contactServiceServer)(nil)

func newContactServiceServer(deps portalServiceDeps) *contactServiceServer {
	return &contactServiceServer{deps: deps}
}

func resolveContactRateLimitMax() int {
	raw := strings.TrimSpace(os.Getenv("CONTACT_RATE_LIMIT_MAX"))
	if raw == "" {
		return defaultContactRateLimitMax
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return defaultContactRateLimitMax
	}
	return parsed
}

func buildContactRateLimitScopeKey(clientIP string) string {
	sum := sha256.Sum256([]byte(clientIP))
	return "contact:ip:" + hex.EncodeToString(sum[:])[:32]
}

func (s *contactServiceServer) SubmitContact(
	ctx context.Context,
	req *connect.Request[portalv1.SubmitContactRequest],
) (*connect.Response[portalv1.SubmitContactResponse], error) {
	corrID := resolveCorrID(ctx)
	clientIP, err := grpckit.ExtractSignedClientIP(req.Header(), s.deps.explicitSecret)
	if err != nil {
		return nil, err
	}

	rlDecision, rlErr := s.deps.store.ConsumePortalRateLimit(
		ctx,
		buildContactRateLimitScopeKey(clientIP),
		resolveContactRateLimitMax(),
		contactRateLimitWindow,
	)
	if rlErr != nil {
		return nil, mapStoreErrorToConnect(rlErr, corrID)
	}
	if !rlDecision.Allowed {
		retrySec := int32(rlDecision.RetryAfterSeconds)
		return nil, newPortalError(
			connect.CodeResourceExhausted,
			contracts.ErrCodeRateLimited,
			http.StatusTooManyRequests,
			"Too many contact submissions from this address. Please wait a minute and retry.",
			"Wait a moment and submit again.",
			corrID,
			nil,
			&retrySec,
		)
	}

	contactJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-contact")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	formDef := parseContactFormDefinition(contactJSON)

	validated, fieldErrors := validateContactRequest(formDef, req.Msg)
	if len(fieldErrors) > 0 {
		return nil, newPortalError(
			connect.CodeInvalidArgument,
			contracts.ErrCodeValidation,
			http.StatusBadRequest,
			"Server validation rejected the transmission. Fix the highlighted fields.",
			"Review highlighted fields and retry.",
			corrID,
			fieldErrors,
			nil,
		)
	}

	var sizePtr *int32
	var shaPtr *string
	var b64Ptr *string
	if validated.AttachmentName != nil && len(validated.AttachmentBytes) > 0 {
		sz := int32(len(validated.AttachmentBytes))
		sizePtr = &sz
		digest := sha256.Sum256(validated.AttachmentBytes)
		shaHex := hex.EncodeToString(digest[:])
		shaPtr = &shaHex
		encoded := base64.StdEncoding.EncodeToString(validated.AttachmentBytes)
		b64Ptr = &encoded
	}

	now := s.deps.now()
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

	fallbackMeta := buildPortalAnalyticsMeta(
		clientIP,
		req.Msg.GetClientContext(),
		nil,
		"/contact",
		s.deps.geoReader,
		baseSalt,
		now,
		corrID,
	)
	priorIPHash := ""
	priorVisitorHash := ""
	if analytics.IsWithinUtcMidnightGraceWindow(now, 0) {
		priorSalt := analytics.BuildPreviousUtcDaySalt(baseSalt, now)
		priorIPHash = analytics.HashVisitorIP(clientIP, priorSalt)
		ua := ""
		if req.Msg.GetClientContext() != nil {
			ua = req.Msg.GetClientContext().GetUserAgent()
		}
		priorVisitorHash = analytics.HashVisitorIdentity(clientIP, ua, priorSalt)
	}

	guestID := ""
	if req.Msg.GetClientContext() != nil {
		guestID = strings.TrimSpace(req.Msg.GetClientContext().GetGuestSessionId())
	}
	linkResult := s.deps.store.ResolveOrCreateContactSession(ctx, pg.ContactLinkParams{
		CandidateSessionID: req.Msg.GetCandidateAnalyticsSessionId(),
		GuestSessionID:     guestID,
		CurrentIPHash:      fallbackMeta.IPHash,
		CurrentVisitorHash: fallbackMeta.VisitorHash,
		PriorIPHash:        priorIPHash,
		PriorVisitorHash:   priorVisitorHash,
		FallbackMeta:       fallbackMeta,
		CorrelationID:      corrID,
		Now:                now,
	})

	summary, fkFallbackUsed, insertErr := s.deps.store.InsertContactSubmissionNoReturning(ctx, pg.ContactSubmissionInsertInput{
		Name:                    validated.Name,
		Phone:                   validated.Phone,
		Email:                   validated.Email,
		Message:                 validated.Message,
		AttachmentName:          validated.AttachmentName,
		AttachmentMimeType:      validated.AttachmentMimeType,
		AttachmentSizeBytes:     sizePtr,
		AttachmentSHA256:        shaPtr,
		AttachmentContentBase64: b64Ptr,
		AnalyticsSessionID:      linkResult.AnalyticsSessionID,
		GuestSessionID:          linkResult.GuestSessionID,
	})
	if insertErr != nil {
		var constraintErr *pg.ContactConstraintError
		if errors.As(insertErr, &constraintErr) && constraintErr != nil {
			return nil, newPortalError(
				connect.CodeFailedPrecondition,
				contracts.ErrCodeConstraint,
				http.StatusUnprocessableEntity,
				constraintErr.Message,
				"Check highlighted fields and retry.",
				corrID,
				constraintErr.FieldErrors,
				nil,
			)
		}
		return nil, mapStoreErrorToConnect(insertErr, corrID)
	}

	finalizeContactAnalyticsLink(ctx, s.deps.store, summary.ID, linkResult, fkFallbackUsed, corrID, now)

	return connect.NewResponse(&portalv1.SubmitContactResponse{
		Submission: toProtoContactSummary(summary),
	}), nil
}

func finalizeContactAnalyticsLink(
	ctx context.Context,
	store *pg.Store,
	submissionID string,
	linkResult pg.ContactLinkResult,
	fkFallbackUsed bool,
	corrID string,
	now time.Time,
) {
	effectiveAnalyticsID := linkResult.AnalyticsSessionID
	effectiveLinkMethod := linkResult.LinkMethod
	if fkFallbackUsed {
		logPortalSeam("BOUNDARY_FAULT", "portal.contact.analytics_link_failed", map[string]any{
			"correlationId": corrID,
			"reason":        "fk_23503_retry_null",
		})
		effectiveAnalyticsID = nil
		effectiveLinkMethod = pg.LinkMethodFailOpenNull
	}
	if effectiveAnalyticsID != nil {
		store.RecordContactSubmittedEvent(ctx, *effectiveAnalyticsID, now)
	}

	logPortalSeam("DELTA_AUDIT_GAP", "portal.contact.analytics_link_committed", map[string]any{
		"submissionId":         submissionID,
		"linkMethod":           effectiveLinkMethod,
		"linkedSessionPresent": effectiveAnalyticsID != nil,
		"guestSessionLinked":   linkResult.GuestSessionID != nil,
		"correlationId":        corrID,
	})
}
