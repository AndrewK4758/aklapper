package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
)

func (s *adminAuthServiceServer) BeginPasskeyRegister(
	ctx context.Context,
	req *connect.Request[adminv1.BeginPasskeyRegisterRequest],
) (*connect.Response[adminv1.BeginPasskeyRegisterResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), req.Msg.GetSessionId())
	if err != nil {
		return nil, err
	}
	user, err := s.deps.getUserByID(ctx, adminSession.UserID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if user == nil || user.Role != "admin" {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNAUTHORIZED", http.StatusUnauthorized, "Valid admin session required", "Sign in first.", corrID, nil)
	}
	existing, err := s.deps.listUserWebauthnCredentials(ctx, user.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	challenge, optionsJSON, err := beginPasskeyRegistration(*user, existing, req.Msg.GetOrigin(), corrID)
	if errors.Is(err, ErrWebAuthnOriginRejected) {
		return nil, newAdminError(connect.CodeInvalidArgument, "PASSKEY_ORIGIN_REJECTED", http.StatusBadRequest, "WebAuthn origin rejected.", "Use the canonical admin origin.", corrID, nil)
	}
	if err != nil {
		return nil, newAdminError(connect.CodeInternal, "PASSKEY_OPTIONS_FAILED", http.StatusInternalServerError, "Failed to initialize passkey registration.", "Retry shortly.", corrID, nil)
	}
	challengeID, err := s.deps.createWebauthnChallenge(ctx, challenge, &user.ID, "register", challengeTTL)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.BeginPasskeyRegisterResponse{
		ChallengeId: challengeID,
		OptionsJson: optionsJSON,
	}), nil
}

func (s *adminAuthServiceServer) FinishPasskeyRegister(
	ctx context.Context,
	req *connect.Request[adminv1.FinishPasskeyRegisterRequest],
) (*connect.Response[adminv1.FinishPasskeyRegisterResponse], error) {
	corrID := resolveCorrID(ctx)
	adminSession, err := s.deps.requireAdminAuth(ctx, req.Header(), req.Msg.GetSessionId())
	if err != nil {
		return nil, err
	}
	challengeRow, err := s.deps.consumeWebauthnChallenge(ctx, strings.TrimSpace(req.Msg.GetChallengeId()), "register")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if challengeRow == nil || challengeRow.UserID == nil {
		logAdminSeam("UNSOUND_CONDITION", "admin_api.auth.challenge_invalid", map[string]any{"kind": "register", "reason": "missing_or_consumed", "correlationId": corrID})
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_OR_EXPIRED_CHALLENGE", http.StatusBadRequest, "Registration challenge is invalid, expired, or already used", "Restart passkey registration.", corrID, nil)
	}
	if *challengeRow.UserID != adminSession.UserID {
		logAdminSeam("UNSOUND_CONDITION", "admin_api.auth.challenge_invalid", map[string]any{"kind": "register", "reason": "user_mismatch", "correlationId": corrID})
		return nil, newAdminError(connect.CodePermissionDenied, "FORBIDDEN", http.StatusForbidden, "Registration challenge does not match authenticated admin", "Restart passkey registration.", corrID, nil)
	}
	user, err := s.deps.getUserByID(ctx, adminSession.UserID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if user == nil || user.Role != "admin" {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNAUTHORIZED", http.StatusUnauthorized, "Valid admin session required", "Sign in first.", corrID, nil)
	}
	verified, err := finishPasskeyRegistration(*user, challengeRow.Challenge, req.Msg.GetOrigin(), req.Msg.GetCredentialJson(), corrID)
	if errors.Is(err, ErrWebAuthnOriginRejected) {
		return nil, newAdminError(connect.CodeInvalidArgument, "PASSKEY_ORIGIN_REJECTED", http.StatusBadRequest, "WebAuthn origin rejected.", "Use the canonical admin origin.", corrID, nil)
	}
	if err != nil {
		return nil, newAdminError(connect.CodeInvalidArgument, "PASSKEY_VERIFICATION_FAILED", http.StatusBadRequest, "Passkey registration verification failed.", "Retry passkey enrollment.", corrID, nil)
	}
	be, bs := verified.BackupEligible, verified.BackupState
	if err := s.deps.saveWebauthnCredential(ctx, webauthnCredentialRecord{
		CredentialID:   verified.CredentialID,
		UserID:         adminSession.UserID,
		PublicKey:      verified.PublicKeyB64,
		Counter:        verified.Counter,
		Transports:     verified.Transports,
		BackupEligible: &be,
		BackupState:    &bs,
	}); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	logAdminSeam("DELTA_AUDIT_GAP", "admin_api.auth.credential_mutated", map[string]any{
		"mutation":      "passkey_registered",
		"actor":         adminSession.Handle,
		"credentialId":  verified.CredentialID,
		"correlationId": corrID,
	})
	return connect.NewResponse(&adminv1.FinishPasskeyRegisterResponse{
		Verified:     true,
		CredentialId: verified.CredentialID,
		Session:      toProtoAdminSession(*adminSession),
	}), nil
}

func (s *adminAuthServiceServer) BeginPasskeyLogin(
	ctx context.Context,
	req *connect.Request[adminv1.BeginPasskeyLoginRequest],
) (*connect.Response[adminv1.BeginPasskeyLoginResponse], error) {
	corrID := resolveCorrID(ctx)
	if err := requirePreAuthServiceOrAdminCaller(ctx, corrID); err != nil {
		return nil, err
	}
	var user *authUserRecord
	var creds []webauthnCredentialRecord
	if req.Msg.Handle != nil && strings.TrimSpace(*req.Msg.Handle) != "" {
		u, err := s.deps.findAdminUserByHandle(ctx, *req.Msg.Handle)
		if err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		if u != nil && u.Role == "admin" {
			user = u
			creds, err = s.deps.listUserWebauthnCredentials(ctx, u.ID)
			if err != nil {
				return nil, mapAdminStoreError(err, corrID)
			}
		}
	}
	challenge, optionsJSON, err := beginPasskeyLogin(user, creds, req.Msg.GetOrigin(), corrID)
	if errors.Is(err, ErrWebAuthnOriginRejected) {
		return nil, newAdminError(connect.CodeInvalidArgument, "PASSKEY_ORIGIN_REJECTED", http.StatusBadRequest, "WebAuthn origin rejected.", "Use the canonical admin origin.", corrID, nil)
	}
	if err != nil {
		return nil, newAdminError(connect.CodeInternal, "PASSKEY_OPTIONS_FAILED", http.StatusInternalServerError, "Failed to initialize passkey login.", "Retry shortly.", corrID, nil)
	}
	var userIDPtr *string
	if user != nil {
		userIDPtr = &user.ID
	}
	challengeID, err := s.deps.createWebauthnChallenge(ctx, challenge, userIDPtr, "login", challengeTTL)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.BeginPasskeyLoginResponse{
		ChallengeId: challengeID,
		OptionsJson: optionsJSON,
	}), nil
}

func (s *adminAuthServiceServer) FinishPasskeyLogin(
	ctx context.Context,
	req *connect.Request[adminv1.FinishPasskeyLoginRequest],
) (*connect.Response[adminv1.FinishPasskeyLoginResponse], error) {
	corrID := resolveCorrID(ctx)
	if err := requirePreAuthServiceOrAdminCaller(ctx, corrID); err != nil {
		return nil, err
	}
	challengeRow, err := s.deps.consumeWebauthnChallenge(ctx, strings.TrimSpace(req.Msg.GetChallengeId()), "login")
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if challengeRow == nil {
		logAdminSeam("UNSOUND_CONDITION", "admin_api.auth.challenge_invalid", map[string]any{"kind": "login", "reason": "missing_or_consumed", "correlationId": corrID})
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_OR_EXPIRED_CHALLENGE", http.StatusBadRequest, "Login challenge is invalid, expired, or already used", "Restart passkey login.", corrID, nil)
	}

	var envelope struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(req.Msg.GetAssertionJson()), &envelope); err != nil || strings.TrimSpace(envelope.ID) == "" {
		return nil, newAdminError(connect.CodeInvalidArgument, "INVALID_REQUEST", http.StatusBadRequest, "Missing credential id in assertion response", "Retry passkey login.", corrID, nil)
	}
	storedCred, err := s.deps.getWebauthnCredentialByID(ctx, envelope.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if storedCred == nil {
		return nil, newAdminError(connect.CodeUnauthenticated, "UNKNOWN_CREDENTIAL", http.StatusUnauthorized, "Passkey credential is not registered", "Use a registered passkey or password.", corrID, nil)
	}
	if challengeRow.UserID != nil && *challengeRow.UserID != storedCred.UserID {
		return nil, newAdminError(connect.CodeUnauthenticated, "CREDENTIAL_USER_MISMATCH", http.StatusUnauthorized, "Passkey credential does not match the requested admin handle", "Retry passkey login.", corrID, nil)
	}
	user, err := s.deps.getUserByID(ctx, storedCred.UserID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if user == nil || user.Role != "admin" {
		return nil, newAdminError(connect.CodePermissionDenied, "FORBIDDEN", http.StatusForbidden, "Admin role required", "Sign in with an admin account.", corrID, nil)
	}

	discoverable := challengeRow.UserID == nil
	verified, err := finishPasskeyLogin(*user, *storedCred, challengeRow.Challenge, discoverable, req.Msg.GetOrigin(), req.Msg.GetAssertionJson(), corrID)
	if errors.Is(err, ErrWebAuthnOriginRejected) {
		return nil, newAdminError(connect.CodeInvalidArgument, "PASSKEY_ORIGIN_REJECTED", http.StatusBadRequest, "WebAuthn origin rejected.", "Use the canonical admin origin.", corrID, nil)
	}
	if err != nil {
		return nil, newAdminError(connect.CodeUnauthenticated, "PASSKEY_VERIFICATION_FAILED", http.StatusUnauthorized, "Passkey assertion failed", "Retry passkey login.", corrID, nil)
	}
	if err := s.deps.updateWebauthnCredentialAfterLogin(ctx, storedCred.CredentialID, verified.NewCounter, verified.BackupEligible, verified.BackupState); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}

	totpRec, err := s.deps.getUserTotpSecret(ctx, user.ID)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if totpRec != nil && totpRec.Enabled {
		inlineCode := strings.TrimSpace(req.Msg.GetTotpCode())
		if inlineCode == "" {
			pendingToken, tokErr := IssuePendingTotpToken(user.ID, s.deps.adminSecret, s.deps.now())
			if tokErr != nil {
				return nil, newAdminError(connect.CodeInternal, "AUTH_MISCONFIGURED", http.StatusInternalServerError, "Authentication service is missing required server configuration.", "Contact operator.", corrID, nil)
			}
			return connect.NewResponse(&adminv1.FinishPasskeyLoginResponse{
				Verified:     false,
				RequiresTotp: true,
				PendingToken: pendingToken,
			}), nil
		}

		// Enforce identical auth:totp:ip and auth:totp:user rate limits on inline passkey totpCode.
		clientIP, ipErr := resolveClientIP(req.Header(), req.Msg.GetClientIp(), s.deps.adminSecret)
		if ipErr != nil {
			return nil, ipErr
		}
		if err := s.enforceTotpRateLimits(ctx, clientIP, user.ID, corrID); err != nil {
			return nil, err
		}
		okTotp, totpErr := s.verifyTotpOrAtomicBackupCode(ctx, user.ID, user.Handle, *totpRec, inlineCode, corrID)
		if totpErr != nil {
			return nil, mapAdminStoreError(totpErr, corrID)
		}
		if !okTotp {
			return nil, newAdminError(connect.CodeUnauthenticated, "INVALID_TOTP_CODE", http.StatusUnauthorized, "Invalid TOTP or backup code", "Check authenticator code and retry.", corrID, nil)
		}
	}

	session, err := s.deps.createAdminSession(ctx, user.ID, user.Handle, adminSessionTTL)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	return connect.NewResponse(&adminv1.FinishPasskeyLoginResponse{
		Verified:     true,
		RequiresTotp: false,
		Session:      toProtoAdminSession(session),
	}), nil
}
