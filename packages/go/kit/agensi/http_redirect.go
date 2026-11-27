package agensi

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

func isRedirectStatus(code int) bool {
	switch code {
	case http.StatusMovedPermanently, http.StatusFound, http.StatusSeeOther,
		http.StatusTemporaryRedirect, http.StatusPermanentRedirect:
		return true
	default:
		return false
	}
}

func isOriginAllowedForFetch(candidate, initial *url.URL, allowed map[string]struct{}) bool {
	if candidate == nil || candidate.User != nil || candidate.Host == "" {
		return false
	}
	scheme := strings.ToLower(candidate.Scheme)
	origin := scheme + "://" + strings.ToLower(candidate.Host)
	if scheme == "https" {
		_, ok := allowed[origin]
		return ok
	}
	if scheme == "http" && IsLoopbackHost(candidate.Hostname()) {
		if _, ok := allowed[origin]; ok {
			return true
		}
		initialOrigin := strings.ToLower(initial.Scheme) + "://" + strings.ToLower(initial.Host)
		return strings.EqualFold(initial.Scheme, "http") &&
			IsLoopbackHost(initial.Hostname()) &&
			origin == initialOrigin
	}
	return false
}

func fetchWithValidatedRedirects(
	ctx context.Context,
	client *http.Client,
	initialRawURL string,
	baseHeaders http.Header,
	allowedOrigins []string,
	correlationID string,
) (*http.Response, string, *FetchResult, error) {
	parsedInitial, err := url.Parse(initialRawURL)
	if err != nil {
		return nil, "", &FetchResult{
			ErrorCode: "AGENSI_UNTRUSTED_ORIGIN",
			Message:   "Agensi upstream initial URL is invalid.",
		}, nil
	}
	allowedSet := NormalizeAllowedOrigins(allowedOrigins)
	if !isOriginAllowedForFetch(parsedInitial, parsedInitial, allowedSet) {
		EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.untrusted_redirect", map[string]any{
			"correlationId": correlationID,
			"reason":        "untrusted_initial_origin",
			"hops":          0,
		})
		return nil, "", &FetchResult{
			ErrorCode: "AGENSI_UNTRUSTED_ORIGIN",
			Message:   "Agensi upstream initial origin is not allowed.",
		}, nil
	}

	manualClient := *client
	manualClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	currentURL := parsedInitial
	headers := baseHeaders.Clone()

	for hop := 0; hop <= MaxRedirects; hop++ {
		req, reqErr := http.NewRequestWithContext(ctx, http.MethodGet, currentURL.String(), nil)
		if reqErr != nil {
			return nil, "", nil, reqErr
		}
		req.Header = headers.Clone()

		resp, doErr := manualClient.Do(req)
		if doErr != nil {
			return nil, "", nil, doErr
		}

		if isRedirectStatus(resp.StatusCode) {
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()

			loc := strings.TrimSpace(resp.Header.Get("Location"))
			if loc == "" || hop >= MaxRedirects {
				reason := "too_many_redirects"
				msg := fmt.Sprintf("Agensi upstream exceeded %d redirect hops.", MaxRedirects)
				if loc == "" {
					reason = "missing_location"
					msg = "Agensi upstream redirect was missing a Location header."
				}
				EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.untrusted_redirect", map[string]any{
					"correlationId": correlationID,
					"reason":        reason,
					"hops":          hop,
				})
				return nil, "", &FetchResult{ErrorCode: "AGENSI_UNTRUSTED_ORIGIN", Message: msg}, nil
			}

			parsedLoc, parseErr := url.Parse(loc)
			if parseErr != nil {
				EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.untrusted_redirect", map[string]any{
					"correlationId": correlationID,
					"reason":        "malformed_location",
					"hops":          hop + 1,
				})
				return nil, "", &FetchResult{
					ErrorCode: "AGENSI_UNTRUSTED_ORIGIN",
					Message:   "Agensi upstream returned an invalid redirect URL.",
				}, nil
			}
			nextURL := currentURL.ResolveReference(parsedLoc)
			if !isOriginAllowedForFetch(nextURL, parsedInitial, allowedSet) {
				EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.untrusted_redirect", map[string]any{
					"correlationId": correlationID,
					"reason":        "untrusted_origin",
					"hops":          hop + 1,
				})
				return nil, "", &FetchResult{
					ErrorCode: "AGENSI_UNTRUSTED_ORIGIN",
					Message:   "Agensi upstream redirected to an untrusted origin.",
				}, nil
			}
			prevOrigin := strings.ToLower(currentURL.Scheme + "://" + currentURL.Host)
			nextOrigin := strings.ToLower(nextURL.Scheme + "://" + nextURL.Host)
			if nextOrigin != prevOrigin {
				headers.Del("X-Api-Key")
			}
			currentURL = nextURL
			continue
		}

		return resp, currentURL.String(), nil, nil
	}

	EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.untrusted_redirect", map[string]any{
		"correlationId": correlationID,
		"reason":        "too_many_redirects",
		"hops":          MaxRedirects,
	})
	return nil, "", &FetchResult{
		ErrorCode: "AGENSI_UNTRUSTED_ORIGIN",
		Message:   fmt.Sprintf("Agensi upstream exceeded %d redirect hops.", MaxRedirects),
	}, nil
}

func readBoundedBody(resp *http.Response, maxBytes int64, correlationID string) (string, *FetchResult, error) {
	defer func() { _ = resp.Body.Close() }()
	if resp.ContentLength > maxBytes {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.payload_too_large", map[string]any{
			"correlationId": correlationID,
			"reason":        "content_length_exceeded",
			"maxBytes":      maxBytes,
		})
		return "", &FetchResult{
			ErrorCode: "AGENSI_PAYLOAD_TOO_LARGE",
			Message:   fmt.Sprintf("Agensi response exceeded %d bytes.", maxBytes),
		}, nil
	}

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxBytes+1))
	if err != nil {
		return "", nil, err
	}
	if int64(len(raw)) > maxBytes {
		EmitSeamLog("BOUNDARY_FAULT", "agensi.catalog.payload_too_large", map[string]any{
			"correlationId": correlationID,
			"reason":        "stream_bytes_exceeded",
			"maxBytes":      maxBytes,
		})
		return "", &FetchResult{
			ErrorCode: "AGENSI_PAYLOAD_TOO_LARGE",
			Message:   fmt.Sprintf("Agensi response exceeded %d bytes.", maxBytes),
		}, nil
	}
	return string(raw), nil, nil
}
