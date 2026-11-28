package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
)

func beginPasskeyRegistration(
	user authUserRecord,
	existing []webauthnCredentialRecord,
	origin string,
	corrID string,
) (string, string, error) {
	cfg, err := resolveWebAuthnConfig(origin, corrID)
	if err != nil {
		return "", "", err
	}
	wa, err := newWebAuthnInstance(cfg)
	if err != nil {
		return "", "", err
	}

	exclusions := make([]protocol.CredentialDescriptor, 0, len(existing))
	for _, c := range existing {
		rawID, decErr := base64.RawURLEncoding.DecodeString(c.CredentialID)
		if decErr != nil {
			continue
		}
		exclusions = append(exclusions, protocol.CredentialDescriptor{
			Type:         protocol.PublicKeyCredentialType,
			CredentialID: protocol.URLEncodedBase64(rawID),
			Transport:    toProtocolTransports(c.Transports),
		})
	}

	reqResident := true
	creation, session, err := wa.BeginRegistration(
		adminWebAuthnUser{ID: user.ID, Handle: user.Handle},
		webauthn.WithAuthenticatorSelection(protocol.AuthenticatorSelection{
			ResidentKey:        protocol.ResidentKeyRequirementRequired,
			RequireResidentKey: &reqResident,
			UserVerification:   protocol.VerificationPreferred,
		}),
		webauthn.WithExclusions(exclusions),
	)
	if err != nil {
		return "", "", err
	}
	// Marshal strictly creation.Response (unwrapped RegistrationOptionsJSON matching browser webauthnClient.ts).
	optionsBytes, err := json.Marshal(creation.Response)
	if err != nil {
		return "", "", err
	}
	return session.Challenge, string(optionsBytes), nil
}

func finishPasskeyRegistration(
	user authUserRecord,
	expectedChallenge string,
	origin string,
	credentialJSON string,
	corrID string,
) (verifiedRegistrationOutput, error) {
	cfg, err := resolveWebAuthnConfig(origin, corrID)
	if err != nil {
		return verifiedRegistrationOutput{}, err
	}
	wa, err := newWebAuthnInstance(cfg)
	if err != nil {
		return verifiedRegistrationOutput{}, err
	}

	parsed, err := protocol.ParseCredentialCreationResponseBytes([]byte(credentialJSON))
	if err != nil {
		return verifiedRegistrationOutput{}, err
	}
	session := webauthn.SessionData{
		Challenge:        expectedChallenge,
		RelyingPartyID:   cfg.RPID,
		UserID:           []byte(user.ID),
		UserVerification: protocol.VerificationPreferred,
		CredParams:       webauthn.CredentialParametersDefault(),
	}
	cred, err := wa.CreateCredential(adminWebAuthnUser{ID: user.ID, Handle: user.Handle}, session, parsed)
	if err != nil {
		return verifiedRegistrationOutput{}, err
	}
	transports := make([]string, 0, len(cred.Transport))
	for _, t := range cred.Transport {
		transports = append(transports, string(t))
	}
	return verifiedRegistrationOutput{
		CredentialID:   base64.RawURLEncoding.EncodeToString(cred.ID),
		PublicKeyB64:   base64.RawURLEncoding.EncodeToString(cred.PublicKey),
		Counter:        int(cred.Authenticator.SignCount),
		Transports:     transports,
		BackupEligible: cred.Flags.BackupEligible,
		BackupState:    cred.Flags.BackupState,
	}, nil
}

func beginPasskeyLogin(
	user *authUserRecord,
	creds []webauthnCredentialRecord,
	origin string,
	corrID string,
) (string, string, error) {
	cfg, err := resolveWebAuthnConfig(origin, corrID)
	if err != nil {
		return "", "", err
	}
	wa, err := newWebAuthnInstance(cfg)
	if err != nil {
		return "", "", err
	}

	var assertion *protocol.CredentialAssertion
	var session *webauthn.SessionData
	if user == nil || len(creds) == 0 {
		assertion, session, err = wa.BeginDiscoverableLogin(
			webauthn.WithUserVerification(protocol.VerificationPreferred),
		)
	} else {
		waCreds := make([]webauthn.Credential, 0, len(creds))
		for _, c := range creds {
			hydrated, _, hErr := hydrateWebAuthnCredential(c, nil)
			if hErr == nil {
				waCreds = append(waCreds, hydrated)
			}
		}
		if len(waCreds) == 0 {
			assertion, session, err = wa.BeginDiscoverableLogin(
				webauthn.WithUserVerification(protocol.VerificationPreferred),
			)
		} else {
			assertion, session, err = wa.BeginLogin(
				adminWebAuthnUser{ID: user.ID, Handle: user.Handle, Credentials: waCreds},
				webauthn.WithUserVerification(protocol.VerificationPreferred),
			)
		}
	}
	if err != nil {
		return "", "", err
	}
	// Marshal strictly assertion.Response (unwrapped AuthenticationOptionsJSON matching browser webauthnClient.ts).
	optionsBytes, err := json.Marshal(assertion.Response)
	if err != nil {
		return "", "", err
	}
	return session.Challenge, string(optionsBytes), nil
}

func finishPasskeyLogin(
	user authUserRecord,
	storedCred webauthnCredentialRecord,
	expectedChallenge string,
	discoverable bool,
	origin string,
	assertionJSON string,
	corrID string,
) (verifiedLoginOutput, error) {
	cfg, err := resolveWebAuthnConfig(origin, corrID)
	if err != nil {
		return verifiedLoginOutput{}, err
	}
	wa, err := newWebAuthnInstance(cfg)
	if err != nil {
		return verifiedLoginOutput{}, err
	}

	parsed, err := protocol.ParseCredentialRequestResponseBytes([]byte(assertionJSON))
	if err != nil {
		return verifiedLoginOutput{}, err
	}

	assertionFlags := parsed.Response.AuthenticatorData.Flags
	hydrated, legacyHydrated, err := hydrateWebAuthnCredential(storedCred, &assertionFlags)
	if err != nil {
		return verifiedLoginOutput{}, err
	}

	waUser := adminWebAuthnUser{
		ID:          user.ID,
		Handle:      user.Handle,
		Credentials: []webauthn.Credential{hydrated},
	}

	var verifiedCred *webauthn.Credential
	if discoverable {
		session := webauthn.SessionData{
			Challenge:        expectedChallenge,
			RelyingPartyID:   cfg.RPID,
			UserVerification: protocol.VerificationPreferred,
		}
		verifiedCred, err = wa.ValidateDiscoverableLogin(
			func(rawID, userHandle []byte) (webauthn.User, error) {
				if len(userHandle) > 0 && string(userHandle) != user.ID {
					return nil, ErrWebAuthnVerifyFailed
				}
				return waUser, nil
			},
			session,
			parsed,
		)
	} else {
		session := webauthn.SessionData{
			Challenge:            expectedChallenge,
			RelyingPartyID:       cfg.RPID,
			UserID:               []byte(user.ID),
			AllowedCredentialIDs: [][]byte{hydrated.ID},
			UserVerification:     protocol.VerificationPreferred,
		}
		verifiedCred, err = wa.ValidateLogin(waUser, session, parsed)
	}
	if err != nil || verifiedCred == nil {
		if err == nil {
			err = ErrWebAuthnVerifyFailed
		}
		return verifiedLoginOutput{}, err
	}

	// Synced/cloud passkeys legitimately report SignCount == 0 on both stored and new assertions.
	newCounter := int(verifiedCred.Authenticator.SignCount)
	if verifiedCred.Authenticator.CloneWarning && !(storedCred.Counter == 0 && newCounter == 0) {
		return verifiedLoginOutput{}, errors.New("authenticator counter rollback detected")
	}

	branch := "populated_verified"
	if legacyHydrated {
		branch = "legacy_null_hydrated"
	}
	logAdminSeam("RULE_DIVERGENCE", "admin_api.auth.webauthn_legacy_flag_branch", map[string]any{
		"branch":        branch,
		"credentialId":  storedCred.CredentialID,
		"correlationId": corrID,
	})

	return verifiedLoginOutput{
		NewCounter:     newCounter,
		BackupEligible: verifiedCred.Flags.BackupEligible,
		BackupState:    verifiedCred.Flags.BackupState,
		LegacyHydrated: legacyHydrated,
	}, nil
}
