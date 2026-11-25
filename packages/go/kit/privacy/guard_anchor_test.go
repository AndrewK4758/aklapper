package privacy

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

func TestStreamGuardAnchorBoundaryDenylistAndSplitPrefixSecrets(t *testing.T) {
	t.Run("denylist terms containing secret anchor substrings never split or bypass under ActionRedact or ActionAbort", func(t *testing.T) {
		cases := []struct {
			name     string
			denylist string
			input    string
			chunkSz  int
			action   Action
			needle   string
		}{
			{
				name:     "SurveyJS single-chunk ActionRedact",
				denylist: `["SurveyJS-NDA"]`,
				input:    "Built the SurveyJS-NDA portal for a healthcare client across multiple business units.",
				chunkSz:  0,
				action:   ActionRedact,
				needle:   "SurveyJS",
			},
			{
				name:     "Faiza single-chunk ActionRedact",
				denylist: `["Faiza"]`,
				input:    "Client contact Faiza leads the confidential acquisition program across multiple business units.",
				chunkSz:  0,
				action:   ActionRedact,
				needle:   "Faiza",
			},
			{
				name:     "Faiza single-chunk ActionAbort",
				denylist: `["Faiza"]`,
				input:    "Client contact Faiza leads the confidential acquisition program across multiple business units.",
				chunkSz:  0,
				action:   ActionAbort,
				needle:   "Faiza",
			},
			{
				name:     "ftp://secret.corp single-chunk ActionRedact",
				denylist: `["ftp://secret.corp"]`,
				input:    "Transfer files to ftp://secret.corp/archive when preparing quarterly releases for the team.",
				chunkSz:  0,
				action:   ActionRedact,
				needle:   "secret.corp",
			},
			{
				name:     "https://internal.acme.com 4-rune stream >128 trailing prose ActionRedact",
				denylist: `["https://internal.acme.com"]`,
				input:    "See https://internal.acme.com/docs for architecture notes. " + strings.Repeat("This is benign portfolio prose about Go streaming services. ", 4),
				chunkSz:  4,
				action:   ActionRedact,
				needle:   "internal.acme.com",
			},
			{
				name:     "https://internal.acme.com 4-rune stream >128 trailing prose ActionAbort",
				denylist: `["https://internal.acme.com"]`,
				input:    "See https://internal.acme.com/docs for architecture notes. " + strings.Repeat("This is benign portfolio prose about Go streaming services. ", 4),
				chunkSz:  4,
				action:   ActionAbort,
				needle:   "internal.acme.com",
			},
			{
				name:     "postgres://prod 4-rune stream >128 trailing prose ActionRedact",
				denylist: `["postgres://prod"]`,
				input:    "Do not connect to postgres://prod.internal:5432 directly. " + strings.Repeat("Standard deployment documentation follows here safely. ", 4),
				chunkSz:  4,
				action:   ActionRedact,
				needle:   "postgres://prod",
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				cfg, err := LoadConfig(ConfigInput{
					RawDenylist:    tc.denylist,
					DenylistAction: tc.action,
				})
				if err != nil {
					t.Fatalf("LoadConfig: %v", err)
				}
				guard := NewStreamGuard(cfg, "corr-anchor-denylist")
				var emitted strings.Builder
				aborted := false

				runes := []rune(tc.input)
				step := tc.chunkSz
				if step <= 0 {
					step = len(runes)
				}
				for i := 0; i < len(runes); i += step {
					chunk := string(runes[i:min(len(runes), i+step)])
					out, procErr := guard.Process(chunk)
					emitted.WriteString(out)
					if errors.Is(procErr, ErrPrivacyAborted) {
						aborted = true
						break
					}
					if procErr != nil {
						t.Fatalf("unexpected Process error: %v", procErr)
					}
				}
				if !aborted {
					tail, flushErr := guard.Flush()
					if errors.Is(flushErr, ErrPrivacyAborted) {
						aborted = true
					} else if flushErr != nil {
						t.Fatalf("unexpected Flush error: %v", flushErr)
					} else {
						emitted.WriteString(tail)
					}
				}

				got := emitted.String()
				if strings.Contains(got, tc.needle) {
					t.Fatalf("denylist term %q leaked unredacted: %q", tc.needle, got)
				}
				if tc.action == ActionAbort {
					if !aborted {
						t.Fatalf("expected ActionAbort ErrPrivacyAborted, emitted %q", got)
					}
				} else if !strings.Contains(got, RedactionPlaceholder) {
					t.Fatalf("expected %s in output, got %q", RedactionPlaceholder, got)
				}
			})
		}
	})

	t.Run("denylist matching split secret-anchor prefixes leaks zero secret runes before abort", func(t *testing.T) {
		gcpHdr := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"3d4b8c1f2a9e7b6d5c4f3e2a1b0c9d8e7f6a5b4c","typ":"JWT"}`))
		gcpPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://accounts.google.com","sub":"109876543210"}`))
		gcpJWT := gcpHdr + "." + gcpPayload + "." + strings.Repeat("S", 342)

		cases := []struct {
			name     string
			denylist string
			chunks   []string
			forbid   []string
		}{
			{
				name:     "EY denylist with 8-rune-chunked real GCP OIDC JWT",
				denylist: `["EY"]`,
				chunks:   splitRunes("Auth: "+gcpJWT, 8),
				forbid:   []string{"eyJ", "JhbGci", "RS256", "accounts.google"},
			},
			{
				name:     "AI denylist with 3-chunk Google API key",
				denylist: `["AI"]`,
				chunks:   []string{"Key is AI", "zaSyB12345678901234567890123456789", "012345"},
				forbid:   []string{"AIza", "zaSyB", "123456"},
			},
			{
				name:     "ghp denylist with split classic GitHub PAT",
				denylist: `["ghp"]`,
				chunks:   []string{"Token: ghp", "_AbCdEfGhIjKlMnOpQrStUvWxYz012345678", "9 done"},
				forbid:   []string{"ghp_", "_AbCd", "EfGhI"},
			},
			{
				name:     "github denylist with 8-rune-chunked fine-grained GitHub PAT",
				denylist: `["github"]`,
				chunks:   splitRunes("Use token github_pat_11ABCDEFGH0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN", 8),
				forbid:   []string{"github_pat_", "_pat_", "11ABC"},
			},
		}

		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				cfg, err := LoadConfig(ConfigInput{
					RawDenylist:    tc.denylist,
					DenylistAction: ActionRedact,
					SecretAction:   ActionAbort,
				})
				if err != nil {
					t.Fatalf("LoadConfig: %v", err)
				}
				guard := NewStreamGuard(cfg, "corr-split-anchor-prefix")
				var emitted strings.Builder
				aborted := false
				for _, ch := range tc.chunks {
					out, procErr := guard.Process(ch)
					emitted.WriteString(out)
					if errors.Is(procErr, ErrPrivacyAborted) {
						aborted = true
						break
					}
					if procErr != nil {
						t.Fatalf("unexpected Process error: %v", procErr)
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
					t.Fatalf("expected ErrPrivacyAborted, emitted=%q", emitted.String())
				}
				for _, bad := range tc.forbid {
					if strings.Contains(emitted.String(), bad) {
						t.Fatalf("leaked secret fragment %q prior to abort: emitted=%q", bad, emitted.String())
					}
				}
			})
		}
	})
}

func splitRunes(s string, size int) []string {
	runes := []rune(s)
	var out []string
	for i := 0; i < len(runes); i += size {
		out = append(out, string(runes[i:min(len(runes), i+size)]))
	}
	return out
}

func TestStreamGuardDeferredCommitPreservesRegexWordBoundsOverlapsAndNFD(t *testing.T) {
	runChunks := func(t *testing.T, denylist string, action Action, chunks []string) (string, bool) {
		t.Helper()
		cfg, err := LoadConfig(ConfigInput{RawDenylist: denylist, DenylistAction: action})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		g := NewStreamGuard(cfg, "corr-deferred-commit")
		var out strings.Builder
		for _, ch := range chunks {
			s, pErr := g.Process(ch)
			out.WriteString(s)
			if errors.Is(pErr, ErrPrivacyAborted) {
				return out.String(), true
			}
			if pErr != nil {
				t.Fatalf("Process: %v", pErr)
			}
		}
		tail, fErr := g.Flush()
		if errors.Is(fErr, ErrPrivacyAborted) {
			return out.String(), true
		}
		if fErr != nil {
			t.Fatalf("Flush: %v", fErr)
		}
		out.WriteString(tail)
		return out.String(), false
	}

	t.Run("variable-length bounded regexes never truncate sensitive suffixes", func(t *testing.T) {
		got1, ab1 := runChunks(t, `["re:sk-[A-Za-z0-9]{8,48}"]`, ActionRedact, []string{"Use key sk-SUPERSECRETKEY9999."})
		if ab1 || got1 != "Use key [REDACTED]." {
			t.Fatalf("single-chunk API key truncated: aborted=%v got=%q", ab1, got1)
		}
		got2, ab2 := runChunks(t, `["re:sk-[A-Za-z0-9]{8,48}"]`, ActionRedact, []string{
			"Here is the API key: ", "sk-SUPERSECRETKEY9999", " for staging use only. ",
			strings.Repeat("Additional benign portfolio documentation prose streaming cleanly. ", 4),
		})
		if ab2 || !strings.HasPrefix(got2, "Here is the API key: [REDACTED] for staging use only. ") || strings.Contains(got2, "SECRETKEY") {
			t.Fatalf("long word-chunked API key truncated: aborted=%v got=%q", ab2, got2)
		}
		got3, ab3 := runChunks(t, `["re:\\bPROJECT-[A-Z0-9]{2,16}\\b"]`, ActionRedact, []string{"Worked on PROJECT-MERCURY2025 today."})
		if ab3 || got3 != "Worked on [REDACTED] today." {
			t.Fatalf("project code truncated: aborted=%v got=%q", ab3, got3)
		}
	})

	t.Run("ordered overlapping literals prefer longer earlier rule without leaking suffix", func(t *testing.T) {
		got, ab := runChunks(t, `["Project-Mercury-NDA","Project-Mercury"]`, ActionRedact, []string{
			"Worked on Project-Mercury-NDA with the team.",
		})
		if ab || got != "Worked on [REDACTED] with the team." {
			t.Fatalf("overlapping literal leaked suffix: aborted=%v got=%q", ab, got)
		}
	})

	t.Run("word-bounded regexes and NFD combining marks never suffer false boundary cuts at n-16", func(t *testing.T) {
		gotCatR, abCatR := runChunks(t, `["re:\\bCAT\\b"]`, ActionRedact, []string{"Check the CATALOG for details"})
		if abCatR || gotCatR != "Check the CATALOG for details" {
			t.Fatalf("false word boundary corrupted CATALOG (ActionRedact): aborted=%v got=%q", abCatR, gotCatR)
		}
		gotCatA, abCatA := runChunks(t, `["re:\\bCAT\\b"]`, ActionAbort, []string{"Check the CATALOG for details"})
		if abCatA || gotCatA != "Check the CATALOG for details" {
			t.Fatalf("false word boundary aborted CATALOG (ActionAbort): aborted=%v got=%q", abCatA, gotCatA)
		}
		gotCfg, abCfg := runChunks(t, `["re:\\b[A-Z]{5,12}\\b"]`, ActionRedact, []string{
			"Loaded ", "CONFIGURATION ", "values cleanly.",
		})
		if abCfg || !strings.Contains(gotCfg, "CONFIGURATION") {
			t.Fatalf("13-letter CONFIGURATION falsely mangled: aborted=%v got=%q", abCfg, gotCfg)
		}
		gotNfdR, abNfdR := runChunks(t, `["Cafe"]`, ActionRedact, []string{"Visited the Cafe\u0301 yesterday noon"})
		if abNfdR || gotNfdR != "Visited the Cafe\u0301 yesterday noon" {
			t.Fatalf("NFD Cafe\\u0301 corrupted (ActionRedact): aborted=%v got=%q", abNfdR, gotNfdR)
		}
		gotNfdA, abNfdA := runChunks(t, `["Cafe"]`, ActionAbort, []string{"Visited the Cafe\u0301 yesterday noon"})
		if abNfdA || gotNfdA != "Visited the Cafe\u0301 yesterday noon" {
			t.Fatalf("NFD Cafe\\u0301 falsely aborted (ActionAbort): aborted=%v got=%q", abNfdA, gotNfdA)
		}
	})
}
