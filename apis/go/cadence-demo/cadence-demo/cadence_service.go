package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const unifiedProxyIPHash = "portal-proxy"

type cadenceServiceDeps struct {
	provider    llm.Provider
	vectorStore *qdrant.Client
	store       *pg.Store
	privacyCfg  *privacy.Config
}

type cadenceServiceError struct {
	HTTPStatus  int
	ConnectCode connect.Code
	Error       contracts.PublicAppError
	Quota       *contracts.QuotaStatus
}

func (e *cadenceServiceError) toConnectError() *connect.Error {
	return grpckit.NewDetailedConnectError(
		e.ConnectCode,
		grpckit.ToProtoPublicError(&e.Error),
		grpckit.ToProtoQuota(e.Quota),
	)
}

func newCadenceError(status int, connectCode connect.Code, appCode, msg, action, corrID string, quota *contracts.QuotaStatus) *cadenceServiceError {
	if corrID == "" {
		corrID = contracts.NewUUIDv4()
	}
	return &cadenceServiceError{
		HTTPStatus:  status,
		ConnectCode: connectCode,
		Error: contracts.PublicAppError{
			Code:          appCode,
			Status:        status,
			Message:       msg,
			Action:        action,
			CorrelationID: corrID,
		},
		Quota: quota,
	}
}

func claimsRoleOrGuest(claims *internalauth.Claims) string {
	if claims != nil && claims.Role == internalauth.RoleAdmin {
		return contracts.RoleAdmin
	}
	return contracts.RoleGuest
}

func resolveAuthorizedSessionClaims(
	claims *internalauth.Claims,
	candidate string,
	requireCandidate bool,
	pathOrRunID string,
	corrID string,
) (string, *cadenceServiceError) {
	trimmed := strings.TrimSpace(candidate)
	if claims != nil && claims.Role == internalauth.RoleAdmin {
		if trimmed == "" {
			trimmed = strings.TrimSpace(claims.Sub)
		}
		return trimmed, nil
	}
	claimSub := ""
	if claims != nil {
		claimSub = strings.TrimSpace(claims.Sub)
	}
	if requireCandidate && trimmed == "" {
		return "", newCadenceError(http.StatusBadRequest, connect.CodeInvalidArgument,
			contracts.ErrCodeValidation, "sessionId is required", "Refresh your session and retry.", corrID, nil)
	}
	if claimSub != "" && trimmed != "" && trimmed != claimSub {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.auth.session_claim_mismatch", "critical", map[string]any{
			"path":          pathOrRunID,
			"correlationId": corrID,
		})
		return "", newCadenceError(http.StatusForbidden, connect.CodePermissionDenied,
			contracts.ErrCodeForbidden, "session id does not match authenticated principal", "Return home or sign in again.", corrID, nil)
	}
	if claimSub != "" {
		return claimSub, nil
	}
	if trimmed != "" {
		return trimmed, nil
	}
	return "", nil
}

func executeListRuns(
	ctx context.Context,
	deps cadenceServiceDeps,
	claims *internalauth.Claims,
	candidateSession string,
	requireCandidate bool,
	limit int,
	corrID string,
) ([]pg.SandboxRun, contracts.QuotaStatus, *cadenceServiceError) {
	role := claimsRoleOrGuest(claims)
	sessionID, authErr := resolveAuthorizedSessionClaims(
		claims,
		candidateSession,
		requireCandidate && role != contracts.RoleAdmin,
		"/v1/cadence/runs",
		corrID,
	)
	if authErr != nil {
		return nil, contracts.QuotaStatus{}, authErr
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	runs, err := deps.store.ListSandboxRuns(ctx, sessionID, limit)
	if err != nil {
		return nil, contracts.QuotaStatus{}, newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to list sandbox runs", "Retry or share the reference ID.", corrID, nil)
	}
	quota, _ := deps.store.GetQuotaStatus(ctx, role, sessionID)
	return runs, quota, nil
}

func executeApproveSpecGate(
	ctx context.Context,
	deps cadenceServiceDeps,
	claims *internalauth.Claims,
	runID string,
	candidateSession string,
	corrID string,
) (*pg.SandboxRun, contracts.CadenceRunResult, contracts.QuotaStatus, *cadenceServiceError) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return nil, contracts.CadenceRunResult{}, contracts.QuotaStatus{}, newCadenceError(
			http.StatusBadRequest, connect.CodeInvalidArgument, contracts.ErrCodeValidation,
			"missing run id", "Verify the run ID and retry.", corrID, nil)
	}
	if strings.TrimSpace(candidateSession) == "" && (claims == nil || strings.TrimSpace(claims.Sub) == "") {
		return nil, contracts.CadenceRunResult{}, contracts.QuotaStatus{}, newCadenceError(
			http.StatusUnauthorized, connect.CodeUnauthenticated, contracts.ErrCodeUnauthorized,
			"missing X-Session-Id header", "Refresh your session and retry.", corrID, nil)
	}
	sessionID, authErr := resolveAuthorizedSessionClaims(claims, candidateSession, false, runID, corrID)
	if authErr != nil {
		return nil, contracts.CadenceRunResult{}, contracts.QuotaStatus{}, authErr
	}

	updated, err := deps.store.ApproveSandboxRunSpecForSession(ctx, runID, sessionID)
	if err != nil {
		return nil, contracts.CadenceRunResult{}, contracts.QuotaStatus{}, mapSpecGateStoreError(err, corrID)
	}

	pct := 55
	queuedStatus := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     contracts.CadenceStatusRunning,
		Label:     "Spec approved · queuing CHORD build",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}
	role := claimsRoleOrGuest(claims)
	quota, _ := deps.store.GetQuotaStatus(ctx, role, sessionID)
	contractRun := pg.SandboxRunToContractResult(updated, &quota, &queuedStatus, contracts.FormatOSC7501(queuedStatus))
	return updated, contractRun, quota, nil
}

func mapSpecGateStoreError(err error, corrID string) *cadenceServiceError {
	switch {
	case errors.Is(err, pg.ErrGoldenRunImmutable):
		return newCadenceError(http.StatusConflict, connect.CodeFailedPrecondition,
			contracts.ErrCodeConstraint, err.Error(), "Create a new run to customize.", corrID, nil)
	case errors.Is(err, pg.ErrRunNotFound):
		return newCadenceError(http.StatusNotFound, connect.CodeNotFound,
			contracts.ErrCodeNotFound, err.Error(), "Verify the run ID or start a new run.", corrID, nil)
	case errors.Is(err, pg.ErrForbiddenSession):
		return newCadenceError(http.StatusForbidden, connect.CodePermissionDenied,
			contracts.ErrCodeForbidden, err.Error(), "Return home or sign in again.", corrID, nil)
	case errors.Is(err, pg.ErrRunNotAwaitingApproval):
		return newCadenceError(http.StatusConflict, connect.CodeFailedPrecondition,
			contracts.ErrCodeConstraint, err.Error(), "Refresh the workbench state.", corrID, nil)
	default:
		return newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to approve spec gate", "Retry or share the reference ID.", corrID, nil)
	}
}

func executeSubmitGateVerdict(
	ctx context.Context,
	deps cadenceServiceDeps,
	claims *internalauth.Claims,
	runID string,
	candidateSession string,
	verdict string,
	corrID string,
) (*pg.SandboxRun, contracts.CadenceRunResult, *cadenceServiceError) {
	runID = strings.TrimSpace(runID)
	if runID == "" {
		return nil, contracts.CadenceRunResult{}, newCadenceError(
			http.StatusBadRequest, connect.CodeInvalidArgument, contracts.ErrCodeValidation,
			"missing run id", "Verify the run ID and retry.", corrID, nil)
	}
	if strings.TrimSpace(candidateSession) == "" && (claims == nil || strings.TrimSpace(claims.Sub) == "") {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
			"runId":         runID,
			"reason":        "missing_session",
			"correlationId": corrID,
		})
		return nil, contracts.CadenceRunResult{}, newCadenceError(
			http.StatusUnauthorized, connect.CodeUnauthenticated, contracts.ErrCodeUnauthorized,
			"missing X-Session-Id header", "Refresh your session and retry.", corrID, nil)
	}
	sessionID, authErr := resolveAuthorizedSessionClaims(claims, candidateSession, false, runID, corrID)
	if authErr != nil {
		return nil, contracts.CadenceRunResult{}, authErr
	}

	updated, err := deps.store.UpdateSandboxGateVerdictForSession(ctx, runID, sessionID, strings.TrimSpace(verdict))
	if err != nil {
		return nil, contracts.CadenceRunResult{}, mapGateVerdictStoreError(err, runID, corrID)
	}

	readyStatus, osc := buildReadyStatus()
	contractRun := pg.SandboxRunToContractResult(updated, nil, &readyStatus, osc)
	return updated, contractRun, nil
}

func mapGateVerdictStoreError(err error, runID, corrID string) *cadenceServiceError {
	switch {
	case errors.Is(err, pg.ErrInvalidVerdict):
		return newCadenceError(http.StatusBadRequest, connect.CodeInvalidArgument,
			contracts.ErrCodeValidation, err.Error(), "Choose approved or rejected and retry.", corrID, nil)
	case errors.Is(err, pg.ErrGoldenRunImmutable):
		logCadenceSeam("UNSOUND_CONDITION", "cadence.gate.golden_mutation_blocked", "critical", map[string]any{
			"runId":         runID,
			"correlationId": corrID,
		})
		return newCadenceError(http.StatusConflict, connect.CodeFailedPrecondition,
			contracts.ErrCodeConstraint, err.Error(), "Golden showcases are read-only.", corrID, nil)
	case errors.Is(err, pg.ErrRunNotFound):
		return newCadenceError(http.StatusNotFound, connect.CodeNotFound,
			contracts.ErrCodeNotFound, err.Error(), "Verify the run ID or start a new run.", corrID, nil)
	case errors.Is(err, pg.ErrForbiddenSession):
		logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
			"runId":         runID,
			"reason":        "gate_session_mismatch",
			"correlationId": corrID,
		})
		return newCadenceError(http.StatusForbidden, connect.CodePermissionDenied,
			contracts.ErrCodeForbidden, err.Error(), "Return home or sign in again.", corrID, nil)
	case errors.Is(err, pg.ErrRunNotReady):
		return newCadenceError(http.StatusConflict, connect.CodeFailedPrecondition,
			contracts.ErrCodeConstraint, err.Error(), "Wait for the run to complete and retry.", corrID, nil)
	default:
		return newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to update gate verdict", "Retry or share the reference ID.", corrID, nil)
	}
}
