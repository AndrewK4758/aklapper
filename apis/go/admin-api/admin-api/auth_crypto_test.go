package main

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestNode26Argon2idGoldenParity(t *testing.T) {
	// Generated directly by Node 26 hashPasswordArgon2id in packages/node/runtime/src/auth.ts.
	const (
		nodePassword = "Correct-Horse-Battery-Staple-2026!"
		nodePHC      = "$argon2id$v=19$m=19456,t=2,p=1$Cu8GKTLWWev7tjvvX9xBDA$xxuZkN+fSGyZDDWoJYN9KKq/ZKNdTsQryOY3KfwGk4Q"
	)

	parsed, ok := ParseArgon2idPHC(nodePHC)
	if !ok || parsed == nil {
		t.Fatalf("expected ParseArgon2idPHC to accept Node 26 PHC string")
	}
	if parsed.Memory != 19456 || parsed.Passes != 2 || parsed.Parallelism != 1 {
		t.Fatalf("unexpected parsed parameters: %+v", parsed)
	}

	v := NewArgon2Verifier(2)
	phcCopy := nodePHC
	valid, err := v.Verify(nodePassword, &phcCopy)
	if err != nil || !valid {
		t.Fatalf("expected Go Argon2id to verify Node 26 PHC: valid=%v err=%v", valid, err)
	}

	wrong, err := v.Verify("wrong-password", &phcCopy)
	if err != nil || wrong {
		t.Fatalf("expected wrong password to fail cleanly: valid=%v err=%v", wrong, err)
	}

	// Null / malformed stored PHC must execute constant-parameter dummy derivation without panicking or erroring.
	nilValid, nilErr := v.Verify(nodePassword, nil)
	if nilErr != nil || nilValid {
		t.Fatalf("expected nil PHC to fail closed without error: valid=%v err=%v", nilValid, nilErr)
	}
	malformed := "$argon2id$v=19$m=9999999,t=99,p=1$bad$bad"
	malValid, malErr := v.Verify(nodePassword, &malformed)
	if malErr != nil || malValid {
		t.Fatalf("expected out-of-bounds PHC to fail closed without error: valid=%v err=%v", malValid, malErr)
	}

	// Go-generated PHC roundtrip.
	goPHC, err := HashPasswordArgon2id("Go-Generated-Admin-Pass-2026!")
	if err != nil {
		t.Fatalf("HashPasswordArgon2id failed: %v", err)
	}
	if !strings.HasPrefix(goPHC, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("unexpected Go PHC prefix: %s", goPHC)
	}
	goValid, err := v.Verify("Go-Generated-Admin-Pass-2026!", &goPHC)
	if err != nil || !goValid {
		t.Fatalf("expected Go PHC self-verify to succeed: valid=%v err=%v", goValid, err)
	}
}

func TestArgon2VerifierConcurrencySemaphore(t *testing.T) {
	v := NewArgon2Verifier(2)
	// Pre-fill the 2 slots to guarantee deterministic 3rd-caller saturation without race flakiness.
	v.sem <- struct{}{}
	v.sem <- struct{}{}
	defer func() {
		<-v.sem
		<-v.sem
	}()

	var wg sync.WaitGroup
	wg.Add(1)
	var busyErr error
	go func() {
		defer wg.Done()
		_, busyErr = v.Verify("any-pass", nil)
	}()
	wg.Wait()
	if !errors.Is(busyErr, ErrArgon2Busy) {
		t.Fatalf("expected ErrArgon2Busy when semaphore saturated, got %v", busyErr)
	}
}

func TestNode26TotpAesGcmAndBackupCodeGoldenParity(t *testing.T) {
	// Generated directly by Node 26 encryptTotpSecret, computeTotpCode, and hashBackupCode.
	const (
		totpKey        = "cross-lib-golden-totp-key-2026"
		totpSecret     = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"
		nodeEncrypted  = "v1.eTO0MKN5vl0Ah7LU.9iwKGgun-P05cp14QGAcvA.MN_JtC3zB9129zl7i1whmAolIPj-nAdtWEYK0vt2FR8"
		nodeTotpCode   = "452777"
		nodeBackupHash = "76b9579a121716fddcc6a8dc42eef1fb9a76243772d484745086b2442dbbdde4"
	)

	decrypted, err := DecryptTotpSecret(nodeEncrypted, totpKey)
	if err != nil {
		t.Fatalf("DecryptTotpSecret failed on Node 26 ciphertext: %v", err)
	}
	if decrypted != totpSecret {
		t.Fatalf("decrypted mismatch: got %q want %q", decrypted, totpSecret)
	}

	// Tampered auth tag must fail closed.
	parts := strings.Split(nodeEncrypted, ".")
	parts[2] = "AAAAAAAAAAAAAAAAAAAAAA"
	if _, err := DecryptTotpSecret(strings.Join(parts, "."), totpKey); err == nil {
		t.Fatalf("expected tampered AES-GCM tag to fail decryption")
	}

	// Go encrypt -> decrypt roundtrip matches v1.<iv>.<tag>.<ct> format.
	goEnc, err := EncryptTotpSecret(totpSecret, totpKey)
	if err != nil {
		t.Fatalf("EncryptTotpSecret failed: %v", err)
	}
	if len(strings.Split(goEnc, ".")) != 4 || !strings.HasPrefix(goEnc, "v1.") {
		t.Fatalf("unexpected encrypted format: %s", goEnc)
	}
	roundtrip, err := DecryptTotpSecret(goEnc, totpKey)
	if err != nil || roundtrip != totpSecret {
		t.Fatalf("roundtrip mismatch: got %q err=%v", roundtrip, err)
	}

	// RFC 6238 SHA-1 TOTP parity at 2026-01-01T00:00:00Z.
	fixedTime := time.UnixMilli(1767225600000).UTC()
	code, err := ComputeTotpCode(totpSecret, fixedTime)
	if err != nil {
		t.Fatalf("ComputeTotpCode failed: %v", err)
	}
	if code != nodeTotpCode {
		t.Fatalf("TOTP code mismatch: got %q want %q", code, nodeTotpCode)
	}
	if !VerifyTotpCode(totpSecret, nodeTotpCode, fixedTime) {
		t.Fatalf("VerifyTotpCode rejected exact window code")
	}
	if !VerifyTotpCode(totpSecret, nodeTotpCode, fixedTime.Add(30*time.Second)) {
		t.Fatalf("VerifyTotpCode rejected +1 window drift code")
	}
	if VerifyTotpCode(totpSecret, nodeTotpCode, fixedTime.Add(90*time.Second)) {
		t.Fatalf("VerifyTotpCode accepted +3 window drift code")
	}

	// Backup code SHA-256 hash parity.
	if got := HashBackupCode("A1B2-C3D4"); got != nodeBackupHash {
		t.Fatalf("backup hash mismatch: got %q want %q", got, nodeBackupHash)
	}
	if got := HashBackupCode("  a1b2 c3d4 "); got != nodeBackupHash {
		t.Fatalf("normalized backup hash mismatch: got %q want %q", got, nodeBackupHash)
	}
}
