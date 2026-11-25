package privacy

import (
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
