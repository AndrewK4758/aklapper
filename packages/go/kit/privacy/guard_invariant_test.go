package privacy

import (
	"encoding/base64"
	"errors"
	"log"
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

func runGuardPartitionWithLogs(t *testing.T, cfg *Config, chunks []string) (string, bool, int) {
	t.Helper()
	var buf strings.Builder
	prev := log.Writer()
	log.SetOutput(&buf)
	defer log.SetOutput(prev)

	out, aborted := runGuardPartition(t, cfg, chunks)
	events := strings.Count(buf.String(), `"event":"privacy.stream_guard.triggered"`)
	return out, aborted, events
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

func TestLoadConfigContextFreeFiniteRegexGate(t *testing.T) {
	rejectCases := []struct {
		name  string
		entry string
	}{
		{name: "word boundary \\b", entry: `["re:\\bCAT\\b"]`},
		{name: "non-word boundary \\B", entry: `["re:\\BSECRET"]`},
		{name: "caret anchor ^", entry: `["re:^SECRET"]`},
		{name: "dollar anchor $", entry: `["re:SECRET$"]`},
		{name: "start of text \\A", entry: `["re:\\ASECRET"]`},
		{name: "end of text \\z", entry: `["re:SECRET\\z"]`},
		{name: "multiline start (?m)^", entry: `["re:(?m)^SECRET"]`},
		{name: "multiline end (?m)$", entry: `["re:(?m)SECRET$"]`},
		{name: "zero-repeat anchored subexpr", entry: `["re:(?:\\b){0}SECRET"]`},
		{name: "word-bounded empty-matchable regex", entry: `["re:\\b[A-Z]{0,12}\\b"]`},
		{name: "word-boundary alternation", entry: `["re:(?:\\b|SECRET)"]`},
		{name: "empty-matchable repeat", entry: `["re:a{0,5}"]`},
		{name: "empty-matchable optional", entry: `["re:(?:SECRET)?"]`},
		{name: "empty-matchable alternation", entry: `["re:(?:|SECRET)"]`},
		{name: "unsatisfiable char class", entry: `["re:[^\\s\\S]"]`},
		{name: "188-rune bounded regex exceeds 128 cap", entry: `["re:sk-proj-[A-Za-z0-9]{20,180}"]`},
		{name: "129-rune repeat exceeds 128 cap", entry: `["re:a{1,129}"]`},
		{name: "grouped repeat 200 runes exceeds 128 cap", entry: `["re:(?:ab){1,100}"]`},
		{name: "nested repeat 400 runes exceeds 128 cap", entry: `["re:(?:a{0,20}){0,20}"]`},
		{name: "escaped backslash followed by star is unbounded", entry: `["re:foo\\\\*"]`},
		{name: "unbounded inside zero repeat", entry: `["re:(?:a*){0}foo"]`},
		{name: "open-ended repeat quantifier", entry: `["re:sk-[A-Za-z0-9]{8,}"]`},
	}
	for _, tc := range rejectCases {
		t.Run("reject_"+tc.name, func(t *testing.T) {
			if _, err := LoadConfig(ConfigInput{RawDenylist: tc.entry}); err == nil {
				t.Fatalf("expected LoadConfig to reject %s", tc.entry)
			}
		})
	}

	t.Run("syntax error does not echo secret regex text", func(t *testing.T) {
		_, err := LoadConfig(ConfigInput{RawDenylist: `["re:(SUPER_SECRET_CLIENT_PATTERN"]`})
		if err == nil {
			t.Fatal("expected syntax error")
		}
		if strings.Contains(err.Error(), "SUPER_SECRET_CLIENT_PATTERN") {
			t.Fatalf("error echoed raw denylist pattern: %v", err)
		}
	})

	acceptCases := []string{
		`["re:a{1,128}"]`,
		`["re:sk-[A-Za-z0-9]{8,48}"]`,
		`["re:(?-i)[A-Z]{5,12}"]`,
		`["re:NDA-[0-9]{4}"]`,
	}
	for _, raw := range acceptCases {
		if _, err := LoadConfig(ConfigInput{RawDenylist: raw}); err != nil {
			t.Fatalf("expected LoadConfig to accept %s, got %v", raw, err)
		}
	}
}

func TestStreamGuardEmbeddedSecretsAndActionRedactInvariance(t *testing.T) {
	gcpHdr := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"RS256","kid":"3d4b8c1f2a9e7b6d5c4f3e2a1b0c9d8e7f6a5b4c","typ":"JWT"}`))
	gcpPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"iss":"https://accounts.google.com","sub":"109876543210","aud":"https://ai-ask.example"}`))
	gcpJWT := gcpHdr + "." + gcpPayload + "." + strings.Repeat("S", 342)
	prose := strings.Repeat("Benign streaming portfolio prose about Go services. ", 4)

	t.Run("embedded github_token and credentialed_url abort fail-closed regardless of prefix", func(t *testing.T) {
		cfg, err := LoadConfig(ConfigInput{SecretAction: ActionAbort})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		embedded := []struct {
			name   string
			input  string
			forbid string
		}{
			{name: "token=ghp_", input: prose + "token=ghp_" + strings.Repeat("A", 36) + " end " + prose, forbid: "ghp_"},
			{name: "long word prefix + ghp_", input: prose + strings.Repeat("a", 64) + "ghp_" + strings.Repeat("b", 36) + " " + prose, forbid: "ghp_"},
			{name: "url=postgres://", input: prose + "url=postgres://admin:S3cr3tP4ss@db.internal:5432/app " + prose, forbid: "S3cr3tP4ss"},
			{name: "long word prefix + https://", input: prose + strings.Repeat("a", 64) + "https://u:Sup3rPass@h.co/x " + prose, forbid: "Sup3rPass"},
		}
		for _, tc := range embedded {
			t.Run(tc.name, func(t *testing.T) {
				for _, sz := range []int{len([]rune(tc.input)), 1, 3, 7, 13, 31} {
					out, ab := runGuardPartition(t, cfg, splitRunes(tc.input, sz))
					if !ab {
						t.Fatalf("chunkSz=%d expected abort, got %q", sz, out)
					}
					if strings.Contains(out, tc.forbid) {
						t.Fatalf("chunkSz=%d leaked %q before abort: %q", sz, tc.forbid, out)
					}
				}
			})
		}
	})

	t.Run("SecretAction ActionRedact redacts long JWT, URL, and PAT identically across chunk sizes", func(t *testing.T) {
		cfg, err := LoadConfig(ConfigInput{SecretAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		inputs := []string{
			prose + "Bearer " + gcpJWT + " done. " + prose,
			prose + "url=postgres://user_name_123:Sup3rS3cr3tP4ssw0rd@db.prod.internal:5432/portfolio end. " + prose,
			prose + "key=github_pat_" + strings.Repeat("Z", 82) + " ok. " + prose,
		}
		for _, full := range inputs {
			want, wantAb, wantLogs := runGuardPartitionWithLogs(t, cfg, []string{full})
			if wantAb || !strings.Contains(want, RedactionPlaceholder) || strings.Contains(want, "eyJ") || strings.Contains(want, "Sup3rS3cr3t") || strings.Contains(want, "github_pat_") {
				t.Fatalf("unexpected single-shot secret redact: ab=%v logs=%d got=%q", wantAb, wantLogs, want)
			}
			for _, sz := range []int{1, 2, 3, 5, 7, 13, 29, 31} {
				got, ab, logs := runGuardPartitionWithLogs(t, cfg, splitRunes(full, sz))
				if ab || got != want || logs != wantLogs {
					t.Fatalf("chunkSz=%d mismatch: ab=%v logs=%d (want %d)\ngot:  %q\nwant: %q", sz, ab, logs, wantLogs, got, want)
				}
			}
		}
	})
}

func TestStreamGuardIntervalUnionOverlapAndDoSBound(t *testing.T) {
	prose := strings.Repeat("Additional portfolio summary text follows safely. ", 5)

	t.Run("overlapping rules merge into single placeholder with identical audit count", func(t *testing.T) {
		cases := []struct {
			name     string
			denylist string
			input    string
			wantPart string
			forbid   string
		}{
			{
				name:     "regex + literal overlap",
				denylist: `["re:sk-[A-Za-z0-9]{8,48}","acme-sk"]`,
				input:    "Configured acme-sk-SUPERSECRETKEY9999 in CI. " + prose,
				wantPart: "Configured [REDACTED] in CI.",
				forbid:   "SUPERSECRETKEY9999",
			},
			{
				name:     "overlapping literals",
				denylist: `["Mercury-NDA","Project-Mercury"]`,
				input:    "Delivered Project-Mercury-NDA cleanly. " + prose,
				wantPart: "Delivered [REDACTED] cleanly.",
				forbid:   "Mercury",
			},
			{
				name:     "self-overlapping literal aba on ababa",
				denylist: `["aba"]`,
				input:    "Token ababa ok. " + prose,
				wantPart: "Token [REDACTED] ok.",
				forbid:   "aba",
			},
			{
				name:     "adjacent non-overlapping rules stay distinct",
				denylist: `["BAD","CAT"]`,
				input:    "See BADCAT here. " + prose,
				wantPart: "See [REDACTED][REDACTED] here.",
				forbid:   "BAD",
			},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				cfg, err := LoadConfig(ConfigInput{RawDenylist: tc.denylist, DenylistAction: ActionRedact})
				if err != nil {
					t.Fatalf("LoadConfig: %v", err)
				}
				want, wantAb, wantLogs := runGuardPartitionWithLogs(t, cfg, []string{tc.input})
				if wantAb || !strings.Contains(want, tc.wantPart) || strings.Contains(want, tc.forbid) {
					t.Fatalf("unexpected single-shot: ab=%v got=%q", wantAb, want)
				}
				for _, sz := range []int{1, 2, 3, 5, 7, 13, 31} {
					got, ab, logs := runGuardPartitionWithLogs(t, cfg, splitRunes(tc.input, sz))
					if ab || got != want || logs != wantLogs {
						t.Fatalf("chunkSz=%d mismatch: ab=%v logs=%d (want %d)\ngot:  %q\nwant: %q", sz, ab, logs, wantLogs, got, want)
					}
				}
			})
		}
	})

	t.Run("adversarial >4096-rune overlap chain aborts identically while 10000-rune benign single-shot passes", func(t *testing.T) {
		cfg, err := LoadConfig(ConfigInput{RawDenylist: `["re:a{2,5}"]`, DenylistAction: ActionRedact})
		if err != nil {
			t.Fatalf("LoadConfig: %v", err)
		}
		attack := strings.Repeat("a", maxRawPendingRunes+32)
		if _, ab := runGuardPartition(t, cfg, []string{attack}); !ab {
			t.Fatal("expected single-shot >4096-rune overlap chain to abort fail-closed")
		}
		if _, ab := runGuardPartition(t, cfg, splitRunes(attack, 17)); !ab {
			t.Fatal("expected streaming >4096-rune overlap chain to abort fail-closed")
		}

		benign := strings.Repeat("Go streaming text without forbidden runs. ", 250)
		got, ab := runGuardPartition(t, cfg, []string{benign})
		if ab || got != benign {
			t.Fatalf("10000-rune benign single-shot text failed: ab=%v len=%d", ab, len(got))
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
			name:     "NFD combining marks, ligatures, and separator-flooded literal + regex overlap",
			denylist: `["Cafe","AcmeCorp","re:NDA-[0-9]{4}"]`,
			action:   ActionRedact,
			input:    proseA + "Cafe\u0301 vs Cafe and A" + strings.Repeat("\u200B", 19) + "cmeCorp \uFB01le NDA-2025. " + proseB,
		},
		{
			name:     "128-rune max regex boundary",
			denylist: `["re:a{1,128}"]`,
			action:   ActionRedact,
			input:    proseA + strings.Repeat("a", 128) + " tail " + strings.Repeat("a", 130) + " " + proseB,
		},
		{
			name:     "anchor-straddling denylist terms across long stream",
			denylist: `["https://internal.acme.com","SurveyJS-NDA","Faiza"]`,
			action:   ActionRedact,
			input:    proseA + "Contact Faiza on SurveyJS-NDA at https://internal.acme.com/docs today. " + proseB,
		},
		{
			name:        "ActionAbort on anchor-straddling denylist term with zero leak",
			denylist:    `["Faiza","https://internal.acme.com"]`,
			action:      ActionAbort,
			input:       proseA + "Contact Faiza at https://internal.acme.com/docs today. " + proseB,
			expectAbort: true,
			forbid:      []string{"Faiza", "internal.acme.com"},
		},
		{
			name:        "ActionAbort on NFD Cafe\\u0301 does not false-abort",
			denylist:    `["Cafe"]`,
			action:      ActionAbort,
			input:       proseA + "Visited Cafe\u0301 yesterday. " + proseB,
			expectAbort: false,
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

	fixedSizes := []int{1, 2, 3, 5, 7, 13, 29, 31}
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
			wantOut, wantAborted, wantLogs := runGuardPartitionWithLogs(t, cfg, []string{tc.input})
			if wantAborted != tc.expectAbort {
				t.Fatalf("single-shot aborted=%v want=%v out=%q", wantAborted, tc.expectAbort, wantOut)
			}

			verifyPartition := func(label string, chunks []string) {
				gotOut, gotAborted, gotLogs := runGuardPartitionWithLogs(t, cfg, chunks)
				if gotAborted != wantAborted {
					t.Fatalf("%s: aborted=%v want=%v (out=%q)", label, gotAborted, wantAborted, gotOut)
				}
				if !wantAborted {
					if gotOut != wantOut || gotLogs != wantLogs {
						t.Fatalf("%s: diverged from single-shot (logs=%d want=%d):\ngot:  %q\nwant: %q", label, gotLogs, wantLogs, gotOut, wantOut)
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
			for trial := 0; trial < 25; trial++ {
				verifyPartition("random", randomRunePartitions(tc.input, rng))
			}
		})
	}
}
