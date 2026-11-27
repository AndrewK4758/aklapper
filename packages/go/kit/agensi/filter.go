package agensi

import (
	"net/url"
	"strings"
	"time"
)

type Skill struct {
	Slug          string   `json:"slug"`
	Name          string   `json:"name"`
	Summary       string   `json:"summary"`
	Tags          []string `json:"tags"`
	URL           string   `json:"url"`
	SortOrder     int      `json:"sortOrder"`
	CreatorHandle *string  `json:"creatorHandle,omitempty"`
	IsPublished   bool     `json:"isPublished"`
	SyncedAt      *string  `json:"syncedAt,omitempty"`
	Source        string   `json:"source"`
}

type FilterContext struct {
	EnvelopeCreatorHandle  string
	IsCreatorProfileSkills bool
	FetchedAt              time.Time
	CorrelationID          string
	SortOffset             int
	SeenSlugs              map[string]struct{}
}

type FilterResult struct {
	Items                    []Skill
	RejectedForeignCount     int
	RejectedUnpublishedCount int
	RejectedInvalidCount     int
}

func stringField(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k].(string); ok {
			if trimmed := strings.TrimSpace(v); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func boolPtrField(m map[string]any, keys ...string) *bool {
	for _, k := range keys {
		if v, ok := m[k].(bool); ok {
			b := v
			return &b
		}
	}
	return nil
}

func intPtrField(m map[string]any, keys ...string) *int {
	for _, k := range keys {
		switch v := m[k].(type) {
		case float64:
			if v >= 0 && v == float64(int(v)) {
				n := int(v)
				return &n
			}
		case int:
			if v >= 0 {
				n := v
				return &n
			}
		}
	}
	return nil
}

func resolveCreatorCandidate(item map[string]any, envelopeCreator string) string {
	if h := stringField(item, "creatorHandle", "creator_handle", "creatorSlug", "creator_slug", "authorHandle", "author_handle"); h != "" {
		return h
	}
	if creatorObj, ok := item["creator"].(map[string]any); ok {
		if h := stringField(creatorObj, "handle", "slug"); h != "" {
			return h
		}
	}
	if env := strings.TrimSpace(envelopeCreator); env != "" {
		return env
	}
	if id := stringField(item, "creatorId", "creator_id"); id != "" {
		return id
	}
	if creatorObj, ok := item["creator"].(map[string]any); ok {
		if id := stringField(creatorObj, "id"); id != "" {
			return id
		}
	}
	return ""
}

func isItemPublished(item map[string]any, isCreatorProfile bool) bool {
	if b := boolPtrField(item, "isPublished", "is_published", "published"); b != nil && !*b {
		return false
	}
	if st := stringField(item, "status"); st != "" {
		low := strings.ToLower(st)
		return low == "published" || low == "live"
	}
	if b := boolPtrField(item, "isPublished", "is_published", "published"); b != nil && *b {
		return true
	}
	return isCreatorProfile
}

func isTrustedSkillURL(rawURL string, allowedSet map[string]struct{}) string {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Host == "" {
		return ""
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "https" && scheme != "http" {
		return ""
	}
	origin := scheme + "://" + strings.ToLower(parsed.Host)
	if _, ok := allowedSet[origin]; !ok {
		return ""
	}
	if scheme == "http" && !IsLoopbackHost(parsed.Hostname()) {
		return ""
	}
	return parsed.String()
}

func FilterCreatorPublishedSkills(
	rawItems []map[string]any,
	ownerHandle string,
	allowedOrigins []string,
	ctx FilterContext,
) FilterResult {
	normalizedOwner := strings.ToLower(strings.TrimSpace(ownerHandle))
	allowedSet := NormalizeAllowedOrigins(allowedOrigins)
	fetchedAt := ctx.FetchedAt
	if fetchedAt.IsZero() {
		fetchedAt = time.Now().UTC()
	}
	fetchedAtISO := fetchedAt.UTC().Format(time.RFC3339Nano)
	seen := ctx.SeenSlugs
	if seen == nil {
		seen = make(map[string]struct{})
	}

	out := FilterResult{Items: make([]Skill, 0, len(rawItems))}
	for _, item := range rawItems {
		slug := stringField(item, "slug")
		rawURL := stringField(item, "url")
		if slug == "" || rawURL == "" {
			out.RejectedInvalidCount++
			EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.payload_validation_failed", map[string]any{
				"correlationId": ctx.CorrelationID,
				"reason":        "item_schema_invalid",
			})
			continue
		}

		creator := resolveCreatorCandidate(item, ctx.EnvelopeCreatorHandle)
		if creator == "" || strings.ToLower(creator) != normalizedOwner {
			out.RejectedForeignCount++
			EmitSeamLog("UNSOUND_CONDITION", "agensi.catalog.foreign_creator_rejected", map[string]any{
				"correlationId":   ctx.CorrelationID,
				"slug":            slug,
				"expectedCreator": ownerHandle,
			})
			continue
		}

		if !isItemPublished(item, ctx.IsCreatorProfileSkills) {
			out.RejectedUnpublishedCount++
			EmitSeamLog("UNSOUND_CONDITION", "agensi.catalog.unpublished_item_rejected", map[string]any{
				"correlationId": ctx.CorrelationID,
				"slug":          slug,
			})
			continue
		}

		trustedURL := isTrustedSkillURL(rawURL, allowedSet)
		name := stringField(item, "name", "title")
		summary := stringField(item, "summary", "description")
		_, isDup := seen[slug]
		if trustedURL == "" || name == "" || summary == "" || isDup {
			out.RejectedInvalidCount++
			reason := "missing_required_text"
			if trustedURL == "" {
				reason = "untrusted_url"
			} else if isDup {
				reason = "duplicate_slug"
			}
			EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.payload_validation_failed", map[string]any{
				"correlationId": ctx.CorrelationID,
				"slug":          slug,
				"reason":        reason,
			})
			continue
		}

		tags := []string{}
		if rawTags, ok := item["tags"].([]any); ok {
			for _, t := range rawTags {
				if ts, ok := t.(string); ok {
					if trimmed := strings.TrimSpace(ts); trimmed != "" {
						tags = append(tags, trimmed)
					}
				}
			}
		} else if strTags, ok := item["tags"].([]string); ok {
			for _, ts := range strTags {
				if trimmed := strings.TrimSpace(ts); trimmed != "" {
					tags = append(tags, trimmed)
				}
			}
		}

		sortOrder := ctx.SortOffset + len(out.Items) + 1
		if explicitSort := intPtrField(item, "sortOrder", "sort_order"); explicitSort != nil {
			sortOrder = *explicitSort
		}

		seen[slug] = struct{}{}
		ownerCopy := ownerHandle
		syncedCopy := fetchedAtISO
		out.Items = append(out.Items, Skill{
			Slug:          slug,
			Name:          name,
			Summary:       summary,
			Tags:          tags,
			URL:           trustedURL,
			SortOrder:     sortOrder,
			CreatorHandle: &ownerCopy,
			IsPublished:   true,
			SyncedAt:      &syncedCopy,
			Source:        "agensi_api",
		})
	}
	return out
}
