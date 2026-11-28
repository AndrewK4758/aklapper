package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strconv"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"golang.org/x/crypto/argon2"
)

const (
	argon2DefaultMemoryKiB   = 19456
	argon2DefaultPasses      = 2
	argon2DefaultParallelism = 1
	argon2DefaultSaltBytes   = 16
	argon2DefaultHashBytes   = 32

	argon2MinMemoryKiB   = 4096
	argon2MaxMemoryKiB   = 65536
	argon2MinPasses      = 1
	argon2MaxPasses      = 16
	argon2MinParallelism = 1
	argon2MaxParallelism = 4
	argon2MinSaltBytes   = 16
	argon2MaxSaltBytes   = 64
	argon2MinHashBytes   = 16
	argon2MaxHashBytes   = 64
	argon2MaxPasswordLen = 1024
	maxConcurrentArgon2  = 2

	devFallbackTotpEncryptionKey = "aklapper-dev-totp-encryption-key-do-not-use-in-prod"
	totpCipherVersion            = "v1"
)

var (
	ErrArgon2Busy        = errors.New("password verification service is busy")
	ErrTotpKeyMissing    = errors.New("TOTP_ENCRYPTION_KEY is required in production")
	ErrInvalidTotpCipher = errors.New("invalid encrypted TOTP secret format")

	unpaddedStdBase64Re = regexp.MustCompile(`^[A-Za-z0-9+/]+$`)
	phcParamsRe         = regexp.MustCompile(`^m=(\d+),t=(\d+),p=(\d+)$`)
	dummyArgon2Salt     = []byte{0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a}
	dummyArgon2Password = []byte("aklapper-constant-time-dummy-argon2id-check")
)

type ParsedArgon2idPHC struct {
	Memory      uint32
	Passes      uint32
	Parallelism uint8
	Salt        []byte
	Hash        []byte
}

// Argon2Verifier enforces bounded concurrency (MAX=2) and constant-parameter dummy verification.
type Argon2Verifier struct {
	sem chan struct{}
}

func NewArgon2Verifier(limit int) *Argon2Verifier {
	if limit < 1 {
		limit = maxConcurrentArgon2
	}
	return &Argon2Verifier{sem: make(chan struct{}, limit)}
}

func decodeStrictUnpaddedStdBase64(segment string) ([]byte, bool) {
	if segment == "" || !unpaddedStdBase64Re.MatchString(segment) || len(segment)%4 == 1 {
		return nil, false
	}
	decoded, err := base64.RawStdEncoding.DecodeString(segment)
	if err != nil {
		return nil, false
	}
	if base64.RawStdEncoding.EncodeToString(decoded) != segment {
		return nil, false
	}
	return decoded, true
}

// ParseArgon2idPHC strictly parses Node-compatible standard-Base64 Argon2id PHC strings within RFC 9106 bounds.
func ParseArgon2idPHC(phc string) (*ParsedArgon2idPHC, bool) {
	if len(phc) == 0 || len(phc) > 512 {
		return nil, false
	}
	parts := strings.Split(phc, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != "argon2id" || parts[2] != "v=19" {
		return nil, false
	}
	m := phcParamsRe.FindStringSubmatch(parts[3])
	if len(m) != 4 {
		return nil, false
	}
	mem, err1 := strconv.Atoi(m[1])
	passes, err2 := strconv.Atoi(m[2])
	par, err3 := strconv.Atoi(m[3])
	if err1 != nil || err2 != nil || err3 != nil ||
		mem < argon2MinMemoryKiB || mem > argon2MaxMemoryKiB ||
		passes < argon2MinPasses || passes > argon2MaxPasses ||
		par < argon2MinParallelism || par > argon2MaxParallelism {
		return nil, false
	}
	salt, okSalt := decodeStrictUnpaddedStdBase64(parts[4])
	hash, okHash := decodeStrictUnpaddedStdBase64(parts[5])
	if !okSalt || !okHash ||
		len(salt) < argon2MinSaltBytes || len(salt) > argon2MaxSaltBytes ||
		len(hash) < argon2MinHashBytes || len(hash) > argon2MaxHashBytes {
		return nil, false
	}
	return &ParsedArgon2idPHC{
		Memory:      uint32(mem),
		Passes:      uint32(passes),
		Parallelism: uint8(par),
		Salt:        salt,
		Hash:        hash,
	}, true
}

// HashPasswordArgon2id produces a Node-compatible standard-Base64 Argon2id PHC string.
func HashPasswordArgon2id(password string) (string, error) {
	if len(password) == 0 || len(password) > argon2MaxPasswordLen {
		return "", errors.New("password length out of bounds")
	}
	salt := make([]byte, argon2DefaultSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	derived := argon2.IDKey(
		[]byte(password),
		salt,
		argon2DefaultPasses,
		argon2DefaultMemoryKiB,
		argon2DefaultParallelism,
		argon2DefaultHashBytes,
	)
	return fmt.Sprintf(
		"$argon2id$v=19$m=%d,t=%d,p=%d$%s$%s",
		argon2DefaultMemoryKiB,
		argon2DefaultPasses,
		argon2DefaultParallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(derived),
	), nil
}

// Verify checks password against encodedPHC under the MAX=2 semaphore, executing a constant-parameter
// dummy Argon2id derivation whenever the input or stored hash is empty or malformed.
func (v *Argon2Verifier) Verify(ctx context.Context, password string, encodedPHC *string) (bool, error) {
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return false, err
		}
	}
	select {
	case v.sem <- struct{}{}:
		defer func() { <-v.sem }()
	default:
		return false, ErrArgon2Busy
	}
	if ctx != nil {
		if err := ctx.Err(); err != nil {
			return false, err
		}
	}

	validInput := len(password) > 0 && len(password) <= argon2MaxPasswordLen
	var parsed *ParsedArgon2idPHC
	if encodedPHC != nil {
		parsed, _ = ParseArgon2idPHC(*encodedPHC)
	}
	if !validInput || parsed == nil {
		_ = argon2.IDKey(
			dummyArgon2Password,
			dummyArgon2Salt,
			argon2DefaultPasses,
			argon2DefaultMemoryKiB,
			argon2DefaultParallelism,
			argon2DefaultHashBytes,
		)
		return false, nil
	}

	derived := argon2.IDKey(
		[]byte(password),
		parsed.Salt,
		parsed.Passes,
		parsed.Memory,
		parsed.Parallelism,
		uint32(len(parsed.Hash)),
	)
	return subtle.ConstantTimeCompare(derived, parsed.Hash) == 1, nil
}

// ResolveTotpEncryptionKey derives the 32-byte AES-256 key via SHA-256(trimmed material).
func ResolveTotpEncryptionKey(explicitKey string) ([]byte, error) {
	material := strings.TrimSpace(explicitKey)
	if material == "" {
		material = strings.TrimSpace(os.Getenv("TOTP_ENCRYPTION_KEY"))
	}
	if material == "" && !internalauth.IsProductionEnv() {
		material = devFallbackTotpEncryptionKey
	}
	if material == "" {
		return nil, ErrTotpKeyMissing
	}
	sum := sha256.Sum256([]byte(material))
	return sum[:], nil
}

// EncryptTotpSecret encodes plaintext into Node-compatible v1.<12B-iv-b64url>.<16B-tag-b64url>.<ct-b64url>.
func EncryptTotpSecret(plaintext, explicitKey string) (string, error) {
	key, err := ResolveTotpEncryptionKey(explicitKey)
	if err != nil {
		return "", err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	iv := make([]byte, 12)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}
	sealed := gcm.Seal(nil, iv, []byte(plaintext), nil)
	if len(sealed) < 16 {
		return "", ErrInvalidTotpCipher
	}
	ct := sealed[:len(sealed)-16]
	tag := sealed[len(sealed)-16:]
	return strings.Join([]string{
		totpCipherVersion,
		base64.RawURLEncoding.EncodeToString(iv),
		base64.RawURLEncoding.EncodeToString(tag),
		base64.RawURLEncoding.EncodeToString(ct),
	}, "."), nil
}

// DecryptTotpSecret decrypts Node-compatible v1.<iv>.<tag>.<ct> AES-256-GCM payloads by reassembling ct || tag.
func DecryptTotpSecret(ciphertext, explicitKey string) (string, error) {
	key, err := ResolveTotpEncryptionKey(explicitKey)
	if err != nil {
		return "", err
	}
	parts := strings.Split(ciphertext, ".")
	if len(parts) != 4 || parts[0] != totpCipherVersion {
		return "", ErrInvalidTotpCipher
	}
	iv, err1 := base64.RawURLEncoding.DecodeString(parts[1])
	tag, err2 := base64.RawURLEncoding.DecodeString(parts[2])
	ct, err3 := base64.RawURLEncoding.DecodeString(parts[3])
	if err1 != nil || err2 != nil || err3 != nil || len(iv) != 12 || len(tag) != 16 {
		return "", ErrInvalidTotpCipher
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}
	combined := make([]byte, 0, len(ct)+len(tag))
	combined = append(combined, ct...)
	combined = append(combined, tag...)
	plain, err := gcm.Open(nil, iv, combined, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
