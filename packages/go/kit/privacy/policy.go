package privacy

import (
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

// FieldValue represents a single named text field extracted for privacy scanning.
type FieldValue struct {
	Field string `json:"field"`
	Text  string `json:"text"`
}

// ScanOptions customizes policy scanning for a specific surface (e.g. portal-home allowlist + extra rules).
type ScanOptions struct {
	AllowedEmails map[string]struct{}
	ExtraRules    []PatternRule
}

// PublishScanOptions controls fail-closed production denylist enforcement and audit logging.
type PublishScanOptions struct {
	RequireConfiguredDenylist bool
	CorrelationID             string
	EmitAuditLogs             bool
}

// CareerDossierSectionInput holds a single career dossier section heading/body pair.
type CareerDossierSectionInput struct {
	Heading string `json:"heading"`
	Body    string `json:"body"`
}

// CareerDossierInput mirrors CareerDossierUpsertInput for unified Go privacy scanning.
type CareerDossierInput struct {
	Slug        string                      `json:"slug"`
	Title       string                      `json:"title"`
	DomainLabel string                      `json:"domainLabel"`
	RoleTitle   string                      `json:"roleTitle"`
	Timeframe   string                      `json:"timeframe"`
	Skills      []string                    `json:"skills"`
	SummaryBody string                      `json:"summaryBody"`
	Sections    []CareerDossierSectionInput `json:"sections"`
}

// PolicyError carries structured, zero-literal findings when a fail-closed privacy scan rejects input.
type PolicyError struct {
	Findings []Finding
}

func (e *PolicyError) Error() string {
	return "Content failed privacy sanitization policy."
}

// ScanText scans a single named text field line-by-line and across multiline joins in linear time.
func ScanText(text, field string, denylist ParsedDenylist, opts ScanOptions) []Finding {
	if text == "" {
		return nil
	}
	var findings []Finding
	seen := make(map[string]struct{})
	addUnique := func(f Finding) {
		key := f.RuleID + "|" + f.Field + "|" + f.Location
		if _, dup := seen[key]; dup {
			return
		}
		seen[key] = struct{}{}
		findings = append(findings, f)
	}

	rules := CoreRegexRules
	if len(opts.ExtraRules) > 0 {
		rules = make([]PatternRule, 0, len(CoreRegexRules)+len(opts.ExtraRules))
		rules = append(rules, CoreRegexRules...)
		rules = append(rules, opts.ExtraRules...)
	}
	denylistEntries := compileDenylistTerms(denylist.Terms)
	matchedRules := make(map[string]struct{})
	matchedDenylist := make(map[string]struct{})

	scanPatterns := func(normalized, location string, skipMatched bool) {
		for _, rule := range rules {
			if skipMatched {
				if _, already := matchedRules[rule.RuleID]; already {
					continue
				}
			}
			if rule.QuickCheck != nil && !rule.QuickCheck(normalized) {
				continue
			}
			if rule.Regex.MatchString(normalized) {
				matchedRules[rule.RuleID] = struct{}{}
				addUnique(Finding{RuleID: rule.RuleID, Category: rule.Category, Field: field, Location: location})
			}
		}

		if _, already := matchedRules["pii.email_address"]; !skipMatched || !already {
			for _, span := range FindEmailSpans(normalized) {
				addr := strings.ToLower(strings.TrimSpace(normalized[span[0]:span[1]]))
				if opts.AllowedEmails != nil {
					if _, ok := opts.AllowedEmails[addr]; ok {
						continue
					}
				}
				matchedRules["pii.email_address"] = struct{}{}
				addUnique(Finding{RuleID: "pii.email_address", Category: "pii", Field: field, Location: location})
				break
			}
		}

		if _, already := matchedRules["pii.us_phone"]; !skipMatched || !already {
			if len(FindUSPhoneSpans(normalized)) > 0 {
				matchedRules["pii.us_phone"] = struct{}{}
				addUnique(Finding{RuleID: "pii.us_phone", Category: "pii", Field: field, Location: location})
			}
		}
	}

	scanDenylist := func(foldedTarget, location string, skipMatched bool) {
		if len(denylistEntries) == 0 {
			return
		}
		collapsedTarget := CollapseForSeparatorMatch(foldedTarget)
		for _, entry := range denylistEntries {
			if skipMatched {
				if _, already := matchedDenylist[entry.ruleID]; already {
					continue
				}
			}
			matched := hasBoundedMatch(entry.wordRe, foldedTarget) ||
				(entry.obfuscatedRe != nil && hasBoundedMatch(entry.obfuscatedRe, foldedTarget)) ||
				(len(entry.collapsed) >= 6 && strings.Contains(collapsedTarget, entry.collapsed))
			if matched {
				matchedDenylist[entry.ruleID] = struct{}{}
				addUnique(Finding{RuleID: entry.ruleID, Category: "denylist", Field: field, Location: location})
			}
		}
	}

	rawLines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	nonEmptyNormLines := make([]string, 0, len(rawLines))
	for idx, rawLine := range rawLines {
		if strings.TrimSpace(rawLine) == "" {
			continue
		}
		location := fmt.Sprintf("line:%d", idx+1)
		normalized := StripInvisibleAndNormalize(rawLine)
		if trimmed := strings.TrimSpace(normalized); trimmed != "" {
			nonEmptyNormLines = append(nonEmptyNormLines, trimmed)
		}
		scanPatterns(normalized, location, false)

		for _, match := range TrackerIssueKeyRe.FindAllStringSubmatch(normalized, -1) {
			if len(match) >= 2 && IsBlockedTrackerPrefix(match[1]) {
				addUnique(Finding{RuleID: "tracker.issue_key", Category: "tracker", Field: field, Location: location})
				break
			}
		}
		if len(denylistEntries) > 0 {
			scanDenylist(FoldDiacriticsAndInvisible(normalized), location, false)
		}
	}

	if len(rawLines) > 1 && len(nonEmptyNormLines) > 0 {
		joined := strings.Join(nonEmptyNormLines, " ")
		scanPatterns(joined, "multiline", true)
		if len(denylistEntries) > 0 {
			scanDenylist(FoldDiacriticsAndInvisible(joined), "multiline", true)
		}
	}
	return findings
}

// CollectJSONStringLeaves recursively flattens string leaves of arbitrary decoded JSON values.
func CollectJSONStringLeaves(value any, prefix string, out *[]FieldValue) {
	switch v := value.(type) {
	case string:
		*out = append(*out, FieldValue{Field: prefix, Text: v})
	case []any:
		for i, item := range v {
			CollectJSONStringLeaves(item, fmt.Sprintf("%s[%d]", prefix, i), out)
		}
	case map[string]any:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			CollectJSONStringLeaves(v[k], prefix+"."+k, out)
		}
	}
}

// ValidateDenylistForPublish enforces fail-closed production denylist presence for CMS and dossier writes.
func ValidateDenylistForPublish(denylist ParsedDenylist, surface, correlationID string, requireConfigured, emitLogs bool) *PolicyError {
	if !requireConfigured || denylist.Configured {
		return nil
	}
	if emitLogs {
		fields := map[string]any{
			"severity": "CRITICAL",
			"surface":  surface,
		}
		if correlationID != "" {
			fields["correlationId"] = correlationID
		}
		logPrivacySeam("UNSOUND_CONDITION", "admin_api.privacy.denylist_empty_in_prod", fields)
	}
	loc := surface
	if loc == "" {
		loc = "publish"
	}
	return &PolicyError{
		Findings: []Finding{
			{
				RuleID:   "config.denylist_empty_in_prod",
				Category: "config",
				Field:    "DOSSIER_PRIVACY_DENYLIST",
				Location: loc,
			},
		},
	}
}

func emitSanitizationRejectedSeam(findings []Finding, surface, correlationID string) {
	fields := map[string]any{
		"severity":     "CRITICAL",
		"surface":      surface,
		"findingCount": len(findings),
		"findings":     findings,
	}
	if correlationID != "" {
		fields["correlationId"] = correlationID
	}
	logPrivacySeam("BOUNDARY_FAULT", "admin_api.privacy.sanitization_rejected", fields)
}

// ScanSiteContent validates portal-home, portal-about, or portal-ask site_content payloads fail-closed.
func ScanSiteContent(
	key, markdownBody string,
	metadata map[string]any,
	denylist ParsedDenylist,
	opts PublishScanOptions,
) error {
	surface := "site_content." + key
	if err := ValidateDenylistForPublish(denylist, surface, opts.CorrelationID, opts.RequireConfiguredDenylist, opts.EmitAuditLogs); err != nil {
		return err
	}
	leaves := []FieldValue{{Field: "markdownBody", Text: markdownBody}}
	CollectJSONStringLeaves(metadata, "metadataJson", &leaves)

	scanOpts := ScanOptions{}
	if key == "portal-home" {
		scanOpts.AllowedEmails = PortalHomeAllowedPublicEmails
		scanOpts.ExtraRules = PortalHomeExtraRules
	}

	var findings []Finding
	for _, leaf := range leaves {
		findings = append(findings, ScanText(leaf.Text, leaf.Field, denylist, scanOpts)...)
	}
	if len(findings) > 0 {
		if opts.EmitAuditLogs {
			emitSanitizationRejectedSeam(findings, surface, opts.CorrelationID)
		}
		return &PolicyError{Findings: findings}
	}
	return nil
}

// ScanCareerDossier validates all text fields of a career dossier payload fail-closed.
func ScanCareerDossier(
	input CareerDossierInput,
	denylist ParsedDenylist,
	opts PublishScanOptions,
) (string, error) {
	if err := ValidateDenylistForPublish(denylist, "publish", opts.CorrelationID, opts.RequireConfiguredDenylist, opts.EmitAuditLogs); err != nil {
		return "", err
	}
	fields := []FieldValue{
		{Field: "slug", Text: input.Slug},
		{Field: "title", Text: input.Title},
		{Field: "domainLabel", Text: input.DomainLabel},
		{Field: "roleTitle", Text: input.RoleTitle},
		{Field: "timeframe", Text: input.Timeframe},
		{Field: "summaryBody", Text: input.SummaryBody},
	}
	for i, skill := range input.Skills {
		fields = append(fields, FieldValue{Field: fmt.Sprintf("skills[%d]", i), Text: skill})
	}
	for i, section := range input.Sections {
		fields = append(fields,
			FieldValue{Field: fmt.Sprintf("sections[%d].heading", i), Text: section.Heading},
			FieldValue{Field: fmt.Sprintf("sections[%d].body", i), Text: section.Body},
		)
	}

	var findings []Finding
	for _, f := range fields {
		findings = append(findings, ScanText(f.Text, f.Field, denylist, ScanOptions{})...)
	}
	if len(findings) > 0 {
		if opts.EmitAuditLogs {
			emitSanitizationRejectedSeam(findings, "career_dossiers", opts.CorrelationID)
		}
		return "", &PolicyError{Findings: findings}
	}
	return denylist.DenylistHash, nil
}

// IsProductionPolicyEnv returns true when APP_ENV or NODE_ENV resolves to production.
func IsProductionPolicyEnv() bool {
	return internalauth.IsProductionEnv()
}

// AsPolicyError extracts a *PolicyError from an error chain.
func AsPolicyError(err error) (*PolicyError, bool) {
	var pe *PolicyError
	if errors.As(err, &pe) && pe != nil {
		return pe, true
	}
	return nil, false
}
