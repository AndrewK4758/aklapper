package privacy

import (
	"errors"
	"strings"
	"testing"
)

func TestStreamGuardImmutablePreScanAndFailClosedFloodBounds(t *testing.T) {
	pem := "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7V5kSecretPrivateKeyMaterial\n-----END RSA PRIVATE KEY-----\n"

	t.Run("long whitespace before PEM never strips dashes and always aborts with zero leak", func(t *testing.T) {
		configs := []struct {
			name     string
			denylist string
		}{
			{name: "empty denylist", denylist: ""},
			{name: "active literal denylist", denylist: `["AcmeCorp"]`},
		}
		payloads := []struct {
			name string
			text string
		}{
			{name: "4100 spaces before PEM", text: strings.Repeat(" ", 4100) + pem},
			{name: "124 spaces before PEM + 4100 safe tail", text: strings.Repeat(" ", 124) + pem + strings.Repeat("safe ", 820)},
			{name: "A + 4096 spaces before PEM", text: "A" + strings.Repeat(" ", 4096) + pem},
		}
		for _, cc := range configs {
			cfg, err := LoadConfig(ConfigInput{RawDenylist: cc.denylist, DenylistAction: ActionRedact, SecretAction: ActionAbort})
			if err != nil {
				t.Fatalf("LoadConfig(%s): %v", cc.name, err)
			}
			for _, pc := range payloads {
				for _, sz := range []int{len([]rune(pc.text)), 16} {
					out, ab := runGuardPartition(t, cfg, splitRunes(pc.text, sz))
					if !ab {
						t.Fatalf("%s / %s / sz=%d: expected ErrPrivacyAborted, leaked len=%d", cc.name, pc.name, sz, len(out))
					}
					if strings.Contains(out, "BEGIN RSA") || strings.Contains(out, "SecretPrivateKeyMaterial") {
						t.Fatalf("%s / %s / sz=%d: leaked private key material before abort", cc.name, pc.name, sz)
					}
				}
			}
		}
	})

	t.Run("separator-prefixed regex denylist never loses leading hyphen", func(t *testing.T) {
		for _, action := range []Action{ActionRedact, ActionAbort} {
			cfg, err := LoadConfig(ConfigInput{
				RawDenylist:    `["AcmeCorp","re:-[A-Z]{4,16}"]`,
				DenylistAction: action,
			})
			if err != nil {
				t.Fatalf("LoadConfig(%s): %v", action, err)
			}
			// Within holdback budget: must redact or abort cleanly, never leaking TOPSECRET.
			inBudget := strings.Repeat(" ", 128) + "-TOPSECRET " + strings.Repeat("x", 4000)
			want, wantAb, wantLogs := runGuardPartitionWithLogs(t, cfg, []string{inBudget})
			if strings.Contains(want, "TOPSECRET") {
				t.Fatalf("action=%s single-shot leaked TOPSECRET", action)
			}
			if (action == ActionAbort) != wantAb {
				t.Fatalf("action=%s unexpected single-shot abort=%v", action, wantAb)
			}
			for _, sz := range []int{1, 16, 256} {
				got, ab, logs := runGuardPartitionWithLogs(t, cfg, splitRunes(inBudget, sz))
				if strings.Contains(got, "TOPSECRET") {
					t.Fatalf("action=%s sz=%d leaked TOPSECRET", action, sz)
				}
				if ab != wantAb || (!wantAb && (got != want || logs != wantLogs)) {
					t.Fatalf("action=%s sz=%d diverged from single-shot: ab=%v/%v logs=%d/%d", action, sz, ab, wantAb, logs, wantLogs)
				}
			}

			// Over 4096-rune separator flood: must fail closed with zero TOPSECRET leakage.
			flood := "A" + strings.Repeat(" ", 4095) + "-TOPSECRET done"
			for _, sz := range []int{len([]rune(flood)), 16} {
				got, ab := runGuardPartition(t, cfg, splitRunes(flood, sz))
				if !ab || strings.Contains(got, "TOPSECRET") {
					t.Fatalf("action=%s flood sz=%d expected fail-closed abort without leak, ab=%v", action, sz, ab)
				}
			}
		}
	})

	t.Run("benign >4096-rune text with 150-space and 300-hyphen runs stays byte-for-byte invariant", func(t *testing.T) {
		cfgEmpty, err := LoadConfig(ConfigInput{})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		benign := "Header:" + strings.Repeat(" ", 150) + "Body " + strings.Repeat("x", 4000)
		want, wantAb := runGuardPartition(t, cfgEmpty, []string{benign})
		if wantAb || want != benign {
			t.Fatalf("benign >4096-rune single-shot altered text: ab=%v len=%d want=%d", wantAb, len(want), len(benign))
		}
		for _, sz := range []int{1, 16, 256} {
			got, ab := runGuardPartition(t, cfgEmpty, splitRunes(benign, sz))
			if ab || got != benign {
				t.Fatalf("benign sz=%d diverged: ab=%v len=%d want=%d", sz, ab, len(got), len(benign))
			}
		}

		cfgHyphen, err := LoadConfig(ConfigInput{RawDenylist: `["re:a-{127}","re:-{127}b"]`, DenylistAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		hyphenText := "a" + strings.Repeat("-", 300) + "b" + strings.Repeat("x", 4000)
		wantH, wantHAb, wantHLogs := runGuardPartitionWithLogs(t, cfgHyphen, []string{hyphenText})
		if wantHAb || wantHLogs != 2 {
			t.Fatalf("expected 2 non-overlapping redactions, ab=%v logs=%d", wantHAb, wantHLogs)
		}
		for _, sz := range []int{1, 7, 31, 500} {
			gotH, abH, logsH := runGuardPartitionWithLogs(t, cfgHyphen, splitRunes(hyphenText, sz))
			if abH || gotH != wantH || logsH != wantHLogs {
				t.Fatalf("hyphen sz=%d diverged: ab=%v logs=%d/%d len=%d/%d", sz, abH, logsH, wantHLogs, len(gotH), len(wantH))
			}
		}
	})

	t.Run("combining-mark, NFKC-separator, and multi-gap floods abort identically in single-shot and streaming", func(t *testing.T) {
		cases := []struct {
			name     string
			denylist string
			input    string
		}{
			{name: "combining-mark flood empty denylist", denylist: "", input: "a" + strings.Repeat("\u0301", 5000) + " tail"},
			{name: "NFKC fullwidth underscore flood", denylist: `["Acme"]`, input: "A" + strings.Repeat("\uFF3F", 5000) + "cme"},
			{name: "multi-gap 2500+2500 space flood", denylist: `["AB"]`, input: "A" + strings.Repeat(" ", 2500) + "X" + strings.Repeat(" ", 2500) + "Y"},
		}
		for _, tc := range cases {
			cfg, err := LoadConfig(ConfigInput{RawDenylist: tc.denylist, DenylistAction: ActionRedact})
			if err != nil {
				t.Fatalf("LoadConfig(%s): %v", tc.name, err)
			}
			for _, sz := range []int{len([]rune(tc.input)), 16} {
				if _, ab := runGuardPartition(t, cfg, splitRunes(tc.input, sz)); !ab {
					t.Fatalf("%s sz=%d: expected fail-closed ErrPrivacyAborted", tc.name, sz)
				}
			}
		}
	})
}

func TestStreamGuardActionAbortSelfOverlappingAbortsMidStream(t *testing.T) {
	cases := []struct {
		name     string
		denylist string
		payload  string
	}{
		{name: "literal aa", denylist: `["aa"]`, payload: strings.Repeat("a", 6000)},
		{name: "literal aba", denylist: `["aba"]`, payload: strings.Repeat("ab", 3000) + "a"},
		{name: "regex a{2,5}", denylist: `["re:a{2,5}"]`, payload: strings.Repeat("a", 6000)},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := LoadConfig(ConfigInput{RawDenylist: tc.denylist, DenylistAction: ActionAbort})
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			g := NewStreamGuard(cfg, "corr-abort-midstream")
			abortedAt := -1
			runesFed := 0
			for _, ch := range splitRunes(tc.payload, 10) {
				runesFed += len([]rune(ch))
				out, pErr := g.Process(ch)
				if out != "" {
					t.Fatalf("leaked output %q before abort at %d runes", out, runesFed)
				}
				if errors.Is(pErr, ErrPrivacyAborted) {
					abortedAt = runesFed
					break
				}
				if pErr != nil {
					t.Fatalf("unexpected error: %v", pErr)
				}
			}
			if abortedAt < 0 || abortedAt > 64 {
				t.Fatalf("expected immediate mid-stream abort <= 64 runes, got abortedAt=%d", abortedAt)
			}
		})
	}
}
