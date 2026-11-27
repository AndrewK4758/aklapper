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

func TestRedactTextForStorageSinglePassOverlapNoSelfRedactionHangulAndCGJ(t *testing.T) {
	// 1. Overlapping accented + short denylist rules must merge cleanly without leaking accented prefix
	cfgOverlap, err := LoadConfig(ConfigInput{
		RawDenylist: `["CafeCorp-Cloud","Cloud","Red","ACT","한글Corp","re:secret-[0-9]{4}"]`,
	})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	gotOverlap := RedactTextForStorage(cfgOverlap, "How did Andrew architect Cafe\u0301Corp-Cloud systems?", 1000)
	if gotOverlap != "How did Andrew architect [REDACTED] systems?" {
		t.Fatalf("overlapping accented rule leaked or corrupted: %q", gotOverlap)
	}

	// 2. Denylist substrings of [REDACTED] ("Red", "ACT") must never re-redact emitted placeholders
	gotRed := RedactTextForStorage(cfgOverlap, "How did Andrew build Project Red services?", 1000)
	if gotRed != "How did Andrew build Project [REDACTED] services?" {
		t.Fatalf("recursive placeholder corruption on Red: %q", gotRed)
	}
	gotActSecret := RedactTextForStorage(cfgOverlap, "Debug postgres://admin:S3cr3tP4ss@db.internal:5432/app issue", 1000)
	if gotActSecret != "Debug [REDACTED] issue" {
		t.Fatalf("recursive placeholder corruption on ACT + secret: %q", gotActSecret)
	}

	// 3. Hangul precomposed, LV+T, and decomposed Jamo with combining marks recompose via NFKC and match denylist
	for _, hVariant := range []string{
		"How did Andrew work with \uD55C\u0301\uAE00Corp systems?",
		"How did Andrew work with \u1112\u0301\u1161\u11AB\uAE00Corp systems?",
		"How did Andrew work with \uD558\u0301\u11AB\uAE00Corp systems?",
	} {
		gotHangul := RedactTextForStorage(cfgOverlap, hVariant, 1000)
		if gotHangul != "How did Andrew work with [REDACTED] systems?" {
			t.Fatalf("Hangul combining-mark bypass on %q in RedactTextForStorage: %q", hVariant, gotHangul)
		}
	}

	// 4. Invisible Mn (U+034F CGJ) and combining acute (\u0301) cannot bypass built-in secrets, re:, extra credentials, PII, or tracker keys
	gotCGJ := RedactTextForStorage(
		cfgOverlap,
		"Check post\u034Fgres://admin:S3cr3tP4ss@localhost:5432/app AK\u034FIAIOSFODNN7EXAMPLE se\u0301cret-4829 alice@\u034Fexample.com PR\u034FOJ-9042 UTF-8",
		1000,
	)
	for _, forbidden := range []string{"postgres", "S3cr3tP4ss", "AK", "EXAMPLE", "secret", "4829", "alice", "example.com", "PROJ-9042"} {
		if strings.Contains(gotCGJ, forbidden) {
			t.Fatalf("Mn/CGJ bypass leaked %q in %q", forbidden, gotCGJ)
		}
	}
	if !strings.Contains(gotCGJ, "UTF-8") {
		t.Fatalf("expected allow-listed UTF-8 preserved in %q", gotCGJ)
	}

	// 5. Base64-encoded JSON null in DOSSIER_PRIVACY_DENYLIST fails closed
	t.Setenv("AI_PRIVACY_DENYLIST", "")
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", base64.StdEncoding.EncodeToString([]byte("null")))
	if _, nullErr := LoadConfigFromEnv(); nullErr == nil {
		t.Fatal("expected base64 JSON null in DOSSIER_PRIVACY_DENYLIST to fail closed")
	}

	// 6. Embedded NUL bytes in pasted JD/Q&A text are stripped cleanly before PostgreSQL persistence
	gotNul := RedactTextForStorage(cfgOverlap, "Staff\x00 Go \x00Engineer\x00 role", 1000)
	if strings.ContainsRune(gotNul, 0) {
		t.Fatalf("expected NUL bytes stripped from %q", gotNul)
	}
	if gotNul != "Staff Go Engineer role" {
		t.Fatalf("unexpected NUL-stripped output %q", gotNul)
	}
}
