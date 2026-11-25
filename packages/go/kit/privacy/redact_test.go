package privacy

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestLoadConfigFromEnvMergesBase64DossierDenylistAndBlocksSplitChunks(t *testing.T) {
	rawJSON, _ := json.Marshal([]string{"Synthetic Confidential Client X"})
	t.Setenv("AI_PRIVACY_DENYLIST", `["Legacy-Term-Alpha"]`)
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", base64.StdEncoding.EncodeToString(rawJSON))

	cfg, err := LoadConfigFromEnv()
	if err != nil {
		t.Fatalf("LoadConfigFromEnv failed: %v", err)
	}
	if cfg.DenylistTermCount != 2 {
		t.Fatalf("expected 2 merged denylist rules, got %d", cfg.DenylistTermCount)
	}

	guard := NewStreamGuard(cfg, "corr-split-test")
	var out strings.Builder
	for _, chunk := range []string{"Worked with Synthe", "tic Confidential ", "Client X on cloud systems."} {
		safe, pErr := guard.Process(chunk)
		if pErr != nil {
			t.Fatalf("unexpected Process error: %v", pErr)
		}
		out.WriteString(safe)
	}
	tail, fErr := guard.Flush()
	if fErr != nil {
		t.Fatalf("unexpected Flush error: %v", fErr)
	}
	out.WriteString(tail)

	finalText := out.String()
	if strings.Contains(finalText, "Synthetic") || strings.Contains(finalText, "Client X") {
		t.Fatalf("split-chunk dossier denylist phrase leaked into output: %q", finalText)
	}
	if !strings.Contains(finalText, RedactionPlaceholder) {
		t.Fatalf("expected [REDACTED] placeholder in output, got %q", finalText)
	}
}

func TestLoadConfigFromEnvAcceptsPlainJSONFallbackAndRejectsMalformedBase64(t *testing.T) {
	t.Setenv("AI_PRIVACY_DENYLIST", "")
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", `["PlainFallbackClient"]`)
	cfg, err := LoadConfigFromEnv()
	if err != nil || cfg.DenylistTermCount != 1 {
		t.Fatalf("expected plain JSON fallback to load 1 term, got cfg=%+v err=%v", cfg, err)
	}

	t.Setenv("DOSSIER_PRIVACY_DENYLIST", "!!!invalid-base64-secret-value!!!")
	_, badErr := LoadConfigFromEnv()
	if badErr == nil {
		t.Fatal("expected malformed DOSSIER_PRIVACY_DENYLIST to fail closed")
	}
	if strings.Contains(badErr.Error(), "invalid-base64-secret-value") {
		t.Fatalf("error leaked raw DOSSIER_PRIVACY_DENYLIST value: %v", badErr)
	}
}

func TestRedactTextForStorageScrubsSecretsDenylistPIIAndCapsRunes(t *testing.T) {
	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    `["SyntheticConfidentialClientX"]`,
		DenylistAction: ActionRedact,
		SecretAction:   ActionAbort,
	})
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	input := "Ask about SyntheticConfidentialClientX with key AKIAIOSFODNN7EXAMPLE, " +
		"postgres://admin:superpass@db.internal:5432/app, and alice@example.com " +
		strings.Repeat("word ", 300)
	redacted := RedactTextForStorage(cfg, input, 1000)

	for _, forbidden := range []string{
		"SyntheticConfidentialClientX",
		"AKIAIOSFODNN7EXAMPLE",
		"superpass",
		"alice@example.com",
	} {
		if strings.Contains(redacted, forbidden) {
			t.Fatalf("RedactTextForStorage leaked %q in %q", forbidden, redacted)
		}
	}
	if !strings.Contains(redacted, RedactionPlaceholder) {
		t.Fatalf("expected [REDACTED] in output: %q", redacted)
	}
	if utf8.RuneCountInString(redacted) > 1000 {
		t.Fatalf("expected <=1000 runes, got %d", utf8.RuneCountInString(redacted))
	}
}
