package privacy

import (
	"encoding/base64"
	"errors"
	"log"
	"strings"
	"testing"
)

func TestStreamGuardRedactsSplitDenylistWithoutLoggingMatchedText(t *testing.T) {
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    `["Project-Mercury-NDA"]`,
		DenylistAction: ActionRedact,
	})
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	guard := NewStreamGuard(cfg, "corr-priv-01")
	chunks := []string{"Worked on Pro", "ject-Mer", "cury-NDA system"}
	var emitted strings.Builder
	for _, ch := range chunks {
		out, procErr := guard.Process(ch)
		if procErr != nil {
			t.Fatalf("Process failed: %v", procErr)
		}
		if strings.Contains(out, "Project-Mercury-NDA") || strings.Contains(out, "Mercury") {
			t.Fatalf("unredacted sensitive substring emitted early: %q", out)
		}
		emitted.WriteString(out)
	}
	tail, err := guard.Flush()
	if err != nil {
		t.Fatalf("Flush failed: %v", err)
	}
	emitted.WriteString(tail)

	finalText := emitted.String()
	if strings.Contains(finalText, "Project-Mercury-NDA") || !strings.Contains(finalText, "[REDACTED]") {
		t.Fatalf("expected redacted output, got %q", finalText)
	}
	if !strings.Contains(finalText, "Worked on ") || !strings.Contains(finalText, " system") {
		t.Fatalf("expected surrounding safe text preserved, got %q", finalText)
	}

	logOut := logs.String()
	if !strings.Contains(logOut, "BOUNDARY_FAULT") || !strings.Contains(logOut, "privacy.stream_guard.triggered") {
		t.Fatalf("expected BOUNDARY_FAULT privacy.stream_guard.triggered log, got %s", logOut)
	}
	if strings.Contains(logOut, "Project-Mercury-NDA") || strings.Contains(logOut, "Mercury") {
		t.Fatalf("audit log must NEVER contain matched sensitive text: %s", logOut)
	}
}

func TestStreamGuardDetectsNFKCAndSeparatorFlooding(t *testing.T) {
	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    "AcmeCorp\n",
		DenylistAction: ActionRedact,
	})
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	t.Run("Full-width Unicode NFKC obfuscation", func(t *testing.T) {
		guard := NewStreamGuard(cfg, "corr-nfkc")
		out1, err := guard.Process("Client \uFF21\uFF43\uFF4D\uFF45")
		if err != nil {
			t.Fatalf("Process 1: %v", err)
		}
		out2, err := guard.Process("-Corp details")
		if err != nil {
			t.Fatalf("Process 2: %v", err)
		}
		tail, err := guard.Flush()
		if err != nil {
			t.Fatalf("Flush: %v", err)
		}
		combined := out1 + out2 + tail
		if !strings.Contains(combined, "[REDACTED]") || strings.Contains(combined, "\uFF21") {
			t.Fatalf("expected NFKC match redacted, got %q", combined)
		}
	})

	t.Run("17 zero-width separator flood between leading char and remainder", func(t *testing.T) {
		guard := NewStreamGuard(cfg, "corr-zw")
		flood := "A" + strings.Repeat("\u200B", 17)
		out1, err := guard.Process("Secret " + flood)
		if err != nil {
			t.Fatalf("Process 1: %v", err)
		}
		if strings.Contains(out1, "A") {
			t.Fatalf("separator flooding flushed leading 'A' prematurely: %q", out1)
		}
		out2, err := guard.Process("cmeCorp end")
		if err != nil {
			t.Fatalf("Process 2: %v", err)
		}
		tail, err := guard.Flush()
		if err != nil {
			t.Fatalf("Flush: %v", err)
		}
		combined := out1 + out2 + tail
		if !strings.Contains(combined, "[REDACTED]") || strings.Contains(combined, "cmeCorp") {
			t.Fatalf("expected separator-flooded span redacted, got %q", combined)
		}
	})
}

func TestStreamGuardAbortsBuiltInSecretsAcrossLongSplitsWithEmptyDenylist(t *testing.T) {
	cfg, err := LoadConfig(ConfigInput{RawDenylist: ""})
	if err != nil {
		t.Fatalf("LoadConfig empty failed: %v", err)
	}

	t.Run("43-rune DB URL split", func(t *testing.T) {
		guard := NewStreamGuard(cfg, "corr-dburl")
		out1, err := guard.Process("postgres://admin:s3cr3tP4ssw0rd")
		if err != nil {
			t.Fatalf("unexpected error on chunk 1: %v", err)
		}
		if strings.Contains(out1, "s3cr3t") || strings.Contains(out1, "postgres://") {
			t.Fatalf("adaptive secret holdback failed; leaked prefix: %q", out1)
		}
		_, err = guard.Process("@db.internal:5432/aklapper")
		if !errors.Is(err, ErrPrivacyAborted) {
			t.Fatalf("expected ErrPrivacyAborted on chunk 2, got %v", err)
		}
	})

	t.Run("23-rune PEM key split", func(t *testing.T) {
		guard := NewStreamGuard(cfg, "corr-pem")
		out1, err := guard.Process("-----BEGIN RSA PRIVATE ")
		if err != nil {
			t.Fatalf("unexpected error on chunk 1: %v", err)
		}
		if strings.Contains(out1, "BEGIN") {
			t.Fatalf("adaptive secret holdback failed; leaked PEM prefix: %q", out1)
		}
		_, err = guard.Process("KEY-----")
		if !errors.Is(err, ErrPrivacyAborted) {
			t.Fatalf("expected ErrPrivacyAborted on PEM chunk 2, got %v", err)
		}
	})
}

func TestLoadConfigRejectsUnboundedRegexAndWarnsEmptyInProd(t *testing.T) {
	if _, err := LoadConfig(ConfigInput{RawDenylist: "secret.*leak\n"}); err == nil {
		t.Fatal("expected unbounded wildcard regex secret.*leak to fail closed")
	}
	if _, err := LoadConfig(ConfigInput{RawDenylist: `["foo.+bar"]`}); err == nil {
		t.Fatal("expected unbounded wildcard regex foo.+bar to fail closed")
	}

	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	t.Setenv("APP_ENV", "production")
	t.Setenv("AI_PRIVACY_DENYLIST", "")
	t.Setenv("AI_PRIVACY_DENYLIST_FILE", "")
	if _, err := LoadConfigFromEnv(); err != nil {
		t.Fatalf("expected empty denylist in production to allow startup with built-in secrets active, got %v", err)
	}
	if !strings.Contains(logs.String(), "privacy.stream_guard.denylist_empty") || !strings.Contains(logs.String(), "UNSOUND_CONDITION") {
		t.Fatalf("expected UNSOUND_CONDITION privacy.stream_guard.denylist_empty log, got %s", logs.String())
	}
}

func TestStreamGuardRedactPlaceholderDoesNotLoop(t *testing.T) {
	cases := []struct {
		name     string
		denylist string
		input    string
	}{
		{name: "literal ACT substring of REDACTED", denylist: `["ACT"]`, input: "Built React app for ACT client."},
		{name: "literal Red substring of REDACTED", denylist: `["Red"]`, input: "Project Red launched cleanly."},
		{name: "bounded regex matching REDACTED", denylist: `["re:\\b[A-Z]{5,12}\\b"]`, input: "Project MERCURY launched cleanly."},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := LoadConfig(ConfigInput{
				RawDenylist:    tc.denylist,
				DenylistAction: ActionRedact,
			})
			if err != nil {
				t.Fatalf("LoadConfig failed: %v", err)
			}
			guard := NewStreamGuard(cfg, "corr-loop-check")
			out1, err := guard.Process(tc.input)
			if err != nil {
				t.Fatalf("Process failed: %v", err)
			}
			tail, err := guard.Flush()
			if err != nil {
				t.Fatalf("Flush failed: %v", err)
			}
			got := out1 + tail
			if !strings.Contains(got, "[REDACTED]") {
				t.Fatalf("expected [REDACTED] in output, got %q", got)
			}
			if strings.Contains(got, "[RED[REDACTED]") {
				t.Fatalf("recursive placeholder corruption detected: %q", got)
			}
		})
	}
}

func TestStreamGuardAbortsLongStreamedJWTAndNormalizesNFD(t *testing.T) {
	t.Run("171-rune and 600-rune JWTs abort across 8-rune chunks with zero leakage", func(t *testing.T) {
		cfg, err := LoadConfig(ConfigInput{RawDenylist: ""})
		if err != nil {
			t.Fatalf("LoadConfig failed: %v", err)
		}
		gcpHeaderWithTyp := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"3d4b8c1f2a9e7b6d5c4f3e2a1b0c9d8e7f6a5b4c","typ":"JWT"}`))
		gcpHeaderMin := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"3d4b8c1f2a9e7b6d5c4f3e2a1b0c9d8e7f6a5b4c"}`))
		uuidKidHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","typ":"JWT","kid":"550e8400-e29b-41d4-a716-446655440000"}`))
		oidcPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://accounts.google.com","aud":"https://ai-ask-abc.a.run.app","sub":"109876543210","email":"sa@games-424800.iam.gserviceaccount.com","iat":1795580000,"exp":1795583600}`))
		oidcSig := strings.Repeat("S", 342)
		jwts := []string{
			"eyJ" + strings.Repeat("a", 60) + ".eyJ" + strings.Repeat("b", 60) + "." + strings.Repeat("c", 43),
			"eyJ" + strings.Repeat("A", 50) + ".eyJ" + strings.Repeat("B", 300) + "." + strings.Repeat("C", 240),
			gcpHeaderWithTyp + "." + oidcPayload + "." + oidcSig,
			gcpHeaderMin + "." + oidcPayload + "." + oidcSig,
			uuidKidHeader + "." + oidcPayload + "." + oidcSig,
		}
		for _, jwt := range jwts {
			guard := NewStreamGuard(cfg, "corr-jwt-stream")
			full := "Token: " + jwt + " end."
			aborted := false
			var emitted strings.Builder
			for i := 0; i < len(full); i += 8 {
				end := min(len(full), i+8)
				out, procErr := guard.Process(full[i:end])
				emitted.WriteString(out)
				if errors.Is(procErr, ErrPrivacyAborted) {
					aborted = true
					break
				}
				if procErr != nil {
					t.Fatalf("unexpected error: %v", procErr)
				}
			}
			if !aborted {
				if tail, flushErr := guard.Flush(); errors.Is(flushErr, ErrPrivacyAborted) {
					aborted = true
				} else {
					emitted.WriteString(tail)
				}
			}
			if !aborted {
				t.Fatalf("expected ErrPrivacyAborted for len=%d JWT, leaked %q", len(jwt), emitted.String())
			}
			if strings.Contains(emitted.String(), "eyJ") {
				t.Fatalf("JWT prefix flushed before abort: %q", emitted.String())
			}
		}
	})

	t.Run("NFD combining characters cannot bypass NFC denylist across chunks", func(t *testing.T) {
		cfg, err := LoadConfig(ConfigInput{
			RawDenylist:    `["Café-NDA"]`,
			DenylistAction: ActionRedact,
		})
		if err != nil {
			t.Fatalf("LoadConfig failed: %v", err)
		}
		guard := NewStreamGuard(cfg, "corr-nfd")
		out1, err := guard.Process("Worked at Cafe")
		if err != nil {
			t.Fatalf("Process 1 failed: %v", err)
		}
		out2, err := guard.Process("\u0301-NDA last year.")
		if err != nil {
			t.Fatalf("Process 2 failed: %v", err)
		}
		tail, err := guard.Flush()
		if err != nil {
			t.Fatalf("Flush failed: %v", err)
		}
		got := out1 + out2 + tail
		if !strings.Contains(got, "[REDACTED]") || strings.Contains(got, "NDA") {
			t.Fatalf("expected NFD Cafe\\u0301-NDA redacted, got %q", got)
		}
	})

	t.Run("active denylist redaction cannot blind built-in secret abort on split DB URL or JWT", func(t *testing.T) {
		// 1. Denylist term inside DB URL username split across chunks
		cfgDB, err := LoadConfig(ConfigInput{RawDenylist: `["Acme"]`, DenylistAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig failed: %v", err)
		}
		gDB := NewStreamGuard(cfgDB, "corr-secret-db-denylist")
		out1, err := gDB.Process("Connect via postgres://acme_admin:SuperS3cr3tP4ssw0rd")
		if err != nil {
			t.Fatalf("unexpected chunk 1 error: %v", err)
		}
		if strings.Contains(out1, "SuperS3cr3tP4ssw0rd") || strings.Contains(out1, "postgres://") {
			t.Fatalf("leaked DB URL prefix during chunk 1: %q", out1)
		}
		if _, err := gDB.Process("@db.prod.internal:5432/aklapper now."); !errors.Is(err, ErrPrivacyAborted) {
			t.Fatalf("expected ErrPrivacyAborted on chunk 2 DB URL, got %v", err)
		}

		// 2. Denylist term matching scheme name before :// arrives
		cfgScheme, err := LoadConfig(ConfigInput{RawDenylist: `["postgres"]`, DenylistAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig failed: %v", err)
		}
		gScheme := NewStreamGuard(cfgScheme, "corr-secret-scheme")
		outS1, err := gScheme.Process("DB is postgres")
		if err != nil {
			t.Fatalf("unexpected chunk 1 error: %v", err)
		}
		if strings.Contains(outS1, "postgres") {
			t.Fatalf("leaked scheme prefix: %q", outS1)
		}
		if _, err := gScheme.Process("://admin:S3cr3tPass@db.internal:5432/app"); !errors.Is(err, ErrPrivacyAborted) {
			t.Fatalf("expected ErrPrivacyAborted on split scheme+URL, got %v", err)
		}

		// 3. Regex denylist cannot blind HS256 JWT streamed in 8-rune chunks
		cfgJWT, err := LoadConfig(ConfigInput{RawDenylist: `["Red","ACT","re:\\b[A-Z]{5,12}\\b"]`, DenylistAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig failed: %v", err)
		}
		gJWT := NewStreamGuard(cfgJWT, "corr-secret-jwt-regex")
		jwt := "Token is eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
			base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://accounts.google.com","sub":"user-123"}`)) +
			"." + strings.Repeat("z", 43)
		aborted := false
		var leaked strings.Builder
		for i := 0; i < len(jwt); i += 8 {
			out, pErr := gJWT.Process(jwt[i:min(len(jwt), i+8)])
			leaked.WriteString(out)
			if errors.Is(pErr, ErrPrivacyAborted) {
				aborted = true
				break
			}
			if pErr != nil {
				t.Fatalf("unexpected error: %v", pErr)
			}
		}
		if !aborted {
			t.Fatalf("expected ErrPrivacyAborted for JWT with active regex denylist, leaked=%q", leaked.String())
		}
		if strings.Contains(leaked.String(), "eyJ") || strings.Contains(leaked.String(), "accounts.google.com") {
			t.Fatalf("JWT content leaked before abort: %q", leaked.String())
		}

		// 4. Benign non-secret URL containing denylist term still redacts cleanly on Flush
		gBenign := NewStreamGuard(cfgDB, "corr-benign-url")
		b1, err := gBenign.Process("Visit https://acme.example.com/docs for info.")
		if err != nil {
			t.Fatalf("Process benign failed: %v", err)
		}
		b2, err := gBenign.Flush()
		if err != nil {
			t.Fatalf("Flush benign failed: %v", err)
		}
		if got := b1 + b2; strings.Contains(strings.ToLower(got), "acme") || !strings.Contains(got, "[REDACTED]") {
			t.Fatalf("expected benign URL denylist term redacted on flush, got %q", got)
		}
	})
}
