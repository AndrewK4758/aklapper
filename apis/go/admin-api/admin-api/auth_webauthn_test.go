package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"log"
	"strings"
	"testing"

	"github.com/fxamacker/cbor/v2"
)

func buildES256COSEKey(t *testing.T, pub *ecdsa.PublicKey) []byte {
	t.Helper()
	xBytes := make([]byte, 32)
	yBytes := make([]byte, 32)
	pub.X.FillBytes(xBytes)
	pub.Y.FillBytes(yBytes)
	coseMap := map[int]any{
		1:  2,  // kty: EC2
		3:  -7, // alg: ES256
		-1: 1,  // crv: P-256
		-2: xBytes,
		-3: yBytes,
	}
	raw, err := cbor.Marshal(coseMap)
	if err != nil {
		t.Fatalf("cbor.Marshal COSE key failed: %v", err)
	}
	return raw
}

func buildAttestationCredentialJSON(
	t *testing.T,
	challenge string,
	origin string,
	rpID string,
	credID []byte,
	pub *ecdsa.PublicKey,
	flags byte,
	signCount uint32,
) string {
	t.Helper()
	clientData, _ := json.Marshal(map[string]any{
		"type":      "webauthn.create",
		"challenge": challenge,
		"origin":    origin,
	})
	rpHash := sha256.Sum256([]byte(rpID))
	coseKey := buildES256COSEKey(t, pub)

	var authData bytes.Buffer
	authData.Write(rpHash[:])
	authData.WriteByte(flags)
	_ = binary.Write(&authData, binary.BigEndian, signCount)
	authData.Write(make([]byte, 16)) // AAGUID
	_ = binary.Write(&authData, binary.BigEndian, uint16(len(credID)))
	authData.Write(credID)
	authData.Write(coseKey)

	attObj, err := cbor.Marshal(map[string]any{
		"fmt":      "none",
		"attStmt":  map[string]any{},
		"authData": authData.Bytes(),
	})
	if err != nil {
		t.Fatalf("cbor.Marshal attestationObject failed: %v", err)
	}

	credIDB64 := base64.RawURLEncoding.EncodeToString(credID)
	payload, _ := json.Marshal(map[string]any{
		"id":    credIDB64,
		"rawId": credIDB64,
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    base64.RawURLEncoding.EncodeToString(clientData),
			"attestationObject": base64.RawURLEncoding.EncodeToString(attObj),
			"transports":        []string{"internal"},
		},
	})
	return string(payload)
}

func buildAssertionJSON(
	t *testing.T,
	challenge string,
	origin string,
	rpID string,
	credID []byte,
	userID string,
	priv *ecdsa.PrivateKey,
	flags byte,
	signCount uint32,
) string {
	t.Helper()
	clientData, _ := json.Marshal(map[string]any{
		"type":      "webauthn.get",
		"challenge": challenge,
		"origin":    origin,
	})
	rpHash := sha256.Sum256([]byte(rpID))
	var authData bytes.Buffer
	authData.Write(rpHash[:])
	authData.WriteByte(flags)
	_ = binary.Write(&authData, binary.BigEndian, signCount)

	clientHash := sha256.Sum256(clientData)
	signedPayload := append(append([]byte{}, authData.Bytes()...), clientHash[:]...)
	digest := sha256.Sum256(signedPayload)
	sig, err := ecdsa.SignASN1(rand.Reader, priv, digest[:])
	if err != nil {
		t.Fatalf("ecdsa.SignASN1 failed: %v", err)
	}

	credIDB64 := base64.RawURLEncoding.EncodeToString(credID)
	payload, _ := json.Marshal(map[string]any{
		"id":    credIDB64,
		"rawId": credIDB64,
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    base64.RawURLEncoding.EncodeToString(clientData),
			"authenticatorData": base64.RawURLEncoding.EncodeToString(authData.Bytes()),
			"signature":         base64.RawURLEncoding.EncodeToString(sig),
			"userHandle":        base64.RawURLEncoding.EncodeToString([]byte(userID)),
		},
	})
	return string(payload)
}

func TestWebAuthnRegistrationDiscoverableAndLegacyNullFlags(t *testing.T) {
	t.Setenv("NODE_ENV", "test")
	t.Setenv("WEBAUTHN_RP_ID", "localhost")
	t.Setenv("WEBAUTHN_ORIGIN", "http://localhost:4201")

	user := authUserRecord{
		ID:     "11111111-2222-4333-8444-555555555555",
		Handle: "admin",
		Role:   "admin",
	}

	// 1. Verify BeginPasskeyRegistration emits unwrapped JSON matching browser webauthnClient.ts.
	regChallenge, regOptionsJSON, err := beginPasskeyRegistration(user, nil, "http://localhost:4201", "corr-reg-1")
	if err != nil {
		t.Fatalf("beginPasskeyRegistration failed: %v", err)
	}
	var regOpts map[string]any
	if err := json.Unmarshal([]byte(regOptionsJSON), &regOpts); err != nil {
		t.Fatalf("invalid registration options JSON: %v", err)
	}
	if _, hasPublicKeyWrapper := regOpts["publicKey"]; hasPublicKeyWrapper {
		t.Fatalf("registration options must be unwrapped (no outer publicKey envelope)")
	}
	if regOpts["challenge"] != regChallenge {
		t.Fatalf("challenge mismatch in options JSON")
	}

	// 2. Complete registration with a real ES256 keypair + synced passkey flags (UP|UV|BE|BS|AT = 0x5d).
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("ecdsa.GenerateKey failed: %v", err)
	}
	credID := []byte("admin-passkey-cred-id-01")
	// Flags: UP(0x01) | UV(0x04) | BE(0x08) | BS(0x10) | AT(0x40) = 0x5d.
	attJSON := buildAttestationCredentialJSON(t, regChallenge, "http://localhost:4201", "localhost", credID, &priv.PublicKey, 0x5d, 0)
	regOut, err := finishPasskeyRegistration(user, regChallenge, "http://localhost:4201", attJSON, "corr-reg-2")
	if err != nil {
		t.Fatalf("finishPasskeyRegistration failed: %v", err)
	}
	if !regOut.BackupEligible || !regOut.BackupState || regOut.Counter != 0 {
		t.Fatalf("unexpected registration flags/counter: %+v", regOut)
	}

	// 3. Simulate legacy @simplewebauthn/server row where backup_eligible & backup_state are NULL + counter == 0.
	legacyRow := webauthnCredentialRecord{
		CredentialID:   regOut.CredentialID,
		UserID:         user.ID,
		PublicKey:      regOut.PublicKeyB64,
		Counter:        0,
		Transports:     []string{"internal"},
		BackupEligible: nil,
		BackupState:    nil,
	}

	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	defer log.SetOutput(origOut)

	// 3a. Discoverable login (no handle) -> BeginDiscoverableLogin + ValidateDiscoverableLogin.
	loginChallenge, loginOptsJSON, err := beginPasskeyLogin(nil, nil, "http://localhost:4201", "corr-disc-1")
	if err != nil {
		t.Fatalf("beginPasskeyLogin discoverable failed: %v", err)
	}
	var loginOpts map[string]any
	if err := json.Unmarshal([]byte(loginOptsJSON), &loginOpts); err != nil {
		t.Fatalf("invalid login options JSON: %v", err)
	}
	if _, hasPublicKeyWrapper := loginOpts["publicKey"]; hasPublicKeyWrapper {
		t.Fatalf("login options must be unwrapped (no outer publicKey envelope)")
	}

	// Flags: UP(0x01) | UV(0x04) | BE(0x08) | BS(0x10) = 0x1d, signCount = 0 (synced cloud passkey).
	assertion1 := buildAssertionJSON(t, loginChallenge, "http://localhost:4201", "localhost", credID, user.ID, priv, 0x1d, 0)
	out1, err := finishPasskeyLogin(user, legacyRow, loginChallenge, true, "http://localhost:4201", assertion1, "corr-disc-2")
	if err != nil {
		t.Fatalf("legacy NULL discoverable passkey login failed: %v", err)
	}
	if !out1.LegacyHydrated || !out1.BackupEligible || !out1.BackupState || out1.NewCounter != 0 {
		t.Fatalf("unexpected legacy hydrated login output: %+v", out1)
	}
	if !strings.Contains(logBuf.String(), `"event":"admin_api.auth.webauthn_legacy_flag_branch"`) ||
		!strings.Contains(logBuf.String(), `"branch":"legacy_null_hydrated"`) {
		t.Fatalf("missing legacy_null_hydrated seam log: %s", logBuf.String())
	}

	// 3b. Handle-scoped login after flags are hydrated -> populated_verified branch.
	logBuf.Reset()
	be, bs := out1.BackupEligible, out1.BackupState
	hydratedRow := legacyRow
	hydratedRow.BackupEligible = &be
	hydratedRow.BackupState = &bs

	scopedChallenge, _, err := beginPasskeyLogin(&user, []webauthnCredentialRecord{hydratedRow}, "http://localhost:4201", "corr-scoped-1")
	if err != nil {
		t.Fatalf("beginPasskeyLogin handle-scoped failed: %v", err)
	}
	assertion2 := buildAssertionJSON(t, scopedChallenge, "http://localhost:4201", "localhost", credID, user.ID, priv, 0x1d, 0)
	out2, err := finishPasskeyLogin(user, hydratedRow, scopedChallenge, false, "http://localhost:4201", assertion2, "corr-scoped-2")
	if err != nil {
		t.Fatalf("populated handle-scoped passkey login failed: %v", err)
	}
	if out2.LegacyHydrated {
		t.Fatalf("expected LegacyHydrated=false on populated row")
	}
	if !strings.Contains(logBuf.String(), `"branch":"populated_verified"`) {
		t.Fatalf("missing populated_verified seam log: %s", logBuf.String())
	}

	// 4. Counter rollback detection when stored counter > 0 and assertion signCount <= stored.
	rollbackRow := hydratedRow
	rollbackRow.Counter = 5
	rbChallenge, _, err := beginPasskeyLogin(&user, []webauthnCredentialRecord{rollbackRow}, "http://localhost:4201", "corr-rb-1")
	if err != nil {
		t.Fatalf("beginPasskeyLogin rollback setup failed: %v", err)
	}
	rbAssertion := buildAssertionJSON(t, rbChallenge, "http://localhost:4201", "localhost", credID, user.ID, priv, 0x1d, 2)
	if _, err := finishPasskeyLogin(user, rollbackRow, rbChallenge, false, "http://localhost:4201", rbAssertion, "corr-rb-2"); err == nil {
		t.Fatalf("expected counter rollback (5 -> 2) to fail closed")
	}
}
