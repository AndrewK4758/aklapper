package main

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

type cliRequest struct {
	Mode                      string                      `json:"mode"`
	Surface                   string                      `json:"surface"`
	Fields                    []privacy.FieldValue        `json:"fields"`
	MarkdownBody              string                      `json:"markdownBody"`
	Metadata                  map[string]any              `json:"metadata"`
	Dossier                   *privacy.CareerDossierInput `json:"dossier"`
	RawDenylist               string                      `json:"rawDenylist"`
	DenylistFileContent       string                      `json:"denylistFileContent"`
	RequireConfiguredDenylist bool                        `json:"requireConfiguredDenylist"`
	CorrelationID             string                      `json:"correlationId"`
}

type cliResponse struct {
	Passed             bool              `json:"passed"`
	DenylistConfigured bool              `json:"denylistConfigured"`
	DenylistHash       string            `json:"denylistHash"`
	Findings           []privacy.Finding `json:"findings"`
}

func run(stdin io.Reader, stdout io.Writer) int {
	raw, err := io.ReadAll(stdin)
	if err != nil {
		fmt.Fprintf(os.Stderr, "privacy-check: failed to read stdin: %v\n", err)
		return 2
	}
	var req cliRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		fmt.Fprintf(os.Stderr, "privacy-check: invalid JSON request: %v\n", err)
		return 2
	}

	var denylist privacy.ParsedDenylist
	var parseErr error
	if strings.TrimSpace(req.DenylistFileContent) != "" {
		denylist, parseErr = privacy.ParseDenylistFileContent(req.DenylistFileContent)
	} else {
		denylist, parseErr = privacy.ParseDossierPrivacyDenylist(req.RawDenylist)
	}
	if parseErr != nil {
		if pe, ok := privacy.AsPolicyError(parseErr); ok {
			return writeResponse(stdout, cliResponse{
				Passed:             false,
				DenylistConfigured: false,
				DenylistHash:       privacy.ComputeDenylistHash(nil),
				Findings:           pe.Findings,
			})
		}
		fmt.Fprintf(os.Stderr, "privacy-check: denylist error: %v\n", parseErr)
		return 2
	}

	opts := privacy.PublishScanOptions{
		RequireConfiguredDenylist: req.RequireConfiguredDenylist,
		CorrelationID:             req.CorrelationID,
		EmitAuditLogs:             true,
	}

	switch req.Mode {
	case "parse_denylist":
		return writeResponse(stdout, cliResponse{
			Passed:             true,
			DenylistConfigured: denylist.Configured,
			DenylistHash:       denylist.DenylistHash,
			Findings:           []privacy.Finding{},
		})

	case "site_content":
		key := strings.TrimPrefix(strings.TrimSpace(req.Surface), "site_content.")
		if key == "" {
			fmt.Fprintln(os.Stderr, "privacy-check: surface is required for site_content mode")
			return 2
		}
		err := privacy.ScanSiteContent(key, req.MarkdownBody, req.Metadata, denylist, opts)
		return finishScan(stdout, denylist, err)

	case "career_dossier":
		if req.Dossier == nil {
			fmt.Fprintln(os.Stderr, "privacy-check: dossier payload is required for career_dossier mode")
			return 2
		}
		_, err := privacy.ScanCareerDossier(*req.Dossier, denylist, opts)
		return finishScan(stdout, denylist, err)

	case "text":
		surface := strings.TrimSpace(req.Surface)
		if err := privacy.ValidateDenylistForPublish(denylist, surface, req.CorrelationID, req.RequireConfiguredDenylist, true); err != nil {
			return finishScan(stdout, denylist, err)
		}
		scanOpts := privacy.ScanOptions{}
		if surface == "portal-home" || surface == "site_content.portal-home" {
			scanOpts.AllowedEmails = privacy.PortalHomeAllowedPublicEmails
			scanOpts.ExtraRules = privacy.PortalHomeExtraRules
		}
		findings := make([]privacy.Finding, 0)
		for _, f := range req.Fields {
			fieldName := f.Field
			if fieldName == "" {
				fieldName = "text"
			}
			findings = append(findings, privacy.ScanText(f.Text, fieldName, denylist, scanOpts)...)
		}
		if len(findings) > 0 {
			return writeResponse(stdout, cliResponse{
				Passed:             false,
				DenylistConfigured: denylist.Configured,
				DenylistHash:       denylist.DenylistHash,
				Findings:           findings,
			})
		}
		return writeResponse(stdout, cliResponse{
			Passed:             true,
			DenylistConfigured: denylist.Configured,
			DenylistHash:       denylist.DenylistHash,
			Findings:           []privacy.Finding{},
		})

	default:
		fmt.Fprintf(os.Stderr, "privacy-check: unsupported mode %q\n", req.Mode)
		return 2
	}
}

func finishScan(stdout io.Writer, denylist privacy.ParsedDenylist, err error) int {
	if err == nil {
		return writeResponse(stdout, cliResponse{
			Passed:             true,
			DenylistConfigured: denylist.Configured,
			DenylistHash:       denylist.DenylistHash,
			Findings:           []privacy.Finding{},
		})
	}
	if pe, ok := privacy.AsPolicyError(err); ok {
		return writeResponse(stdout, cliResponse{
			Passed:             false,
			DenylistConfigured: denylist.Configured,
			DenylistHash:       denylist.DenylistHash,
			Findings:           pe.Findings,
		})
	}
	fmt.Fprintf(os.Stderr, "privacy-check: unexpected error: %v\n", err)
	return 2
}

func writeResponse(stdout io.Writer, resp cliResponse) int {
	if resp.Findings == nil {
		resp.Findings = []privacy.Finding{}
	}
	enc := json.NewEncoder(stdout)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(resp); err != nil {
		fmt.Fprintf(os.Stderr, "privacy-check: encode response failed: %v\n", err)
		return 2
	}
	if !resp.Passed {
		return 1
	}
	return 0
}

func main() {
	log.SetOutput(os.Stderr)
	os.Exit(run(os.Stdin, os.Stdout))
}
