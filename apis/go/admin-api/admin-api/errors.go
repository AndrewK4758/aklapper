package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/netip"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	commonv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/common/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/jackc/pgx/v5/pgconn"
)

const (
	headerAdminSessionID = "x-admin-session-id"
	adminChromeSubject   = "admin-ssr-chrome"
)

func logAdminSeam(seamType, event string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func resolveCorrID(ctx context.Context) string {
	if c := grpckit.CorrelationIDFromContext(ctx); c != "" {
		return c
	}
	return contracts.NewUUIDv4()
}

func newAdminError(
	connectCode connect.Code,
	appCode string,
	httpStatus int,
	msg string,
	action string,
	corrID string,
	retryAfterSeconds *int32,
) *connect.Error {
	if corrID == "" {
		corrID = contracts.NewUUIDv4()
	}
	return grpckit.NewDetailedConnectErrorWithRetryAfter(
		connectCode,
		grpckit.ToProtoPublicError(&contracts.PublicAppError{
			Code:          appCode,
			Status:        httpStatus,
			Message:       msg,
			Action:        action,
			CorrelationID: corrID,
		}),
		nil,
		retryAfterSeconds,
	)
}

func newPrivacyConstraintError(findings []privacy.Finding, msg, corrID string) *connect.Error {
	if corrID == "" {
		corrID = contracts.NewUUIDv4()
	}
	if strings.TrimSpace(msg) == "" {
		msg = "Content failed privacy sanitization policy."
	}
	protoFindings := make([]*commonv1.PrivacySanitizationFinding, 0, len(findings))
	for _, f := range findings {
		protoFindings = append(protoFindings, &commonv1.PrivacySanitizationFinding{
			RuleId:   f.RuleID,
			Category: f.Category,
			Field:    f.Field,
			Location: f.Location,
		})
	}
	return grpckit.NewDetailedConnectErrorWithFindings(
		connect.CodeFailedPrecondition,
		grpckit.ToProtoPublicError(&contracts.PublicAppError{
			Code:          contracts.ErrCodeConstraint,
			Status:        http.StatusUnprocessableEntity,
			Message:       msg,
			Action:        "Remove sensitive or denylisted terms and retry.",
			CorrelationID: corrID,
		}),
		protoFindings,
	)
}

func mapAdminStoreError(err error, corrID string) *connect.Error {
	if err == nil {
		return nil
	}
	var connectErr *connect.Error
	if errors.As(err, &connectErr) && connectErr != nil {
		return connectErr
	}
	if pe, ok := privacy.AsPolicyError(err); ok {
		return newPrivacyConstraintError(pe.Findings, pe.Error(), corrID)
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr != nil {
		if pgErr.Code == "42501" {
			logAdminSeam("UNSOUND_CONDITION", "admin_api.pg.privilege_violation", map[string]any{
				"sqlState":      pgErr.Code,
				"correlationId": corrID,
			})
			return newAdminError(
				connect.CodePermissionDenied,
				contracts.ErrCodeForbidden,
				http.StatusForbidden,
				"Permission denied for action.",
				"Return home or sign in again.",
				corrID,
				nil,
			)
		}
		if strings.HasPrefix(pgErr.Code, "08") || strings.HasPrefix(pgErr.Code, "57P") || pgErr.Code == "53300" {
			return newAdminError(
				connect.CodeUnavailable,
				contracts.ErrCodeDbUnavailable,
				http.StatusServiceUnavailable,
				"Database temporarily unavailable.",
				"Retry shortly or share ID.",
				corrID,
				nil,
			)
		}
	}
	if errors.Is(err, pg.ErrSiteContentMissing) || errors.Is(err, pg.ErrTerminalProfileMissing) || errors.Is(err, pg.ErrCadencePresetsEmpty) {
		return newAdminError(
			connect.CodeInternal,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
		)
	}
	return newAdminError(
		connect.CodeUnavailable,
		contracts.ErrCodeDbUnavailable,
		http.StatusServiceUnavailable,
		"Database temporarily unavailable.",
		"Retry shortly or share ID.",
		corrID,
		nil,
	)
}

func (d adminServiceDeps) requireAdminAuth(
	ctx context.Context,
	header http.Header,
	reqSessionID string,
) (*adminSessionRecord, error) {
	corrID := resolveCorrID(ctx)
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok {
		return nil, newAdminError(
			connect.CodeUnauthenticated,
			contracts.ErrCodeUnauthorized,
			http.StatusUnauthorized,
			"Verified admin session required.",
			"Sign in to the admin console.",
			corrID,
			nil,
		)
	}
	if claims.Role != internalauth.RoleAdmin {
		return nil, newAdminError(
			connect.CodePermissionDenied,
			contracts.ErrCodeForbidden,
			http.StatusForbidden,
			"Admin role required for this operation.",
			"Sign in with an administrator account.",
			corrID,
			nil,
		)
	}

	sessionID := strings.TrimSpace(reqSessionID)
	if sessionID == "" && header != nil {
		sessionID = strings.TrimSpace(header.Get(headerAdminSessionID))
	}
	if sessionID == "" && strings.HasPrefix(claims.Sub, "admin-session:") {
		sessionID = strings.TrimSpace(strings.TrimPrefix(claims.Sub, "admin-session:"))
	}
	if sessionID == "" || !contracts.ValidateUUID(sessionID) {
		return nil, newAdminError(
			connect.CodeUnauthenticated,
			contracts.ErrCodeUnauthorized,
			http.StatusUnauthorized,
			"Verified admin session required.",
			"Sign in to the admin console.",
			corrID,
			nil,
		)
	}
	rec, err := d.getValidAdminSession(ctx, sessionID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if rec == nil || rec.Role != "admin" || rec.UserID == "" {
		return nil, newAdminError(
			connect.CodeUnauthenticated,
			contracts.ErrCodeUnauthorized,
			http.StatusUnauthorized,
			"Verified admin session required.",
			"Sign in to the admin console.",
			corrID,
			nil,
		)
	}
	return rec, nil
}

func resolveClientIP(header http.Header, fallbackIP, adminSecret string) (string, error) {
	if header != nil && len(header.Values(grpckit.MetadataInternalClientIP)) > 0 {
		ip, err := grpckit.ExtractSignedClientIP(header, adminSecret)
		if err != nil {
			return "", err
		}
		return ip, nil
	}
	trimmed := strings.TrimSpace(fallbackIP)
	if trimmed != "" {
		if addr, err := netip.ParseAddr(trimmed); err == nil && addr.IsValid() {
			return addr.Unmap().String(), nil
		}
		return trimmed, nil
	}
	return "unknown", nil
}

func containsNul(s string) bool {
	return strings.IndexByte(s, 0) >= 0
}

func formatRFC3339Millis(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func optionalRFC3339Millis(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := formatRFC3339Millis(*t)
	return &s
}

func optString(s *string) *string {
	if s == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*s)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
