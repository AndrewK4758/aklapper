package qdrantseed

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
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
		re: regexp.MustCompile(
			`(?:-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----` +
				`|\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b` +
				`|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b` +
				`|\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b` +
				`|\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b` +
				`|\bxox[baprs]-[A-Za-z0-9-]{10,}\b` +
				`|\bAIza[0-9A-Za-z_-]{30,}\b)`,
		),
	},
}

func parseRuntimeDenylistConfig(raw string) (*privacy.Config, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		cfg, err := privacy.LoadConfig(privacy.ConfigInput{
			DenylistAction: privacy.ActionAbort,
			SecretAction:   privacy.ActionAbort,
		})
		if err != nil {
			return nil, fmt.Errorf("BOUNDARY_FAULT qdrant.seed.denylist_parse_failed: %w", ErrOriginConfidentiality)
		}
		return cfg, nil
	}
	payload := trimmed
	if !strings.HasPrefix(payload, "[") {
		compact := strings.Join(strings.Fields(trimmed), "")
		decoded, err := base64.StdEncoding.DecodeString(compact)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(strings.TrimRight(compact, "="))
		}
		if err != nil {
			return nil, fmt.Errorf("BOUNDARY_FAULT qdrant.seed.denylist_parse_failed: %w: invalid base64 DOSSIER_PRIVACY_DENYLIST", ErrOriginConfidentiality)
		}
		payload = strings.TrimSpace(string(decoded))
	}
	var list []string
	if err := json.Unmarshal([]byte(payload), &list); err != nil {
		return nil, fmt.Errorf("BOUNDARY_FAULT qdrant.seed.denylist_parse_failed: %w: invalid JSON array DOSSIER_PRIVACY_DENYLIST", ErrOriginConfidentiality)
	}
	expanded := make([]string, 0, len(list)*2)
	seen := make(map[string]struct{}, len(list)*2)
	addUnique := func(entry string) {
		trimmedEntry := strings.TrimSpace(entry)
		if trimmedEntry == "" {
			return
		}
		if _, dup := seen[trimmedEntry]; dup {
			return
		}
		seen[trimmedEntry] = struct{}{}
		expanded = append(expanded, trimmedEntry)
	}
	for _, entry := range list {
		addUnique(entry)
		if !strings.HasPrefix(strings.TrimSpace(entry), "re:") {
			addUnique(privacy.FoldDiacriticsAndInvisible(entry))
		}
	}
	encoded, err := json.Marshal(expanded)
	if err != nil {
		return nil, fmt.Errorf("BOUNDARY_FAULT qdrant.seed.denylist_parse_failed: %w", ErrOriginConfidentiality)
	}
	cfg, err := privacy.LoadConfig(privacy.ConfigInput{
		RawDenylist:    string(encoded),
		DenylistAction: privacy.ActionAbort,
		SecretAction:   privacy.ActionAbort,
	})
	if err != nil {
		return nil, fmt.Errorf("BOUNDARY_FAULT qdrant.seed.denylist_parse_failed: %w: invalid DOSSIER_PRIVACY_DENYLIST rules", ErrOriginConfidentiality)
	}
	return cfg, nil
}

func scanFieldWithStreamGuard(privCfg *privacy.Config, value string) error {
	guard := privacy.NewStreamGuard(privCfg, "qdrant-seed-origin-check")
	if _, procErr := guard.Process(value); procErr != nil {
		return procErr
	}
	if _, flushErr := guard.Flush(); flushErr != nil {
		return flushErr
	}
	return nil
}

// ValidateOriginConfidentiality verifies every candidate document is non-empty and free
// of private governance tokens, private workspace paths, credential literals, or runtime denylist terms.
func ValidateOriginConfidentiality(docs []SeedDocument) error {
	privCfg, err := parseRuntimeDenylistConfig(os.Getenv("DOSSIER_PRIVACY_DENYLIST"))
	if err != nil {
		return err
	}
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
			{name: "sectionHeading", value: doc.SectionHeading},
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
			normalized := privacy.StripInvisibleAndNormalize(f.value)
			folded := privacy.FoldDiacriticsAndInvisible(f.value)
			for _, rule := range originForbiddenRules {
				if rule.re.MatchString(normalized) || (folded != normalized && rule.re.MatchString(folded)) {
					return fmt.Errorf(
						"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched rule %q",
						ErrOriginConfidentiality,
						doc.ID,
						f.name,
						rule.name,
					)
				}
			}
			if scanErr := scanFieldWithStreamGuard(privCfg, f.value); scanErr != nil {
				return fmt.Errorf(
					"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched privacy guard",
					ErrOriginConfidentiality,
					doc.ID,
					f.name,
				)
			}
			if folded != f.value {
				if scanErr := scanFieldWithStreamGuard(privCfg, folded); scanErr != nil {
					return fmt.Errorf(
						"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched privacy guard",
						ErrOriginConfidentiality,
						doc.ID,
						f.name,
					)
				}
			}
		}
	}
	return nil
}
