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
