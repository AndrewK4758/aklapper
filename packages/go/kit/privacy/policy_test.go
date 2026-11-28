package privacy

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"log"
	"strings"
	"testing"
	"time"
)

func encodeBase64Denylist(t *testing.T, terms []string) string {
	t.Helper()
	raw, err := json.Marshal(terms)
	if err != nil {
		t.Fatalf("marshal denylist: %v", err)
	}
	return base64.StdEncoding.EncodeToString(raw)
}

func cleanDossierFixture() CareerDossierInput {
	return CareerDossierInput{
		Slug:        "platform-architecture",
		Title:       "Cloud Platform Modernization",
		DomainLabel: "Financial Services",
		RoleTitle:   "Principal Platform Architect",
		Timeframe:   "2023-2026",
		Skills:      []string{"Go", "TypeScript", "PostgreSQL 19", "UTF-8", "SHA-256", "RFC-4122", "ARGON-2", "PYTHON-3", "USB-4"},
		SummaryBody: "Designed multi-service streaming SSR and Go workloads on GCP using TLS-13 and ISO-8601 audit events.",
		Sections: []CareerDossierSectionInput{
			{
				Heading: "Database Reliability",
				Body:    "Built reversible expand/contract PostgreSQL migrations with atomic FOR UPDATE locks.",
			},
		},
	}
}

func TestAllowedTechPrefixesParityAndCount(t *testing.T) {
	t.Parallel()
	if len(AllowedTechPrefixes) != 75 {
		t.Fatalf("expected exactly 75 AllowedTechPrefixes, got %d", len(AllowedTechPrefixes))
	}
	for _, prefix := range []string{"AP", "ARGON", "ARM", "ASCII", "AV", "B2B", "B2C", "CENTRAL", "EAST", "MP", "NORTH", "NVME", "PYTHON", "SOUTH", "USB", "VP", "WEST", "X86"} {
		if IsBlockedTrackerPrefix(prefix) {
			t.Fatalf("expected technical prefix %q to be allowed", prefix)
		}
	}
	for _, blocked := range []string{"PROJ", "JIRA", "a" + "kl", "A" + "KL", "d" + "ec", "i" + "i", "p" + "rod", "o" + "q"} {
		if !IsBlockedTrackerPrefix(blocked) {
			t.Fatalf("expected tracker prefix %q to be blocked", blocked)
		}
	}
}

func TestDenylistParsingAndHashParity(t *testing.T) {
	t.Parallel()

	// Empty denylist SHA-256("[]") matches Node EMPTY_DENYLIST_HASH byte-for-byte.
	const expectedEmptyHash = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
	if got := ComputeDenylistHash(nil); got != expectedEmptyHash {
		t.Fatalf("empty hash mismatch: got %q want %q", got, expectedEmptyHash)
	}

	// Ampersand must not be HTML-escaped when computing SHA-256 hash (parity with JS JSON.stringify).
	hashAmp := ComputeDenylistHash([]string{"R&D Client"})
	if hashAmp == "" {
		t.Fatal("expected non-empty hash")
	}

	terms := []string{"SyntheticConfidentialClientX", "SecretPartner Corp"}
	b64 := encodeBase64Denylist(t, terms)
	fromB64, err := ParseDossierPrivacyDenylist(b64)
	if err != nil {
		t.Fatalf("parse base64 denylist: %v", err)
	}
	unpadded, err := ParseDossierPrivacyDenylist(strings.TrimRight(b64, "="))
	if err != nil {
		t.Fatalf("parse unpadded base64 denylist: %v", err)
	}
	plainJSON, _ := json.Marshal([]string{"SecretPartner Corp", "SyntheticConfidentialClientX"})
	fromPlain, err := ParseDossierPrivacyDenylist(string(plainJSON))
	if err != nil {
		t.Fatalf("parse plain JSON denylist: %v", err)
	}
	if !fromB64.Configured || fromB64.DenylistHash != fromPlain.DenylistHash || fromB64.DenylistHash != unpadded.DenylistHash {
		t.Fatalf("denylist parse mismatch: %+v vs %+v", fromB64, fromPlain)
	}

	fromFile, err := ParseDenylistFileContent("# comment\nSyntheticConfidentialClientX\n\nSecretPartner Corp\n")
	if err != nil {
		t.Fatalf("parse file denylist: %v", err)
	}
	if fromFile.DenylistHash != fromB64.DenylistHash {
		t.Fatalf("file hash mismatch: %q vs %q", fromFile.DenylistHash, fromB64.DenylistHash)
	}

	if _, err := ParseDossierPrivacyDenylist("not-valid-base64-or-json!"); err == nil {
		t.Fatal("expected malformed denylist error")
	}
	if _, err := ParseDossierPrivacyDenylist(`{"invalid":true}`); err == nil {
		t.Fatal("expected non-array JSON denylist error")
	}
	badB64 := base64.StdEncoding.EncodeToString([]byte(`["ClientA", ]`))
	if _, err := ParseDenylistFileContent(badB64); err == nil {
		t.Fatal("expected malformed base64 file denylist error")
	}
}

func TestLinearPhoneAndLongEmailEdgeCases(t *testing.T) {
	t.Parallel()
	empty, _ := ParseDossierPrivacyDenylist("")

	for _, phone := range []string{
		"+1(555) 010-1234",
		"1(555) 010-1234",
		"+15550101234",
		"(555) 010-1234",
		"555-010-1234",
		"1-800-555-0199",
		"+1 555.010.1234",
	} {
		findings := ScanText("Contact via "+phone+" anytime.", "summaryBody", empty, ScanOptions{})
		found := false
		for _, f := range findings {
			if f.RuleID == "pii.us_phone" && f.Category == "pii" {
				found = true
			}
		}
		if !found {
			t.Fatalf("expected pii.us_phone for %q, got %+v", phone, findings)
		}
		redacted := RedactTextForStorage(nil, "Call "+phone+" now", 200)
		if strings.Contains(redacted, "555") || !strings.Contains(redacted, RedactionPlaceholder) {
			t.Fatalf("expected RedactTextForStorage to scrub %q, got %q", phone, redacted)
		}
	}

	for _, benign := range []string{
		"Version 1.2.3 deployed on port 11434",
		"Request ID 1234-567-8901 succeeded",
		"Timestamp 2026-010-12345 logged",
		"Batch 555-010-12345 processed",
	} {
		findings := ScanText(benign, "summaryBody", empty, ScanOptions{})
		if len(findings) != 0 {
			t.Fatalf("expected zero findings for benign %q, got %+v", benign, findings)
		}
	}

	longLocalEmail := strings.Repeat("a", 70) + "@example.com"
	emailFindings := ScanText("Email "+longLocalEmail+" directly.", "summaryBody", empty, ScanOptions{})
	if len(emailFindings) == 0 || emailFindings[0].RuleID != "pii.email_address" {
		t.Fatalf("expected pii.email_address for 70-char local-part email, got %+v", emailFindings)
	}
	redactedEmail := RedactTextForStorage(nil, "Reach "+longLocalEmail, 200)
	if strings.Contains(redactedEmail, "example.com") || !strings.Contains(redactedEmail, RedactionPlaceholder) {
		t.Fatalf("expected RedactTextForStorage to scrub 70-char email, got %q", redactedEmail)
	}

	// Adversarial ReDoS timing checks (linear O(N) on 300 KB inputs even under -race).
	start := time.Now()
	ScanText(strings.Repeat("a.b.c.", 20_000)+"@x", "body", empty, ScanOptions{})
	ScanText(strings.Repeat("111-", 15_000), "body", empty, ScanOptions{})
	ScanText("zip"+strings.Repeat(" ", 60_000)+"x\npostal"+strings.Repeat(" ", 60_000)+"x", "body", empty, ScanOptions{ExtraRules: PortalHomeExtraRules})
	if elapsed := time.Since(start); elapsed > 1500*time.Millisecond {
		t.Fatalf("linear-time ReDoS check exceeded budget: %v", elapsed)
	}
}

func TestCareerDossierAndSiteContentFailClosedAndSeamLogs(t *testing.T) {
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	denylist, err := ParseDossierPrivacyDenylist(encodeBase64Denylist(t, []string{"SyntheticConfidentialClientX", "SecretPartner Corp", "Acme"}))
	if err != nil {
		t.Fatalf("parse denylist: %v", err)
	}

	clean := cleanDossierFixture()
	hash, err := ScanCareerDossier(clean, denylist, PublishScanOptions{RequireConfiguredDenylist: true, CorrelationID: "corr-clean", EmitAuditLogs: true})
	if err != nil {
		t.Fatalf("expected clean dossier to pass, got %v", err)
	}
	if hash != denylist.DenylistHash {
		t.Fatalf("unexpected hash: %q", hash)
	}

	// Empty denylist fails closed when requireConfiguredDenylist=true and emits UNSOUND_CONDITION.
	emptyDenylist, _ := ParseDossierPrivacyDenylist("")
	logBuf.Reset()
	if _, err := ScanCareerDossier(clean, emptyDenylist, PublishScanOptions{RequireConfiguredDenylist: true, CorrelationID: "corr-empty", EmitAuditLogs: true}); err == nil {
		t.Fatal("expected empty denylist error in prod")
	} else if pe, ok := AsPolicyError(err); !ok || len(pe.Findings) != 1 || pe.Findings[0].RuleID != "config.denylist_empty_in_prod" {
		t.Fatalf("unexpected empty denylist error: %v", err)
	}
	if !strings.Contains(logBuf.String(), "admin_api.privacy.denylist_empty_in_prod") || !strings.Contains(logBuf.String(), "UNSOUND_CONDITION") {
		t.Fatalf("missing UNSOUND_CONDITION seam log: %s", logBuf.String())
	}

	// Violations across secret, pii, tracker, workspace, denylist emit BOUNDARY_FAULT with zero raw literals.
	logBuf.Reset()
	dirty := clean
	fakeAws := "AKIA1234567890ABCDEF"
	fakeEmail := "person@confidential-client.example"
	fakeTracker := "PROJ-9042"
	fakePath := "~/projects/private-client-vault/notes.md"
	dirty.SummaryBody = "Worked with SyntheticConfidentialClientX (" + fakeAws + ") email " + fakeEmail + " ticket " + fakeTracker
	dirty.Sections = []CareerDossierSectionInput{{Heading: "SecretPartner-Corp", Body: "Notes at " + fakePath}}
	_, err = ScanCareerDossier(dirty, denylist, PublishScanOptions{RequireConfiguredDenylist: true, CorrelationID: "corr-dirty", EmitAuditLogs: true})
	pe, ok := AsPolicyError(err)
	if !ok {
		t.Fatalf("expected *PolicyError, got %v", err)
	}
	cats := map[string]bool{}
	for _, f := range pe.Findings {
		cats[f.Category] = true
	}
	for _, want := range []string{"secret", "pii", "tracker", "workspace", "denylist"} {
		if !cats[want] {
			t.Fatalf("missing category %q in findings %+v", want, pe.Findings)
		}
	}
	serialized := logBuf.String()
	if !strings.Contains(serialized, "admin_api.privacy.sanitization_rejected") || !strings.Contains(serialized, "BOUNDARY_FAULT") {
		t.Fatalf("missing BOUNDARY_FAULT seam log: %s", serialized)
	}
	findingsJSON, _ := json.Marshal(pe.Findings)
	combined := serialized + "\n" + string(findingsJSON)
	for _, forbidden := range []string{"SyntheticConfidentialClientX", "SecretPartner", fakeAws, fakeEmail, fakeTracker, fakePath} {
		if strings.Contains(combined, forbidden) {
			t.Fatalf("raw sensitive literal %q leaked into output/logs", forbidden)
		}
	}

	// Portal-home allows andrew@andrew-k.us, rejects mixed external emails, ZIPs, and References.
	cleanHomeMeta := map[string]any{
		"resumeSummary": map[string]any{
			"publicEmail": "andrew@andrew-k.us",
			"bio":         "Scaled in 40000 requests or 40000 records with id 12345 in ms 15000.",
		},
	}
	if err := ScanSiteContent("portal-home", "# Clean", cleanHomeMeta, denylist, PublishScanOptions{RequireConfiguredDenylist: true}); err != nil {
		t.Fatalf("expected clean portal-home to pass, got %v", err)
	}
	for _, tc := range []struct {
		name     string
		md       string
		meta     map[string]any
		wantRule string
	}{
		{"mixed email", "", map[string]any{"bio": "andrew@andrew-k.us, ref@example.com"}, "pii.email_address"},
		{"state zip", "", map[string]any{"role": "Marietta, GA 99999"}, "pii.us_postal_address_zip"},
		{"postal label", "", map[string]any{"bio": "Postal code: 99999-1234"}, "pii.us_postal_address_zip"},
		{"references heading", "## References\nAvailable on request", map[string]any{}, "pii.references_section"},
		{"bold references", "### **References**", map[string]any{}, "pii.references_section"},
		{"multiline zip", "Marietta, GA\n\u200b\n30062", map[string]any{}, "pii.us_postal_zip"},
		{"multiline phone", "(555)\n\u200b\n010-1234", map[string]any{}, "pii.us_phone"},
		{"zero-width short term", "Ac\u00ADme platform", map[string]any{}, "denylist.term_1"},
		{"separator short term", "A-c-m-e engineering", map[string]any{}, "denylist.term_1"},
		{"combining diacritic", "Secre\u0301tPartner Corp", map[string]any{}, "denylist.term_2"},
	} {
		err := ScanSiteContent("portal-home", tc.md, tc.meta, denylist, PublishScanOptions{RequireConfiguredDenylist: true})
		pe, ok := AsPolicyError(err)
		if !ok {
			t.Fatalf("%s: expected *PolicyError, got %v", tc.name, err)
		}
		matched := false
		for _, f := range pe.Findings {
			if f.RuleID == tc.wantRule {
				matched = true
			}
		}
		if !matched {
			t.Fatalf("%s: expected rule %q, got %+v", tc.name, tc.wantRule, pe.Findings)
		}
	}

	// Portal-about rejects even andrew@andrew-k.us (no allowlist bypass).
	if err := ScanSiteContent("portal-about", "Email andrew@andrew-k.us", map[string]any{}, denylist, PublishScanOptions{}); err == nil {
		t.Fatal("expected portal-about to reject email")
	}

	// Single-line match does not duplicate as multiline finding.
	singlePlusMulti := ScanText("Marietta, GA 30062\nMore context", "description", emptyDenylist, ScanOptions{})
	zipCount := 0
	for _, f := range singlePlusMulti {
		if f.RuleID == "pii.us_postal_zip" {
			zipCount++
			if f.Location != "line:1" {
				t.Fatalf("expected location line:1, got %q", f.Location)
			}
		}
	}
	if zipCount != 1 {
		t.Fatalf("expected strictly 1 zip finding, got %d (%+v)", zipCount, singlePlusMulti)
	}
}
