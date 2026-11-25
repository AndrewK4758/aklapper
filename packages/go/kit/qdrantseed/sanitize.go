package qdrantseed

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

// ErrOriginConfidentiality indicates a document violated public-repository confidentiality rules.
var ErrOriginConfidentiality = errors.New("origin confidentiality violation")

type forbiddenRule struct {
	name string
	re   *regexp.Regexp
}

var originForbiddenRules = []forbiddenRule{
	{
		name: "internal_governance_token",
		re:   regexp.MustCompile(`(?i)\b(?:AKL|DEC|II|PROD|OQ)-\d+\b`),
	},
	{
		name: "private_governance_repo",
		re:   regexp.MustCompile(`(?i)aklapper[-_/]cadence`),
	},
	{
		name: "private_governance_file",
		re:   regexp.MustCompile(`(?i)\b(?:CADENCE_ORG\.md|CADENCE_DIRECTIVES\.md|triage-context\.md|design-options\.md|evidence\.yaml|certainty[-_]gate)\b`),
	},
	{
		name: "credential_literal",
		re:   regexp.MustCompile(`(?:-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|\bAIza[0-9A-Za-z_-]{30,}\b)`),
	},
}

// ValidateOriginConfidentiality verifies every candidate document is non-empty and free
// of private governance tokens, private workspace paths, or credential literals.
func ValidateOriginConfidentiality(docs []SeedDocument) error {
	for _, doc := range docs {
		if strings.TrimSpace(doc.ID) == "" {
			return fmt.Errorf("BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: empty document ID", ErrOriginConfidentiality)
		}
		if strings.TrimSpace(doc.Title) == "" || strings.TrimSpace(doc.Body) == "" {
			return fmt.Errorf("BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: document %q missing required title or body", ErrOriginConfidentiality, doc.ID)
		}

		fields := []struct {
			name  string
			value string
		}{
			{name: "id", value: doc.ID},
			{name: "title", value: doc.Title},
			{name: "body", value: doc.Body},
			{name: "category", value: doc.Category},
			{name: "source", value: doc.Source},
			{name: "chordPhase", value: doc.ChordPhase},
		}
		for _, tag := range doc.Tags {
			fields = append(fields, struct {
				name  string
				value string
			}{name: "tag", value: tag})
		}

		for _, f := range fields {
			if f.value == "" {
				continue
			}
			for _, rule := range originForbiddenRules {
				if rule.re.MatchString(f.value) {
					return fmt.Errorf(
						"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched rule %q",
						ErrOriginConfidentiality,
						doc.ID,
						f.name,
						rule.name,
					)
				}
			}
		}
	}
	return nil
}
