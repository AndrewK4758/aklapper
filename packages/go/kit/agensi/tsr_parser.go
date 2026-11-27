package agensi

import (
	"net/url"
	"reflect"
	"strings"
)

type HTMLParseResult struct {
	OK            bool
	ParseMode     string // "tsr_stream" | "html_fallback"
	CreatorHandle string
	Items         []map[string]any
	Reason        string
	Message       string
}

type profileEntry struct {
	handle       string
	creatorID    string
	inlineSkills []map[string]any
}

func resolveTSRRef(val any, refs map[int]any, seen map[int]struct{}) any {
	ph, ok := val.(tsrRefPlaceholder)
	if !ok {
		return val
	}
	if _, cycle := seen[ph.refIdx]; cycle {
		return nil
	}
	seen[ph.refIdx] = struct{}{}
	return resolveTSRRef(refs[ph.refIdx], refs, seen)
}

func normalizeExtractedSkill(raw any, refs map[int]any) map[string]any {
	resolved := resolveTSRRef(raw, refs, map[int]struct{}{})
	m, ok := resolved.(map[string]any)
	if !ok || m == nil {
		return nil
	}
	out := make(map[string]any, len(m)+1)
	for k, v := range m {
		rv := resolveTSRRef(v, refs, map[int]struct{}{})
		if arr, isArr := rv.([]any); isArr {
			resolvedArr := make([]any, len(arr))
			for i, el := range arr {
				resolvedArr[i] = resolveTSRRef(el, refs, map[int]struct{}{})
			}
			out[k] = resolvedArr
		} else {
			out[k] = rv
		}
	}
	slug := stringField(out, "slug")
	rawURL := stringField(out, "url")
	if slug != "" && rawURL == "" {
		out["url"] = CanonicalSkillOrigin + url.PathEscape(slug)
	}
	return out
}

func normalizeSkillArray(rawSkills []any, refs map[int]any) []map[string]any {
	out := make([]map[string]any, 0, len(rawSkills))
	for _, raw := range rawSkills {
		if norm := normalizeExtractedSkill(raw, refs); norm != nil {
			out = append(out, norm)
		}
	}
	return out
}

func extractQueryStateData(record map[string]any, refs map[int]any) any {
	if st, ok := resolveTSRRef(record["state"], refs, map[int]struct{}{}).(map[string]any); ok {
		if d, has := st["data"]; has {
			return resolveTSRRef(d, refs, map[int]struct{}{})
		}
	}
	if d, has := record["data"]; has {
		return resolveTSRRef(d, refs, map[int]struct{}{})
	}
	return record
}

func findCreatorProfileQuery(roots []any, refs map[int]any, expectedCreator string) (string, []map[string]any, bool) {
	visited := make(map[uintptr]struct{})
	profiles := make([]profileEntry, 0)
	skillsByKey := make(map[string][]map[string]any)

	var walk func(node any, depth int)
	walk = func(node any, depth int) {
		if depth > MaxTSRDepth {
			return
		}
		resolved := resolveTSRRef(node, refs, map[int]struct{}{})
		if resolved == nil {
			return
		}
		rv := reflect.ValueOf(resolved)
		if rv.Kind() == reflect.Map || rv.Kind() == reflect.Slice {
			ptr := rv.Pointer()
			if ptr != 0 {
				if _, seen := visited[ptr]; seen {
					return
				}
				visited[ptr] = struct{}{}
			}
		}

		switch typed := resolved.(type) {
		case []any:
			for _, el := range typed {
				walk(el, depth+1)
			}
		case map[string]any:
			qk, _ := resolveTSRRef(typed["queryKey"], refs, map[int]struct{}{}).([]any)
			if len(qk) >= 2 {
				keyKind, _ := qk[0].(string)
				keyArg, okArg := qk[1].(string)
				keyArg = strings.TrimSpace(keyArg)
				if okArg {
					data := extractQueryStateData(typed, refs)
					if keyKind == "creator-profile" {
						if dataMap, isMap := data.(map[string]any); isMap {
							handle := stringField(dataMap, "slug", "handle")
							if handle == "" {
								handle = keyArg
							}
							creatorID := stringField(dataMap, "user_id", "id")
							var inline []map[string]any
							if rawInline, isArr := resolveTSRRef(dataMap["skills"], refs, map[int]struct{}{}).([]any); isArr {
								inline = normalizeSkillArray(rawInline, refs)
							}
							profiles = append(profiles, profileEntry{
								handle:       handle,
								creatorID:    creatorID,
								inlineSkills: inline,
							})
						}
					} else if keyKind == "creator-skills" && keyArg != "" {
						var rawList []any
						if arr, isArr := data.([]any); isArr {
							rawList = arr
						} else if dataMap, isMap := data.(map[string]any); isMap {
							rawList, _ = resolveTSRRef(dataMap["skills"], refs, map[int]struct{}{}).([]any)
						}
						if rawList != nil {
							skillsByKey[strings.ToLower(keyArg)] = normalizeSkillArray(rawList, refs)
						}
					}
				}
			}
			for _, v := range typed {
				walk(v, depth+1)
			}
		}
	}

	for _, root := range roots {
		walk(root, 0)
	}
	if len(profiles) == 0 {
		return "", nil, false
	}

	normExpected := strings.ToLower(strings.TrimSpace(expectedCreator))
	matched := profiles[0]
	for _, p := range profiles {
		if strings.ToLower(p.handle) == normExpected {
			matched = p
			break
		}
	}
	if matched.inlineSkills != nil {
		return matched.handle, matched.inlineSkills, true
	}

	var joined []map[string]any
	if matched.creatorID != "" {
		joined = skillsByKey[strings.ToLower(matched.creatorID)]
	}
	if joined == nil {
		joined = skillsByKey[strings.ToLower(matched.handle)]
	}
	if joined == nil {
		return "", nil, false
	}

	expectedID := strings.ToLower(matched.creatorID)
	verified := make([]map[string]any, 0, len(joined))
	for _, item := range joined {
		itemCreatorID := strings.ToLower(stringField(item, "creator_id", "creatorId"))
		if expectedID == "" || itemCreatorID == "" || itemCreatorID == expectedID {
			verified = append(verified, item)
		}
	}
	return matched.handle, verified, true
}

// ParseCreatorHTML extracts creator skills using non-executing TSR hydration parsing
// with linear semantic HTML card fallback.
func ParseCreatorHTML(html, creatorHandle, finalURL string) HTMLParseResult {
	lowerHTML := strings.ToLower(html)
	scripts := scanTagBlocksLinear(html, lowerHTML, "script")
	tsrScripts := make([]string, 0)
	for _, sc := range scripts {
		if strings.Contains(strings.ToLower(sc.openTag), "data-tsr-stream-part") && strings.TrimSpace(sc.body) != "" {
			tsrScripts = append(tsrScripts, sc.body)
		}
	}

	if len(tsrScripts) > 0 {
		refs := make(map[int]any)
		roots := make([]any, 0)
		for _, body := range tsrScripts {
			parsed, err := parseTSRScriptBody(body, refs)
			if err != nil {
				if lim, ok := isTSRLimitError(err); ok {
					return HTMLParseResult{Reason: lim.reason, Message: lim.message}
				}
				return HTMLParseResult{Reason: "tsr_parse_error", Message: "Agensi TSR stream payload could not be parsed."}
			}
			roots = append(roots, parsed...)
		}
		allRoots := make([]any, 0, len(roots)+len(refs))
		allRoots = append(allRoots, roots...)
		for _, v := range refs {
			allRoots = append(allRoots, v)
		}
		if handle, skills, found := findCreatorProfileQuery(allRoots, refs, creatorHandle); found {
			return HTMLParseResult{
				OK:            true,
				ParseMode:     "tsr_stream",
				CreatorHandle: handle,
				Items:         skills,
			}
		}
	}

	fallback := extractSemanticHTMLFallback(html, lowerHTML, creatorHandle, finalURL)
	if len(fallback) > 0 {
		return HTMLParseResult{
			OK:            true,
			ParseMode:     "html_fallback",
			CreatorHandle: creatorHandle,
			Items:         fallback,
		}
	}

	return HTMLParseResult{
		Reason:  "no_creator_skills_found",
		Message: "Agensi HTML response did not contain creator profile skills.",
	}
}
