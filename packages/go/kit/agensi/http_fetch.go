package agensi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type FetchOptions struct {
	CorrelationID string
	ETag          string
	HTTPClient    *http.Client
}

type FetchResult struct {
	OK                       bool
	NotModified              bool
	Items                    []Skill
	FetchedAt                time.Time
	ETag                     string
	RejectedForeignCount     int
	RejectedUnpublishedCount int
	RejectedInvalidCount     int
	ErrorCode                string
	HTTPStatus               int
	Message                  string
}

func joinUpstreamURL(baseURL, targetPath string) string {
	trimmedBase := strings.TrimRight(baseURL, "/")
	if strings.HasPrefix(targetPath, "/") {
		return trimmedBase + targetPath
	}
	return trimmedBase + "/" + targetPath
}

func buildPagePath(apiPath, cursor string, pageNum int) string {
	if cursor == "" && pageNum <= 0 {
		return apiPath
	}
	rawPath := apiPath
	if !strings.HasPrefix(rawPath, "/") {
		rawPath = "/" + rawPath
	}
	parsed, err := url.Parse("http://agensi.local" + rawPath)
	if err != nil {
		return apiPath
	}
	q := parsed.Query()
	if cursor != "" {
		q.Set("cursor", cursor)
	} else if pageNum > 0 {
		q.Set("page", strconv.Itoa(pageNum))
	}
	parsed.RawQuery = q.Encode()
	if parsed.RawQuery == "" {
		return parsed.Path
	}
	return parsed.Path + "?" + parsed.RawQuery
}

func isHTMLContentType(ct string) bool {
	low := strings.ToLower(ct)
	return strings.Contains(low, "text/html") || strings.Contains(low, "application/xhtml+xml")
}

func invalidPayloadResult(corrID, reason, msg string) FetchResult {
	EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.payload_validation_failed", map[string]any{
		"correlationId": corrID,
		"reason":        reason,
	})
	return FetchResult{ErrorCode: "AGENSI_INVALID_PAYLOAD", Message: msg}
}

func resolveEnvelopeCreator(rawObj map[string]any, isCreatorProfile bool) string {
	if c, ok := rawObj["creator"].(map[string]any); ok {
		if h := stringField(c, "slug", "handle"); h != "" {
			return h
		}
	}
	if h := stringField(rawObj, "creatorHandle", "creator_handle", "creatorSlug", "creator_slug"); h != "" {
		return h
	}
	if isCreatorProfile {
		return stringField(rawObj, "slug")
	}
	return ""
}

func resolveNextPageNumber(rawObj map[string]any) int {
	if p := intPtrField(rawObj, "nextPage", "next_page"); p != nil && *p > 0 {
		return *p
	}
	page := intPtrField(rawObj, "page")
	total := intPtrField(rawObj, "totalPages", "total_pages")
	if page != nil && total != nil && *page > 0 && *page < *total {
		return *page + 1
	}
	return 0
}

func FetchCreatorCatalog(ctx context.Context, cfg Config, opts FetchOptions) FetchResult {
	safeBase := ValidateUpstreamBaseURL(cfg.BaseURL)
	if safeBase == "" {
		return FetchResult{
			ErrorCode: "AGENSI_NOT_CONFIGURED",
			Message:   "AGENSI_API_BASE_URL is unset or invalid.",
		}
	}

	timeoutMs := ClampFetchTimeoutMs(cfg.TimeoutMs, cfg.TimeoutMs > 0)
	maxPages := cfg.MaxPages
	if maxPages <= 0 || maxPages > MaxPages {
		maxPages = MaxPages
	}
	httpClient := opts.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{}
	}

	reqCtx, cancel := context.WithTimeout(ctx, time.Duration(timeoutMs)*time.Millisecond)
	defer cancel()

	fetchedAt := time.Now().UTC()
	seenSlugs := make(map[string]struct{})
	seenCursors := make(map[string]struct{})
	collected := make([]Skill, 0)
	accept := "text/html, application/json;q=0.9"
	if strings.HasPrefix(cfg.APIPath, "/api/") {
		accept = "application/json, text/html;q=0.9"
	}

	var rejectedForeign, rejectedUnpub, rejectedInvalid int
	var page1ETag, nextCursor string
	var nextPageNum int

	for pageIdx := 0; pageIdx < maxPages; pageIdx++ {
		targetURL := joinUpstreamURL(safeBase, buildPagePath(cfg.APIPath, nextCursor, nextPageNum))
		headers := http.Header{}
		headers.Set("Accept", accept)
		if key := strings.TrimSpace(cfg.APIKey); key != "" {
			headers.Set("X-Api-Key", key)
		}
		if pageIdx == 0 && strings.TrimSpace(opts.ETag) != "" {
			headers.Set("If-None-Match", strings.TrimSpace(opts.ETag))
		}

		resp, effectiveURL, failRes, doErr := fetchWithValidatedRedirects(
			reqCtx, httpClient, targetURL, headers, cfg.AllowedOrigins, opts.CorrelationID,
		)
		if failRes != nil {
			return *failRes
		}
		if doErr != nil {
			if errors.Is(doErr, context.DeadlineExceeded) || errors.Is(reqCtx.Err(), context.DeadlineExceeded) {
				return FetchResult{
					ErrorCode: "AGENSI_TIMEOUT",
					Message:   fmt.Sprintf("Agensi catalog request timed out after %dms.", timeoutMs),
				}
			}
			return FetchResult{
				ErrorCode: "AGENSI_UNAVAILABLE",
				Message:   "Agensi catalog request failed: " + ScrubSecret(doErr.Error(), cfg.APIKey),
			}
		}

		if pageIdx == 0 && resp.StatusCode == http.StatusNotModified {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			etag := strings.TrimSpace(resp.Header.Get("ETag"))
			if etag == "" {
				etag = strings.TrimSpace(opts.ETag)
			}
			return FetchResult{OK: true, NotModified: true, FetchedAt: fetchedAt, ETag: etag}
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			return FetchResult{
				ErrorCode:  "AGENSI_HTTP_ERROR",
				HTTPStatus: resp.StatusCode,
				Message:    fmt.Sprintf("Agensi catalog upstream returned HTTP %d.", resp.StatusCode),
			}
		}
		if pageIdx == 0 {
			page1ETag = strings.TrimSpace(resp.Header.Get("ETag"))
		}

		bodyText, sizeFail, readErr := readBoundedBody(resp, MaxResponseBytes, opts.CorrelationID)
		if sizeFail != nil {
			return *sizeFail
		}
		if readErr != nil {
			if errors.Is(readErr, context.DeadlineExceeded) || errors.Is(reqCtx.Err(), context.DeadlineExceeded) {
				return FetchResult{
					ErrorCode: "AGENSI_TIMEOUT",
					Message:   fmt.Sprintf("Agensi catalog request timed out after %dms.", timeoutMs),
				}
			}
			return FetchResult{
				ErrorCode: "AGENSI_UNAVAILABLE",
				Message:   "Agensi catalog response stream failed: " + ScrubSecret(readErr.Error(), cfg.APIKey),
			}
		}

		if isHTMLContentType(resp.Header.Get("Content-Type")) {
			parsedHTML := ParseCreatorHTML(bodyText, cfg.CreatorHandle, effectiveURL)
			if !parsedHTML.OK {
				EmitSeamLog("RULE_DIVERGENCE", "agensi.catalog.parse_mode_total", map[string]any{
					"correlationId": opts.CorrelationID,
					"parse_mode":    "parse_empty",
				})
				return invalidPayloadResult(opts.CorrelationID, parsedHTML.Reason, parsedHTML.Message)
			}
			EmitSeamLog("RULE_DIVERGENCE", "agensi.catalog.parse_mode_total", map[string]any{
				"correlationId": opts.CorrelationID,
				"parse_mode":    parsedHTML.ParseMode,
			})
			filtered := FilterCreatorPublishedSkills(parsedHTML.Items, cfg.CreatorHandle, cfg.AllowedOrigins, FilterContext{
				EnvelopeCreatorHandle:  parsedHTML.CreatorHandle,
				IsCreatorProfileSkills: true,
				FetchedAt:              fetchedAt,
				CorrelationID:          opts.CorrelationID,
				SortOffset:             len(collected),
				SeenSlugs:              seenSlugs,
			})
			collected = append(collected, filtered.Items...)
			rejectedForeign += filtered.RejectedForeignCount
			rejectedUnpub += filtered.RejectedUnpublishedCount
			rejectedInvalid += filtered.RejectedInvalidCount
			break
		}

		var rawObj map[string]any
		if err := json.Unmarshal([]byte(bodyText), &rawObj); err != nil || rawObj == nil {
			return invalidPayloadResult(opts.CorrelationID, "malformed_json", "Agensi catalog response was not valid JSON object.")
		}
		var rawItemsSlice []any
		var isCreatorProfile bool
		if arr, ok := rawObj["items"].([]any); ok {
			rawItemsSlice = arr
		} else if arr, ok := rawObj["skills"].([]any); ok {
			rawItemsSlice = arr
			isCreatorProfile = true
		} else if arr, ok := rawObj["data"].([]any); ok {
			rawItemsSlice = arr
		} else {
			return invalidPayloadResult(opts.CorrelationID, "missing_items_array", "Agensi catalog envelope is missing an items or skills array.")
		}

		if pageIdx == 0 {
			EmitSeamLog("RULE_DIVERGENCE", "agensi.catalog.parse_mode_total", map[string]any{
				"correlationId": opts.CorrelationID,
				"parse_mode":    "json",
			})
		}

		rawMaps := make([]map[string]any, 0, len(rawItemsSlice))
		for _, entry := range rawItemsSlice {
			if m, ok := entry.(map[string]any); ok {
				rawMaps = append(rawMaps, m)
			} else {
				rawMaps = append(rawMaps, map[string]any{})
			}
		}

		filtered := FilterCreatorPublishedSkills(rawMaps, cfg.CreatorHandle, cfg.AllowedOrigins, FilterContext{
			EnvelopeCreatorHandle:  resolveEnvelopeCreator(rawObj, isCreatorProfile),
			IsCreatorProfileSkills: isCreatorProfile,
			FetchedAt:              fetchedAt,
			CorrelationID:          opts.CorrelationID,
			SortOffset:             len(collected),
			SeenSlugs:              seenSlugs,
		})
		collected = append(collected, filtered.Items...)
		rejectedForeign += filtered.RejectedForeignCount
		rejectedUnpub += filtered.RejectedUnpublishedCount
		rejectedInvalid += filtered.RejectedInvalidCount

		candCursor := stringField(rawObj, "nextCursor", "next_cursor", "cursor")
		if candCursor != "" {
			if _, seen := seenCursors[candCursor]; seen {
				break
			}
			seenCursors[candCursor] = struct{}{}
			nextCursor = candCursor
			nextPageNum = 0
			continue
		}

		candNextPage := resolveNextPageNumber(rawObj)
		if candNextPage > 0 {
			key := "page:" + strconv.Itoa(candNextPage)
			if _, seen := seenCursors[key]; seen {
				break
			}
			seenCursors[key] = struct{}{}
			nextCursor = ""
			nextPageNum = candNextPage
			continue
		}
		break
	}

	sort.Slice(collected, func(i, j int) bool {
		if collected[i].SortOrder != collected[j].SortOrder {
			return collected[i].SortOrder < collected[j].SortOrder
		}
		return collected[i].Slug < collected[j].Slug
	})

	return FetchResult{
		OK:                       true,
		Items:                    collected,
		FetchedAt:                fetchedAt,
		ETag:                     page1ETag,
		RejectedForeignCount:     rejectedForeign,
		RejectedUnpublishedCount: rejectedUnpub,
		RejectedInvalidCount:     rejectedInvalid,
	}
}
