package main

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

func TestPrivacyCheckCLIModes(t *testing.T) {
	t.Parallel()

	// Clean text mode exits 0 with canonical denylistHash.
	cleanReq, _ := json.Marshal(cliRequest{
		Mode:                "text",
		Surface:             "dossier_check",
		DenylistFileContent: "# comment\nSyntheticConfidentialClientX\n",
		Fields: []privacy.FieldValue{
			{Field: "markdown", Text: "Built resilient streaming SSR and PostgreSQL 19 services."},
		},
	})
	var out bytes.Buffer
	if code := run(bytes.NewReader(cleanReq), &out); code != 0 {
		t.Fatalf("expected exit 0, got %d (out=%s)", code, out.String())
	}
	var resp cliResponse
	if err := json.Unmarshal(out.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if !resp.Passed || !resp.DenylistConfigured || len(resp.Findings) != 0 {
		t.Fatalf("unexpected clean response: %+v", resp)
	}

	// Dirty text mode with E.164 compact phone, 70-char email, and denylist exits 1 without leaking raw literals.
	longEmail := strings.Repeat("a", 70) + "@example.com"
	dirtyReq, _ := json.Marshal(cliRequest{
		Mode:        "text",
		Surface:     "dossier_check",
		RawDenylist: `["SyntheticConfidentialClientX"]`,
		Fields: []privacy.FieldValue{
			{Field: "markdown", Text: "Call +15550101234 or " + longEmail + " for SyntheticConfidentialClientX"},
		},
	})
	out.Reset()
	if code := run(bytes.NewReader(dirtyReq), &out); code != 1 {
		t.Fatalf("expected exit 1, got %d (out=%s)", code, out.String())
	}
	if strings.Contains(out.String(), "5550101234") || strings.Contains(out.String(), "SyntheticConfidentialClientX") || strings.Contains(out.String(), "@example.com") {
		t.Fatalf("CLI leaked raw sensitive literal: %s", out.String())
	}
	if err := json.Unmarshal(out.Bytes(), &resp); err != nil {
		t.Fatalf("decode dirty response: %v", err)
	}
	if resp.Passed || len(resp.Findings) < 3 {
		t.Fatalf("expected >=3 findings, got %+v", resp)
	}

	// Prod empty denylist on site_content exits 1 with config.denylist_empty_in_prod.
	prodEmptyReq, _ := json.Marshal(cliRequest{
		Mode:                      "site_content",
		Surface:                   "site_content.portal-home",
		MarkdownBody:              "Clean",
		Metadata:                  map[string]any{"heading": "Clean"},
		RequireConfiguredDenylist: true,
	})
	out.Reset()
	if code := run(bytes.NewReader(prodEmptyReq), &out); code != 1 {
		t.Fatalf("expected exit 1 for prod empty denylist, got %d", code)
	}
	if err := json.Unmarshal(out.Bytes(), &resp); err != nil {
		t.Fatalf("decode prod empty response: %v", err)
	}
	if len(resp.Findings) != 1 || resp.Findings[0].RuleID != "config.denylist_empty_in_prod" {
		t.Fatalf("unexpected prod empty findings: %+v", resp.Findings)
	}

	// Invalid JSON exits 2.
	out.Reset()
	if code := run(strings.NewReader("{bad json"), &out); code != 2 {
		t.Fatalf("expected exit 2 for malformed JSON, got %d", code)
	}
}
