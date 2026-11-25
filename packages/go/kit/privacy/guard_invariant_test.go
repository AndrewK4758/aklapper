package privacy

import (
	"encoding/base64"
	"errors"
	"math/rand/v2"
	"strings"
	"testing"
)

func runGuardPartition(t *testing.T, cfg *Config, chunks []string) (string, bool) {
	t.Helper()
	g := NewStreamGuard(cfg, "corr-invariant")
	var out strings.Builder
	for _, ch := range chunks {
		s, err := g.Process(ch)
		out.WriteString(s)
		if errors.Is(err, ErrPrivacyAborted) {
			return out.String(), true
		}
		if err != nil {
			t.Fatalf("Process(%q): %v", ch, err)
		}
	}
	tail, err := g.Flush()
	if errors.Is(err, ErrPrivacyAborted) {
		return out.String(), true
	}
	if err != nil {
		t.Fatalf("Flush: %v", err)
	}
	out.WriteString(tail)
	return out.String(), false
}

func randomRunePartitions(s string, rng *rand.Rand) []string {
	runes := []rune(s)
	var chunks []string
	for i := 0; i < len(runes); {
		step := 1 + rng.IntN(29)
		end := min(len(runes), i+step)
		chunks = append(chunks, string(runes[i:end]))
		i = end
	}
	return chunks
}

func TestLoadConfigEnforcesBoundedRegexMaxRuneCap(t *testing.T) {
	rejectCases := []struct {
		name  string
		entry string
	}{
		{name: "188-rune bounded regex exceeds 128 cap", entry: `["re:sk-proj-[A-Za-z0-9]{20,180}"]`},
		{name: "129-rune repeat exceeds 128 cap", entry: `["re:a{1,129}"]`},
		{name: "grouped repeat 200 runes exceeds 128 cap", entry: `["re:(?:ab){1,100}"]`},
		{name: "nested repeat 400 runes exceeds 128 cap", entry: `["re:(?:a{0,20}){0,20}"]`},
		{name: "escaped backslash followed by star is unbounded", entry: `["re:foo\\\\*"]`},
		{name: "open-ended repeat quantifier", entry: `["re:sk-[A-Za-z0-9]{8,}"]`},
		{name: "zero-width only regex", entry: `["re:\\b"]`},
		{name: "empty-string matching regex", entry: `["re:a{0,5}"]`},
	}
	for _, tc := range rejectCases {
		t.Run("reject_"+tc.name, func(t *testing.T) {
			if _, err := LoadConfig(ConfigInput{RawDenylist: tc.entry}); err == nil {
				t.Fatalf("expected LoadConfig to reject %s", tc.entry)
			}
		})
	}

	acceptCases := []string{
		`["re:a{1,128}"]`,
		`["re:sk-[A-Za-z0-9]{8,48}"]`,
		`["re:\\b[A-Z]{5,12}\\b"]`,
		`["re:(?m)^SECRET-[0-9]{4}$"]`,
	}
	for _, raw := range acceptCases {
		if _, err := LoadConfig(ConfigInput{RawDenylist: raw}); err != nil {
			t.Fatalf("expected LoadConfig to accept %s, got %v", raw, err)
		}
	}
}

func TestStreamGuardPriorityOrderAndLongStreamWordBoundaries(t *testing.T) {
	t.Run("higher-priority deferred rule blocks overlapping lower-priority rule", func(t *testing.T) {
		cfgRe, err := LoadConfig(ConfigInput{
			RawDenylist:    `["re:sk-[A-Za-z0-9]{8,48}","acme-sk"]`,
			DenylistAction: ActionRedact,
		})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		fullRe := "Configured acme-sk-SUPERSECRETKEY9999 in CI. " + strings.Repeat("Benign engineering prose continues cleanly across chunks. ", 5)
		wantRe, wantAb := runGuardPartition(t, cfgRe, []string{fullRe})
		if wantAb || strings.Contains(wantRe, "SUPERSECRETKEY9999") || !strings.HasPrefix(wantRe, "Configured acme-[REDACTED] in CI.") {
			t.Fatalf("unexpected single-shot result: aborted=%v got=%q", wantAb, wantRe)
		}
		for _, sz := range []int{1, 2, 3, 5, 7, 13, 31} {
			got, ab := runGuardPartition(t, cfgRe, splitRunes(fullRe, sz))
			if ab || got != wantRe {
				t.Fatalf("chunkSz=%d mismatch:\ngot:  %q\nwant: %q", sz, got, wantRe)
			}
		}

		cfgLit, err := LoadConfig(ConfigInput{
			RawDenylist:    `["Mercury-NDA","Project-Mercury"]`,
			DenylistAction: ActionRedact,
		})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		fullLit := "Delivered Project-Mercury-NDA cleanly. " + strings.Repeat("Additional portfolio summary text follows safely. ", 5)
		wantLit, _ := runGuardPartition(t, cfgLit, []string{fullLit})
		if strings.Contains(wantLit, "-NDA") || !strings.HasPrefix(wantLit, "Delivered Project-[REDACTED] cleanly.") {
			t.Fatalf("unexpected single-shot literal overlap: %q", wantLit)
		}
		for _, sz := range []int{1, 2, 3, 5, 7, 13} {
			got, ab := runGuardPartition(t, cfgLit, splitRunes(fullLit, sz))
			if ab || got != wantLit {
				t.Fatalf("literal overlap chunkSz=%d mismatch:\ngot:  %q\nwant: %q", sz, got, wantLit)
			}
		}
	})

	t.Run("long-stream flushes never create synthetic left-edge word boundaries", func(t *testing.T) {
		shortWordPrefix := strings.Repeat("go ok to do in it by us we on at ", 10)
		shortWordSuffix := strings.Repeat(" ok go to do in it by us we on at", 10)
		longPrefix := strings.Repeat("standard benign prose line for streaming flush verification ", 5)
		longSuffix := strings.Repeat(" trailing safe commentary after the test token ", 5)

		for _, action := range []Action{ActionRedact, ActionAbort} {
			cfgCfg, err := LoadConfig(ConfigInput{RawDenylist: `["re:\\b[A-Z]{5,12}\\b"]`, DenylistAction: action})
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			// Test both a normal 13-letter word (CONFIGURATION) and an 80-char unbroken word exceeding word-snap cap.
			full1 := shortWordPrefix + "CONFIGURATION " + strings.Repeat("A", 80) + shortWordSuffix
			for _, sz := range []int{1, 3, 7, 13, 31} {
				got, ab := runGuardPartition(t, cfgCfg, splitRunes(full1, sz))
				if ab || got != full1 {
					t.Fatalf("action=%s chunkSz=%d corrupted long-stream word: aborted=%v", action, sz, ab)
				}
			}

			cfgCaseSens, err := LoadConfig(ConfigInput{RawDenylist: `["re:(?-i)\\b[A-Z]{5,12}\\b"]`, DenylistAction: action})
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			fullCS := longPrefix + "CONFIGURATION " + strings.Repeat("A", 80) + longSuffix
			for _, sz := range []int{1, 3, 7, 13, 31} {
				got, ab := runGuardPartition(t, cfgCaseSens, splitRunes(fullCS, sz))
				if ab || got != fullCS {
					t.Fatalf("case-sensitive action=%s chunkSz=%d corrupted long-stream word: aborted=%v", action, sz, ab)
				}
			}

			cfgCat, err := LoadConfig(ConfigInput{RawDenylist: `["re:\\bCAT\\b"]`, DenylistAction: action})
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			full2 := longPrefix + "TOMCAT WILDCAT CONCAT CATALOG " + strings.Repeat("B", 72) + "CAT" + longSuffix
			for _, sz := range []int{1, 2, 5, 11, 29} {
				got, ab := runGuardPartition(t, cfgCat, splitRunes(full2, sz))
				if ab || got != full2 {
					t.Fatalf("action=%s chunkSz=%d false \\bCAT\\b match: aborted=%v", action, sz, ab)
				}
			}
		}
	})
}

func TestStreamGuardChunkSizeInvarianceDifferential(t *testing.T) {
	gcpHdr := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"3d4b8c1f2a9e7b6d5c4f3e2a1b0c9d8e7f6a5b4c","typ":"JWT"}`))
	gcpPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://accounts.google.com","sub":"109876543210"}`))
	gcpJWT := gcpHdr + "." + gcpPayload + "." + strings.Repeat("S", 342)

	proseA := strings.Repeat("This portfolio architecture runs Go gRPC and HTTP/2 SSE smoothly. ", 4)
	proseB := strings.Repeat("Observability logs correlate request IDs without leaking PII. ", 4)

	longRule0 := strings.Repeat("B", 50) + strings.Repeat("C", 50)
	longRule1 := strings.Repeat("A", 50) + strings.Repeat("B", 50)

	cases := []struct {
		name        string
		denylist    string
		action      Action
		input       string
		expectAbort bool
		forbid      []string
	}{
		{
			name:     "overlapping regex and literal on >300-rune stream",
			denylist: `["re:sk-[A-Za-z0-9]{8,48}","acme-sk"]`,
			action:   ActionRedact,
			input:    proseA + "Use acme-sk-SUPERSECRETKEY9999 and acme-sk alone. " + proseB,
		},
		{
			name:     "two 100-rune overlapping literals",
			denylist: `["` + longRule0 + `","` + longRule1 + `"]`,
			action:   ActionRedact,
			input:    proseA + strings.Repeat("A", 50) + strings.Repeat("B", 50) + strings.Repeat("C", 50) + " end. " + proseB,
		},
		{
			name:     "3-way transitive overlapping literals",
			denylist: `["CDEFGH","BCDE","ABCD"]`,
			action:   ActionRedact,
			input:    proseA + "ABCDEFGH and ABCDE and ABCD. " + proseB,
		},
		{
			name:     "word-bounded regex with benign compounds and true matches",
			denylist: `["re:\\bCAT\\b","re:\\b[A-Z]{5,12}\\b"]`,
			action:   ActionRedact,
			input:    proseA + "TOMCAT CATALOG CONFIGURATION CAT MERCURY " + strings.Repeat("Z", 75) + "CAT " + proseB,
		},
		{
			name:     "NFD combining marks and Unicode ligatures with regex",
			denylist: `["Cafe","re:\\bNDA-[0-9]{4}\\b"]`,
			action:   ActionRedact,
			input:    proseA + "Cafe\u0301 vs Cafe and \uFB01le NDA-2025 NDA-20259. " + proseB,
		},
		{
			name:     "128-rune max regex boundary",
			denylist: `["re:a{1,128}"]`,
			action:   ActionRedact,
			input:    proseA + strings.Repeat("a", 128) + " tail " + strings.Repeat("a", 130) + " " + proseB,
		},
		{
			name:     "multiline start-of-line and end-of-line anchors across flushed lines",
			denylist: `["re:(?m)^SECRET-[0-9]{3}$","re:^START"]`,
			action:   ActionRedact,
			input:    "START " + proseA + "\nSECRET-123\nSECRET-999x\nnot SECRET-456\nSTART again\n" + proseB,
		},
		{
			name:     "cascading word-boundary redaction after adjacent literal match",
			denylist: `["re:\\bCAT\\b","BAD"]`,
			action:   ActionRedact,
			input:    proseA + "CATBAD and BADCAT and TOMCAT. " + proseB,
		},
		{
			name:     "anchor-straddling denylist terms across long stream",
			denylist: `["https://internal.acme.com","SurveyJS-NDA","Faiza"]`,
			action:   ActionRedact,
			input:    proseA + "Contact Faiza on SurveyJS-NDA at https://internal.acme.com/docs today. " + proseB,
		},
		{
			name:        "split postgres credentialed URL aborts with zero secret leak",
			denylist:    `["postgres","Acme"]`,
			action:      ActionRedact,
			input:       proseA + "Connect postgres://acme_admin:Sup3rS3cr3tP4ss@db.internal:5432/app " + proseB,
			expectAbort: true,
			forbid:      []string{"Sup3rS3cr3tP4ss", "postgres://acme_admin"},
		},
		{
			name:        "split GCP OIDC JWT with EY denylist aborts with zero secret leak",
			denylist:    `["EY"]`,
			action:      ActionRedact,
			input:       proseA + "Bearer " + gcpJWT + " " + proseB,
			expectAbort: true,
			forbid:      []string{"eyJ", "accounts.google.com"},
		},
	}

	fixedSizes := []int{1, 2, 3, 5, 7, 13, 31}
	rng := rand.New(rand.NewPCG(42, 99))

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := LoadConfig(ConfigInput{
				RawDenylist:    tc.denylist,
				DenylistAction: tc.action,
				SecretAction:   ActionAbort,
			})
			if err != nil {
				t.Fatalf("LoadConfig: %v", err)
			}
			wantOut, wantAborted := runGuardPartition(t, cfg, []string{tc.input})
			if wantAborted != tc.expectAbort {
				t.Fatalf("single-shot aborted=%v want=%v out=%q", wantAborted, tc.expectAbort, wantOut)
			}

			verifyPartition := func(label string, chunks []string) {
				gotOut, gotAborted := runGuardPartition(t, cfg, chunks)
				if gotAborted != wantAborted {
					t.Fatalf("%s: aborted=%v want=%v (out=%q)", label, gotAborted, wantAborted, gotOut)
				}
				if !wantAborted {
					if gotOut != wantOut {
						t.Fatalf("%s: output diverged from single-shot:\ngot:  %q\nwant: %q", label, gotOut, wantOut)
					}
					return
				}
				for _, bad := range tc.forbid {
					if strings.Contains(gotOut, bad) {
						t.Fatalf("%s: leaked forbidden substring %q before abort: %q", label, bad, gotOut)
					}
				}
			}

			for _, sz := range fixedSizes {
				verifyPartition("fixed", splitRunes(tc.input, sz))
			}
			for trial := 0; trial < 20; trial++ {
				verifyPartition("random", randomRunePartitions(tc.input, rng))
			}
		})
	}
}
