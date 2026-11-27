package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
)

const (
	adminSessionTTL   = 12 * time.Hour
	challengeTTL      = 5 * time.Minute
	loginIPMax        = 20
	loginIPWindow     = time.Minute
	loginHandleMax    = 10
	loginHandleWindow = 5 * time.Minute
	totpIPMax         = 20
	totpIPWindow      = time.Minute
	totpUserMax       = 10
	totpUserWindow    = 5 * time.Minute
)

type adminAuthServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminAuthServiceHandler = (*adminAuthServiceServer)(nil)

func newAdminAuthServiceServer(deps adminServiceDeps) *adminAuthServiceServer {
	return &adminAuthServiceServer{deps: deps}
}

func toProtoAdminSession(s adminSessionRecord) *adminv1.AdminSession {
	return &adminv1.AdminSession{
		SessionId: s.SessionID,
		Role:      s.Role,
		Handle:    s.Handle,
		ExpiresAt: formatRFC3339Millis(s.ExpiresAt),
	}
}

func hashRateLimitPart(val string) string {
	sum := sha256.Sum256([]byte(val))
	return hex.EncodeToString(sum[:])
}

func rateLimitConnectError(retryAfter int, corrID string) *connect.Error {
	sec := int32(max(1, retryAfter))
	return newAdminError(
		connect.CodeResourceExhausted,
		"RATE_LIMITED",
		http.StatusTooManyRequests,
		"Too many authentication attempts. Retry later.",
		"Wait before retrying authentication.",
		corrID,
		&sec,
	)
}

func (s *adminAuthServiceServer) enforceTotpRateLimits(ctx context.Context, clientIP, userID, corrID string) error {
	ipLimit, err := s.deps.store.ConsumePortalRateLimit(ctx, "auth:totp:ip:"+hashRateLimitPart(clientIP), totpIPMax, totpIPWindow)
	if err != nil {
		return mapAdminStoreError(err, corrID)
	}
	if !ipLimit.Allowed {
		return rateLimitConnectError(ipLimit.RetryAfterSeconds, corrID)
	}
	if userID != "" {
		userLimit, err := s.deps.store.ConsumePortalRateLimit(ctx, "auth:totp:user:"+userID, totpUserMax, totpUserWindow)
		if err != nil {
			return mapAdminStoreError(err, corrID)
		}
		if !userLimit.Allowed {
			return rateLimitConnectError(userLimit.RetryAfterSeconds, corrID)
		}
	}
	return nil
}

func (s *adminAuthServiceServer) verifyTotpOrAtomicBackupCode(
	ctx context.Context,
	userID, actorHandle string,
	totpRec totpSecretRecord,
	code, corrID string,
) (bool, error) {
	secret, err := DecryptTotpSecret(totpRec.EncryptedSecret, s.deps.totpKey)
	if err != nil {
		return false, err
	}
	if VerifyTotpCode(secret, code, s.deps.now()) {
		return true, nil
	}
	matchedHash, ok := MatchBackupCodeHash(code, totpRec.BackupCodesHash)
	if !ok {
		return false, nil
	}
	consumed, err := s.deps.consumeTotpBackupCode(ctx, userID, matchedHash)
	if err != nil {
		return false, err
	}
	if consumed {
		logAdminSeam("DELTA_AUDIT_GAP", "admin_api.auth.credential_mutated", map[string]any{
			"mutation":      "totp_backup_code_consumed",
			"actor":         actorHandle,
			"correlationId": corrID,
		})
	}
	return consumed, nil
}

func (s *adminAuthServiceServer) GetAdminSession(
	ctx context.Context,
	req *connect.Request[adminv1.GetAdminSessionRequest],
) (*connect.Response[adminv1.GetAdminSessionResponse], error) {
	corrID := resolveCorrID(ctx)
	sessionID := strings.TrimSpace(req.Msg.GetSessionId())
	if sessionID == "" || !contracts.ValidateUUID(sessionID) {
		return connect.NewResponse(&adminv1.GetAdminSessionResponse{Authenticated: false}), nil
	}
	rec, err := s.deps.getValidAdminSession(ctx, sessionID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if rec == nil || rec.Role != "admin" {
		return connect.NewResponse(&adminv1.GetAdminSessionResponse{Authenticated: false}), nil
	}
	return connect.NewResponse(&adminv1.GetAdminSessionResponse{
		Authenticated: true,
		Session:       toProtoAdminSession(*rec),
		TotpEnabled:   rec.TotpEnabled,
		PasskeyCount:  int32(rec.PasskeyCount),
	}), nil
}

func (s *adminAuthServiceServer) PasswordLogin(
	ctx context.Context,
	req *connect.Request[adminv1.PasswordLoginRequest],
) (*connect.Response[adminv1.PasswordLoginResponse], error) {
	corrID := resolveCorrID(ctx)
	handle := strings.ToLower(strings.TrimSpace(req.Msg.GetHandle()))
	password := req.Msg.GetPassword()
	if handle == "" || len(handle) > 64 || len(password) == 0 || len(password) > argon2MaxPasswordLen || containsNul(handle) || containsNul(password) {
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_REQUEST", http.StatusBadRequest, "Handle and password are required", "Enter handle and password.", corrID, nil)
	}

	clientIP, ipErr := resolveClientIP(req.Header(), req.Msg.GetClientIp(), s.deps.adminSecret)
	if ipErr != nil {
		return nil, ipErr
	}

	ipLimit, err := s.deps.store.ConsumePortalRateLimit(ctx, "auth:login:ip:"+hashRateLimitPart(clientIP), loginIPMax, loginIPWindow)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if !ipLimit.Allowed {
		logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "rate_limited", "correlationId": corrID})
		return nil, rateLimitConnectError(ipLimit.RetryAfterSeconds, corrID)
	}

	handleLimit, err := s.deps.store.ConsumePortalRateLimit(ctx, "auth:login:handle:"+hashRateLimitPart(handle), loginHandleMax, loginHandleWindow)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if !handleLimit.Allowed {
		logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "rate_limited", "correlationId": corrID})
		return nil, rateLimitConnectError(handleLimit.RetryAfterSeconds, corrID)
	}

	user, err := s.deps.findAdminUserByHandle(ctx, handle)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	var storedHash *string
	if user != nil && user.Role == "admin" {
		storedHash = user.PasswordHashArgon2
	}

	valid, verifyErr := s.deps.argon2.Verify(password, storedHash)
	if errors.Is(verifyErr, ErrArgon2Busy) {
		logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "concurrency_saturated", "correlationId": corrID})
		retry := int32(2)
		return nil, newAdminError(connect.CodeUnavailable, "SERVICE_BUSY", http.StatusServiceUnavailable, "Authentication service is temporarily busy. Please retry.", "Retry in 2 seconds.", corrID, &retry)
	}
	if verifyErr != nil {
		return nil, mapAdminStoreError(verifyErr, corrID)
	}
	if !valid || user == nil || user.Role != "admin" {
		logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "invalid_credentials", "correlationId": corrID})
		return nil, newAdminError(connect.CodeUnauthenticated, "INVALID_CREDENTIALS", http.StatusUnauthorized, "Invalid credentials", "Verify handle and password.", corrID, nil)
	}

	totpRec, err := s.deps.getUserTotpSecret(ctx, user.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if totpRec != nil && totpRec.Enabled {
		pendingToken, tokErr := IssuePendingTotpToken(user.ID, s.deps.adminSecret, s.deps.now())
		if tokErr != nil {
			logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "misconfigured", "correlationId": corrID})
			return nil, newAdminError(connect.CodeInternal, "AUTH_MISCONFIGURED", http.StatusInternalServerError, "Authentication service is missing required server configuration.", "Contact operator.", corrID, nil)
		}
		logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "requires_totp", "correlationId": corrID})
		return connect.NewResponse(&adminv1.PasswordLoginResponse{
			Verified:     false,
			RequiresTotp: true,
			PendingToken: pendingToken,
		}), nil
	}

	session, err := s.deps.createAdminSession(ctx, user.ID, user.Handle, adminSessionTTL)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	passkeyCount, err := s.deps.countUserPasskeys(ctx, user.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.password_login_branch", map[string]any{"branch": "authenticated", "correlationId": corrID})
	return connect.NewResponse(&adminv1.PasswordLoginResponse{
		Verified:     true,
		RequiresTotp: false,
		Session:      toProtoAdminSession(session),
		PasskeyCount: int32(passkeyCount),
	}), nil
}

func (s *adminAuthServiceServer) LogoutAdminSession(
	ctx context.Context,
	req *connect.Request[adminv1.LogoutAdminSessionRequest],
) (*connect.Response[adminv1.LogoutAdminSessionResponse], error) {
	corrID := resolveCorrID(ctx)
	if err := s.deps.revokeAuthSession(ctx, strings.TrimSpace(req.Msg.GetSessionId())); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.LogoutAdminSessionResponse{LoggedOut: true}), nil
}
