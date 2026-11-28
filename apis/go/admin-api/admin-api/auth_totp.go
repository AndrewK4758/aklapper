package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

const (
	pendingTotpPrefix = "totp-pending:"
	pendingTotpTTL    = 300 * time.Second
)

var (
	totpDigitsOnlyRe = regexp.MustCompile(`^\d+$`)
	backupStripRe    = regexp.MustCompile(`[\s-]+`)
)

func GenerateTotpSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf), nil
}

func BuildTotpOtpAuthURL(secret, accountName, issuer string) string {
	if strings.TrimSpace(issuer) == "" {
		issuer = "andrew-k.us Admin"
	}
	label := url.PathEscape(issuer) + ":" + url.PathEscape(accountName)
	q := url.Values{}
	q.Set("secret", secret)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", "6")
	q.Set("period", "30")
	return "otpauth://totp/" + label + "?" + q.Encode()
}

func ComputeTotpCode(secretBase32 string, at time.Time) (string, error) {
	cleaned := strings.ToUpper(backupStripRe.ReplaceAllString(strings.ReplaceAll(secretBase32, "=", ""), ""))
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(cleaned)
	if err != nil {
		return "", err
	}
	counter := uint64(at.UTC().Unix() / 30)
	var counterBuf [8]byte
	binary.BigEndian.PutUint64(counterBuf[:], counter)
	mac := hmac.New(sha1.New, key)
	_, _ = mac.Write(counterBuf[:])
	digest := mac.Sum(nil)
	offset := digest[len(digest)-1] & 0x0f
	binaryCode := (uint32(digest[offset]&0x7f) << 24) |
		(uint32(digest[offset+1]) << 16) |
		(uint32(digest[offset+2]) << 8) |
		uint32(digest[offset+3])
	return fmt.Sprintf("%06d", binaryCode%1_000_000), nil
}

func VerifyTotpCode(secretBase32, code string, now time.Time) bool {
	normalized := backupStripRe.ReplaceAllString(code, "")
	if len(normalized) != 6 || !totpDigitsOnlyRe.MatchString(normalized) {
		return false
	}
	candidate := []byte(normalized)
	for step := -1; step <= 1; step++ {
		expected, err := ComputeTotpCode(secretBase32, now.Add(time.Duration(step)*30*time.Second))
		if err != nil {
			return false
		}
		if subtle.ConstantTimeCompare(candidate, []byte(expected)) == 1 {
			return true
		}
	}
	return false
}

func GenerateBackupCodes(count int) ([]string, error) {
	if count <= 0 {
		count = 8
	}
	codes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		var buf [4]byte
		if _, err := rand.Read(buf[:]); err != nil {
			return nil, err
		}
		hx := strings.ToUpper(hex.EncodeToString(buf[:]))
		codes = append(codes, hx[:4]+"-"+hx[4:])
	}
	return codes, nil
}

func NormalizeBackupCode(code string) string {
	return backupStripRe.ReplaceAllString(strings.ToUpper(strings.TrimSpace(code)), "")
}

func HashBackupCode(code string) string {
	sum := sha256.Sum256([]byte(NormalizeBackupCode(code)))
	return hex.EncodeToString(sum[:])
}

func MatchBackupCodeHash(code string, hashes []string) (string, bool) {
	norm := NormalizeBackupCode(code)
	if norm == "" {
		return "", false
	}
	cand := []byte(HashBackupCode(norm))
	matched := ""
	for _, h := range hashes {
		if len(h) == len(cand) && subtle.ConstantTimeCompare([]byte(h), cand) == 1 {
			matched = h
		}
	}
	return matched, matched != ""
}

func IssuePendingTotpToken(userID, adminSecret string, now time.Time) (string, error) {
	return internalauth.SignWithClock(internalauth.RoleService, pendingTotpPrefix+userID, now, pendingTotpTTL, adminSecret)
}

func VerifyPendingTotpToken(token, adminSecret string, now time.Time) (string, bool) {
	claims, err := internalauth.VerifyAt(token, adminSecret, now)
	if err != nil || claims == nil || claims.Role != internalauth.RoleService || !strings.HasPrefix(claims.Sub, pendingTotpPrefix) {
		return "", false
	}
	userID := strings.TrimSpace(strings.TrimPrefix(claims.Sub, pendingTotpPrefix))
	if userID == "" {
		return "", false
	}
	return userID, true
}
