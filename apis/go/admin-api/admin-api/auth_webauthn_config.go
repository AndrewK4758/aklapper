package main

import (
	"encoding/base64"
	"errors"
	"net/url"
	"os"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

var (
	ErrWebAuthnOriginRejected = errors.New("WebAuthn origin is not in configured allowlist")
	ErrWebAuthnVerifyFailed   = errors.New("WebAuthn verification failed")
)

type webAuthnConfigResolved struct {
	RPName          string
	RPID            string
	ExpectedOrigins []string
}

type adminWebAuthnUser struct {
	ID          string
	Handle      string
	Credentials []webauthn.Credential
}

func (u adminWebAuthnUser) WebAuthnID() []byte                         { return []byte(u.ID) }
func (u adminWebAuthnUser) WebAuthnName() string                       { return u.Handle }
func (u adminWebAuthnUser) WebAuthnDisplayName() string                { return u.Handle }
func (u adminWebAuthnUser) WebAuthnCredentials() []webauthn.Credential { return u.Credentials }

type verifiedRegistrationOutput struct {
	CredentialID   string
	PublicKeyB64   string
	Counter        int
	Transports     []string
	BackupEligible bool
	BackupState    bool
}

type verifiedLoginOutput struct {
	NewCounter     int
	BackupEligible bool
	BackupState    bool
	LegacyHydrated bool
}

func resolveWebAuthnConfig(originHeader, corrID string) (webAuthnConfigResolved, error) {
	rpName := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_NAME"))
	if rpName == "" {
		rpName = "andrew-k.us Admin"
	}
	rpID := strings.TrimSpace(os.Getenv("WEBAUTHN_RP_ID"))
	if rpID == "" {
		rpID = "localhost"
	}
	rawOrigins := strings.TrimSpace(os.Getenv("WEBAUTHN_ORIGIN"))
	if rawOrigins == "" {
		rawOrigins = "http://localhost:4201"
	}

	originSet := make(map[string]struct{})
	origins := make([]string, 0, 4)
	addOrigin := func(o string) {
		trimmed := strings.TrimRight(strings.TrimSpace(o), "/")
		if trimmed == "" {
			return
		}
		if _, dup := originSet[trimmed]; dup {
			return
		}
		originSet[trimmed] = struct{}{}
		origins = append(origins, trimmed)
	}
	for _, part := range strings.Split(rawOrigins, ",") {
		addOrigin(part)
	}

	reqOrigin := strings.TrimRight(strings.TrimSpace(originHeader), "/")
	if reqOrigin != "" {
		if internalauth.IsProductionEnv() {
			if _, ok := originSet[reqOrigin]; !ok {
				logAdminSeam("UNSOUND_CONDITION", "admin_api.auth.origin_rejected", map[string]any{
					"origin":        reqOrigin,
					"correlationId": corrID,
				})
				return webAuthnConfigResolved{}, ErrWebAuthnOriginRejected
			}
		} else {
			if parsed, err := url.Parse(reqOrigin); err == nil {
				host := parsed.Hostname()
				if (host == rpID || strings.HasSuffix(host, "."+rpID)) && (parsed.Scheme == "http" || parsed.Scheme == "https") {
					addOrigin(parsed.Scheme + "://" + parsed.Host)
				}
			}
		}
	}

	return webAuthnConfigResolved{
		RPName:          rpName,
		RPID:            rpID,
		ExpectedOrigins: origins,
	}, nil
}

func newWebAuthnInstance(cfg webAuthnConfigResolved) (*webauthn.WebAuthn, error) {
	return webauthn.New(&webauthn.Config{
		RPID:          cfg.RPID,
		RPDisplayName: cfg.RPName,
		RPOrigins:     cfg.ExpectedOrigins,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			ResidentKey:      protocol.ResidentKeyRequirementRequired,
			UserVerification: protocol.VerificationPreferred,
		},
		AttestationPreference: protocol.PreferNoAttestation,
	})
}

func toProtocolTransports(transports []string) []protocol.AuthenticatorTransport {
	out := make([]protocol.AuthenticatorTransport, 0, len(transports))
	for _, t := range transports {
		if trimmed := strings.TrimSpace(t); trimmed != "" {
			out = append(out, protocol.AuthenticatorTransport(trimmed))
		}
	}
	return out
}

func hydrateWebAuthnCredential(
	stored webauthnCredentialRecord,
	assertionFlags *protocol.AuthenticatorFlags,
) (webauthn.Credential, bool, error) {
	credIDBytes, err := base64.RawURLEncoding.DecodeString(stored.CredentialID)
	if err != nil {
		return webauthn.Credential{}, false, err
	}
	pubKeyBytes, err := base64.RawURLEncoding.DecodeString(stored.PublicKey)
	if err != nil {
		return webauthn.Credential{}, false, err
	}

	legacyHydrated := stored.BackupEligible == nil || stored.BackupState == nil
	var rawFlags protocol.AuthenticatorFlags = protocol.FlagUserPresent
	if legacyHydrated {
		if assertionFlags != nil {
			if assertionFlags.HasBackupEligible() {
				rawFlags |= protocol.FlagBackupEligible
			}
			if assertionFlags.HasBackupState() {
				rawFlags |= protocol.FlagBackupState
			}
		}
	} else {
		if *stored.BackupEligible {
			rawFlags |= protocol.FlagBackupEligible
		}
		if *stored.BackupState {
			rawFlags |= protocol.FlagBackupState
		}
	}

	return webauthn.Credential{
		ID:        credIDBytes,
		PublicKey: pubKeyBytes,
		Transport: toProtocolTransports(stored.Transports),
		Flags:     webauthn.NewCredentialFlags(rawFlags),
		Authenticator: webauthn.Authenticator{
			SignCount: uint32(max(0, stored.Counter)),
		},
	}, legacyHydrated, nil
}
