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

func TestRedactTextForStorageAppliesBoundedContextFreeRegexRules(t *testing.T) {
	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    `["re:secret-[0-9]{4}", "SyntheticClientZ"]`,
		DenylistAction: ActionAbort,
		SecretAction:   ActionAbort,
	})
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}
	if cfg.maxRegexRunes == 0 {
		t.Fatal("expected non-zero maxRegexRunes for bounded regex entry")
	}

	input := "Please tell me about secret-4829 and SyntheticClientZ architecture."
	redacted := RedactTextForStorage(cfg, input, 1000)

	for _, forbidden := range []string{"secret-4829", "SyntheticClientZ"} {
		if strings.Contains(redacted, forbidden) {
			t.Fatalf("RedactTextForStorage leaked %q in %q", forbidden, redacted)
		}
	}
	if !strings.Contains(redacted, RedactionPlaceholder) {
		t.Fatalf("expected [REDACTED] placeholder in %q", redacted)
	}
	if !strings.Contains(redacted, "architecture.") {
		t.Fatalf("expected benign surrounding text preserved in %q", redacted)
	}
}

func TestLoadConfigAllowsLiteralPlusStarBrandNamesAndRedactCoversExtendedSecrets(t *testing.T) {
	rawJSON, _ := json.Marshal([]string{"Disney+", "Health+", "A*Corp"})
	unpadded := strings.TrimRight(base64.StdEncoding.EncodeToString(rawJSON), "=")
	t.Setenv("AI_PRIVACY_DENYLIST", "")
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", unpadded)

	cfg, err := LoadConfigFromEnv()
	if err != nil {
		t.Fatalf("expected literal +/* brand names in unpadded base64 denylist to load cleanly, got %v", err)
	}
	if cfg.DenylistTermCount != 3 {
		t.Fatalf("expected 3 terms, got %d", cfg.DenylistTermCount)
	}

	input := "Keys sk-proj-AbCdEf1234567890GhIjKlMnOpQrStUvWxYz, sk_live_1234567890abcdefghij, " +
		"ASIAIOSFODNN7EXAMPLE, gho_1234567890abcdefghijklmnopqrstuvwx, xoxb-123456789012-123456789012-abcdefg, " +
		"SSN 123-45-6789, user\uFF20example.com, alice@\u200Bexample.com, PROJ-9042, and Disney+ under UTF-8."
	redacted := RedactTextForStorage(cfg, input, 1000)

	for _, forbidden := range []string{
		"sk-proj-", "sk_live_", "ASIAIOSFODNN7EXAMPLE", "gho_1234", "xoxb-",
		"123-45-6789", "user@example.com", "alice@example.com", "PROJ-9042", "Disney+",
	} {
		if strings.Contains(redacted, forbidden) {
			t.Fatalf("RedactTextForStorage leaked %q in %q", forbidden, redacted)
		}
	}
	if !strings.Contains(redacted, "UTF-8") {
		t.Fatalf("expected allow-listed UTF-8 preserved in %q", redacted)
	}
}

func TestPrivacySeparatorAndDiacriticFoldingClosure(t *testing.T) {
	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    `["CafeCorp", "Acme Capital", "SecretClient"]`,
		DenylistAction: ActionRedact,
		SecretAction:   ActionAbort,
	})
	if err != nil {
		t.Fatalf("LoadConfig failed: %v", err)
	}

	// StreamGuard catches dot, slash, and general Unicode Cf (U+2060 Word Joiner) obfuscation
	for _, variant := range []string{
		"Built for Acme.Capital platform.",
		"Built for Acme/Capital platform.",
		"Built for Sec\u2060retClient platform.",
	} {
		guard := NewStreamGuard(cfg, "corr-sep-cf")
		s1, pErr := guard.Process(variant)
		if pErr != nil {
			t.Fatalf("Process(%q): %v", variant, pErr)
		}
		s2, fErr := guard.Flush()
		if fErr != nil {
			t.Fatalf("Flush(%q): %v", variant, fErr)
		}
		got := s1 + s2
		if !strings.Contains(got, RedactionPlaceholder) || strings.Contains(got, "Capital") || strings.Contains(got, "Client") {
			t.Fatalf("StreamGuard failed to redact %q -> %q", variant, got)
		}
	}

	// RedactTextForStorage catches NFD combining marks alongside dot/slash/U+2060 while preserving benign accents
	input := "Ask about Cafe\u0301Corp, Acme.Capital, Sec\u2060retClient, and Andrew's r\u00E9sum\u00E9."
	redacted := RedactTextForStorage(cfg, input, 1000)
	for _, forbidden := range []string{"Cafe", "Acme", "Capital", "Secret", "Client"} {
		if strings.Contains(redacted, forbidden) {
			t.Fatalf("RedactTextForStorage leaked %q in %q", forbidden, redacted)
		}
	}
	if !strings.Contains(redacted, "r\u00E9sum\u00E9") {
		t.Fatalf("expected benign accented text preserved in %q", redacted)
	}
}
