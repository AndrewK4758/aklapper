package main

import (
	"context"
	"net/http"
	"os"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
)

func (s *adminAuthServiceServer) EnrollTotp(
	ctx context.Context,
	req *connect.Request[adminv1.EnrollTotpRequest],
) (*connect.Response[adminv1.EnrollTotpResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.getValidAdminSession(ctx, strings.TrimSpace(req.Msg.GetSessionId()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if adminSession == nil || adminSession.Role != "admin" || adminSession.UserID == "" {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNAUTHORIZED", http.StatusUnauthorized, "Admin session required", "Sign in first.", corrID, nil)
	}
	secret, err := GenerateTotpSecret()
	if err != nil {
		return nil, newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Failed to generate TOTP secret.", "Retry shortly.", corrID, nil)
	}
	encrypted, err := EncryptTotpSecret(secret, s.deps.totpKey)
	if err != nil {
		return nil, newAdminError(connect.CodeInternal, "AUTH_MISCONFIGURED", http.StatusInternalServerError, "TOTP encryption unavailable.", "Check server configuration.", corrID, nil)
	}
	backupCodes, err := GenerateBackupCodes(8)
	if err != nil {
		return nil, newAdminError(connect.CodeInternal, contracts.ErrCodeInternal, http.StatusInternalServerError, "Failed to generate backup codes.", "Retry shortly.", corrID, nil)
	}
	hashes := make([]string, len(backupCodes))
	for i, c := range backupCodes {
		hashes[i] = HashBackupCode(c)
	}
	if err := s.deps.upsertUserTotpSecret(ctx, adminSession.UserID, encrypted, hashes, false); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	issuer := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_NAME"))
	return connect.NewResponse(&adminv1.EnrollTotpResponse{
		Secret:      secret,
		OtpauthUrl:  BuildTotpOtpAuthURL(secret, adminSession.Handle, issuer),
		BackupCodes: backupCodes,
	}), nil
}

func (s *adminAuthServiceServer) VerifyTotpStepUp(
	ctx context.Context,
	req *connect.Request[adminv1.VerifyTotpStepUpRequest],
) (*connect.Response[adminv1.VerifyTotpStepUpResponse], error) {
	corrID := resolveCorrID(ctx)
	code := strings.TrimSpace(req.Msg.GetCode())
	if code == "" || containsNul(code) {
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_REQUEST", http.StatusBadRequest, "TOTP verification code is required", "Enter a 6-digit code or backup code.", corrID, nil)
	}
	clientIP, ipErr := resolveClientIP(req.Header(), req.Msg.GetClientIp(), s.deps.adminSecret)
	if ipErr != nil {
		return nil, ipErr
	}
	userID, ok := VerifyPendingTotpToken(req.Msg.GetPendingToken(), s.deps.adminSecret, s.deps.now())
	if !ok {
		if err := s.enforceTotpRateLimits(ctx, clientIP, "", corrID); err != nil {
			return nil, err
		}
		return nil, newAdminError(connect.CodeUnauthenticated, "INVALID_PENDING_TOKEN", http.StatusUnauthorized, "Pending 2FA token is invalid or expired", "Sign in again.", corrID, nil)
	}
	if err := s.enforceTotpRateLimits(ctx, clientIP, userID, corrID); err != nil {
		return nil, err
	}
	user, err := s.deps.getUserByID(ctx, userID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	totpRec, err := s.deps.getUserTotpSecret(ctx, userID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if user == nil || user.Role != "admin" || totpRec == nil || !totpRec.Enabled {
		return nil, newAdminError(connect.CodeUnauthenticated, "TOTP_NOT_ENABLED", http.StatusUnauthorized, "TOTP is not active for this account", "Sign in again.", corrID, nil)
	}
	valid, err := s.verifyTotpOrAtomicBackupCode(ctx, user.ID, user.Handle, *totpRec, code, corrID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if !valid {
		return nil, newAdminError(connect.CodeUnauthenticated, "INVALID_TOTP_CODE", http.StatusUnauthorized, "Invalid TOTP or backup code", "Check authenticator code and retry.", corrID, nil)
	}
	session, err := s.deps.createAdminSession(ctx, user.ID, user.Handle, adminSessionTTL)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	passkeyCount, err := s.deps.countUserPasskeys(ctx, user.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.VerifyTotpStepUpResponse{
		Verified:     true,
		PasskeyCount: int32(passkeyCount),
		Session:      toProtoAdminSession(session),
	}), nil
}

func (s *adminAuthServiceServer) ConfirmTotpEnrollment(
	ctx context.Context,
	req *connect.Request[adminv1.ConfirmTotpEnrollmentRequest],
) (*connect.Response[adminv1.ConfirmTotpEnrollmentResponse], error) {
	corrID := resolveCorrID(ctx)
	code := strings.TrimSpace(req.Msg.GetCode())
	if code == "" || containsNul(code) {
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_REQUEST", http.StatusBadRequest, "TOTP verification code is required", "Enter a live 6-digit TOTP code.", corrID, nil)
	}
	clientIP, ipErr := resolveClientIP(req.Header(), req.Msg.GetClientIp(), s.deps.adminSecret)
	if ipErr != nil {
		return nil, ipErr
	}
	adminSession, err := s.deps.getValidAdminSession(ctx, strings.TrimSpace(req.Msg.GetSessionId()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if adminSession == nil || adminSession.Role != "admin" || adminSession.UserID == "" {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNAUTHORIZED", http.StatusUnauthorized, "Admin session or pendingToken required", "Sign in first.", corrID, nil)
	}
	if err := s.enforceTotpRateLimits(ctx, clientIP, adminSession.UserID, corrID); err != nil {
		return nil, err
	}
	totpRec, err := s.deps.getUserTotpSecret(ctx, adminSession.UserID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if totpRec == nil {
		return nil, newAdminError(connect.CodeNotFound, "TOTP_NOT_ENROLLED", http.StatusNotFound, "Enroll TOTP before verifying", "Start TOTP enrollment first.", corrID, nil)
	}
	secret, err := DecryptTotpSecret(totpRec.EncryptedSecret, s.deps.totpKey)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	// Enrollment confirmation strictly requires a live 6-digit TOTP code (never backup codes) and mints no new session.
	if !VerifyTotpCode(secret, code, s.deps.now()) {
		return nil, newAdminError(connect.CodeUnauthenticated, "INVALID_TOTP_CODE", http.StatusUnauthorized, "Invalid TOTP verification code", "Enter the current 6-digit authenticator code.", corrID, nil)
	}
	if err := s.deps.enableUserTotpSecret(ctx, adminSession.UserID); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	logAdminSeam("DELTA_AUDIT_GAP", "admin_api.auth.credential_mutated", map[string]any{
		"mutation":      "totp_enabled",
		"actor":         adminSession.Handle,
		"correlationId": corrID,
	})
	return connect.NewResponse(&adminv1.ConfirmTotpEnrollmentResponse{
		Verified: true,
		Enabled:  true,
	}), nil
}

func (s *adminAuthServiceServer) DisableTotp(
	ctx context.Context,
	req *connect.Request[adminv1.DisableTotpRequest],
) (*connect.Response[adminv1.DisableTotpResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.getValidAdminSession(ctx, strings.TrimSpace(req.Msg.GetSessionId()))
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if adminSession == nil || adminSession.Role != "admin" || adminSession.UserID == "" {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNAUTHORIZED", http.StatusUnauthorized, "Admin session required", "Sign in first.", corrID, nil)
	}
	if err := s.deps.disableUserTotpSecret(ctx, adminSession.UserID); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	logAdminSeam("DELTA_AUDIT_GAP", "admin_api.auth.credential_mutated", map[string]any{
		"mutation":      "totp_disabled",
		"actor":         adminSession.Handle,
		"correlationId": corrID,
	})
	return connect.NewResponse(&adminv1.DisableTotpResponse{Disabled: true}), nil
}
