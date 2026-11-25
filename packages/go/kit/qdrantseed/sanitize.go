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
		re:   regexp.MustCompile(`(?:-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|\bAIza[0-9A-Za-z_-]{30,}\b)`),
	},
}

func parseRuntimeDenylistConfig(raw string) (*privacy.Config, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
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
	encoded, err := json.Marshal(list)
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
			if privCfg != nil && privCfg.DenylistTermCount > 0 {
				guard := privacy.NewStreamGuard(privCfg, "qdrant-seed-origin-check")
				if _, procErr := guard.Process(f.value); errors.Is(procErr, privacy.ErrPrivacyAborted) {
					return fmt.Errorf(
						"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched privacy denylist",
						ErrOriginConfidentiality,
						doc.ID,
						f.name,
					)
				}
				if _, flushErr := guard.Flush(); errors.Is(flushErr, privacy.ErrPrivacyAborted) {
					return fmt.Errorf(
						"BOUNDARY_FAULT qdrant.seed.origin_confidentiality_violation: %w: doc %q field %q matched privacy denylist",
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
