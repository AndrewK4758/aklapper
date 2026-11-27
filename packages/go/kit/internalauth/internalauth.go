package internalauth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	HeaderName = "X-Internal-Auth"
	Version    = "v1"

	RoleAdmin   = "admin"
	RoleGuest   = "guest"
	RoleService = "service"

	// DevFallbackSecret is used ONLY when neither NODE_ENV nor APP_ENV is "production"
	// and INTERNAL_AUTH_SECRET is unset. Production always fails closed.
	DevFallbackSecret = "aklapper-dev-internal-auth-secret-do-not-use-in-prod"

	// DevFallbackAdminSecret is used ONLY outside production when ADMIN_INTERNAL_AUTH_SECRET is unset.
	DevFallbackAdminSecret = "aklapper-dev-admin-internal-auth-secret-do-not-use-in-prod"

	clockSkewToleranceSeconds = int64(30)
)

var (
	ErrMissingSecret      = errors.New("INTERNAL_AUTH_SECRET is required in production")
	ErrMissingAdminSecret = errors.New("ADMIN_INTERNAL_AUTH_SECRET is required in production")
	ErrInvalidToken       = errors.New("invalid internal auth token")
	ErrInvalidSignature   = errors.New("invalid internal auth signature")
	ErrExpiredToken       = errors.New("internal auth token expired")
	ErrInvalidRole        = errors.New("invalid internal auth role")
	ErrInvalidSubject     = errors.New("internal auth subject must be non-empty")
)

type Claims struct {
	Role string `json:"role"`
	Sub  string `json:"sub"`
	Iat  int64  `json:"iat"`
	Exp  int64  `json:"exp"`
}

func isValidRole(role string) bool {
	return role == RoleAdmin || role == RoleGuest || role == RoleService
}

func isProductionEnv() bool {
	return strings.EqualFold(strings.TrimSpace(os.Getenv("NODE_ENV")), "production") ||
		strings.EqualFold(strings.TrimSpace(os.Getenv("APP_ENV")), "production")
}

// IsProductionEnv returns true when either NODE_ENV or APP_ENV is "production"
// (case-insensitive, trimmed).
func IsProductionEnv() bool {
	return isProductionEnv()
}

// ResolveSecret returns explicitSecret if non-empty, otherwise INTERNAL_AUTH_SECRET,
// otherwise DevFallbackSecret ONLY outside production.
func ResolveSecret(explicitSecret string) (string, error) {
	if s := strings.TrimSpace(explicitSecret); s != "" {
		return s, nil
	}
	if s := strings.TrimSpace(os.Getenv("INTERNAL_AUTH_SECRET")); s != "" {
		return s, nil
	}
	if !isProductionEnv() {
		return DevFallbackSecret, nil
	}
	_, _ = fmt.Fprintln(os.Stderr, `{"event":"k8s.internalauth.prod_secret_missing","seam":"UNSOUND_CONDITION"}`)
	return "", ErrMissingSecret
}

// ResolveAdminSecret returns explicitSecret if non-empty, otherwise ADMIN_INTERNAL_AUTH_SECRET,
// otherwise DevFallbackAdminSecret ONLY outside production.
func ResolveAdminSecret(explicitSecret string) (string, error) {
	if s := strings.TrimSpace(explicitSecret); s != "" {
		return s, nil
	}
	if s := strings.TrimSpace(os.Getenv("ADMIN_INTERNAL_AUTH_SECRET")); s != "" {
		return s, nil
	}
	if !isProductionEnv() {
		return DevFallbackAdminSecret, nil
	}
	return "", ErrMissingAdminSecret
}

// SignWithClock creates a signed v1.<base64url(payload)>.<base64url(hmac)> token
// using the exact format implemented by @aklapper/node-runtime/http.
func SignWithClock(role, subject string, now time.Time, ttl time.Duration, secret string) (string, error) {
	if !isValidRole(role) {
		return "", ErrInvalidRole
	}
	sub := strings.TrimSpace(subject)
	if sub == "" {
		return "", ErrInvalidSubject
	}
	resolvedSecret, err := ResolveSecret(secret)
	if err != nil {
		return "", err
	}
	ttlSecs := int64(ttl.Seconds())
	if ttlSecs < 1 {
		ttlSecs = 1
	}
	iat := now.Unix()
	claims := Claims{
		Role: role,
		Sub:  sub,
		Iat:  iat,
		Exp:  iat + ttlSecs,
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadBytes)
	signingInput := Version + "." + payloadB64

	mac := hmac.New(sha256.New, []byte(resolvedSecret))
	_, _ = mac.Write([]byte(signingInput))
	sigB64 := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return signingInput + "." + sigB64, nil
}

// Sign creates a signed internal auth token valid for ttl from time.Now().
func Sign(role, subject string, ttl time.Duration, secret string) (string, error) {
	return SignWithClock(role, subject, time.Now().UTC(), ttl, secret)
}

// VerifyAt validates token signature, structure, and expiry against now.
func VerifyAt(token, secret string, now time.Time) (*Claims, error) {
	trimmed := strings.TrimSpace(token)
	if trimmed == "" {
		return nil, ErrInvalidToken
	}
	resolvedSecret, err := ResolveSecret(secret)
	if err != nil {
		return nil, err
	}

	parts := strings.Split(trimmed, ".")
	if len(parts) != 3 || parts[0] != Version || parts[1] == "" || parts[2] == "" {
		return nil, ErrInvalidToken
	}

	signingInput := parts[0] + "." + parts[1]
	actualSig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return nil, ErrInvalidToken
	}

	mac := hmac.New(sha256.New, []byte(resolvedSecret))
	_, _ = mac.Write([]byte(signingInput))
	expectedSig := mac.Sum(nil)
	if !hmac.Equal(actualSig, expectedSig) {
		return nil, ErrInvalidSignature
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims Claims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, ErrInvalidToken
	}
	if !isValidRole(claims.Role) || strings.TrimSpace(claims.Sub) == "" {
		return nil, ErrInvalidToken
	}

	nowSec := now.Unix()
	if claims.Exp <= nowSec {
		return nil, ErrExpiredToken
	}
	if claims.Iat > nowSec+clockSkewToleranceSeconds {
		return nil, ErrInvalidToken
	}

	return &claims, nil
}

// Verify validates token using the current UTC time.
func Verify(token, secret string) (*Claims, error) {
	return VerifyAt(token, secret, time.Now().UTC())
}

// VerifyRequest extracts and verifies the single X-Internal-Auth header on an HTTP request,
// failing closed with ErrInvalidToken when zero or multiple headers are present.
func VerifyRequest(r *http.Request) (*Claims, error) {
	if r == nil {
		return nil, ErrInvalidToken
	}
	vals := r.Header.Values(HeaderName)
	if len(vals) != 1 {
		return nil, ErrInvalidToken
	}
	return Verify(vals[0], "")
}

// IsAdminRequest returns true strictly when r carries a valid signed X-Internal-Auth
// token with role == "admin".
func IsAdminRequest(r *http.Request) bool {
	claims, err := VerifyRequest(r)
	return err == nil && claims != nil && claims.Role == RoleAdmin
}
