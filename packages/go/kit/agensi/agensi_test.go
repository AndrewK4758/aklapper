package agensi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAgensiTSRTwoQueryAndHTMLCardParsing(t *testing.T) {
	tsrHTML := `<!doctype html><html><body>
<script data-tsr-stream-part="0">
$R[1]={queryKey:["creator-profile","aklapper"],state:{data:{slug:"aklapper",user_id:"u-42"}}};
$R[2]={queryKey:["creator-skills","u-42"],state:{data:[
  {slug:"skill-alpha",name:"Alpha Skill",summary:"First skill summary",tags:["go","grpc"],creator_id:"u-42",sortOrder:2},
  {slug:"skill-beta",name:"Beta Skill",summary:"Second skill summary",tags:["ssr"],creator_id:"u-42",sortOrder:1},
  {slug:"foreign-skill",name:"Foreign",summary:"Should be excluded",creator_id:"u-999"}
]}};
</script>
</body></html>`

	res := ParseCreatorHTML(tsrHTML, "aklapper", "https://www.agensi.io/creators/aklapper")
	if !res.OK || res.ParseMode != "tsr_stream" || res.CreatorHandle != "aklapper" || len(res.Items) != 2 {
		t.Fatalf("unexpected TSR parse result: %+v", res)
	}
	if res.Items[0]["url"] != "https://agensi.io/skills/skill-alpha" {
		t.Fatalf("expected canonical skill URL, got %v", res.Items[0]["url"])
	}

	cardHTML := `<!doctype html><html><body>
<article><a href="/skills/card-one"><h3>Card &amp; One</h3></a><p>by aklapper</p><p>Semantic card summary</p></article>
</body></html>`
	fb := ParseCreatorHTML(cardHTML, "aklapper", "https://www.agensi.io/creators/aklapper")
	if !fb.OK || fb.ParseMode != "html_fallback" || len(fb.Items) != 1 {
		t.Fatalf("unexpected HTML fallback result: %+v", fb)
	}
	if fb.Items[0]["name"] != "Card & One" || fb.Items[0]["summary"] != "Semantic card summary" {
		t.Fatalf("unexpected decoded card fields: %+v", fb.Items[0])
	}

	// Token limit cap fails closed
	huge := `<script data-tsr-stream-part="0">` + strings.Repeat("a,", MaxTSRTokens+5) + `</script>`
	lim := ParseCreatorHTML(huge, "aklapper", "https://www.agensi.io/creators/aklapper")
	if lim.OK || lim.Reason != "token_limit_exceeded" {
		t.Fatalf("expected token_limit_exceeded, got %+v", lim)
	}
}

func TestAgensiFetchPaginationRedirectsAndBounds(t *testing.T) {
	var seenCrossOriginKey string
	targetSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenCrossOriginKey = r.Header.Get("X-Api-Key")
		if r.Header.Get("If-None-Match") == `"v1"` {
			w.WriteHeader(http.StatusNotModified)
			return
		}
		if r.URL.Query().Get("oversized") == "1" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(strings.Repeat("x", MaxResponseBytes+10)))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("ETag", `"v1"`)
		if r.URL.Query().Get("cursor") == "" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"slug": "aklapper",
				"skills": []map[string]any{
					{"slug": "s2", "name": "Skill Two", "summary": "Second", "url": "https://agensi.io/skills/s2", "sortOrder": 2},
					{"slug": "draft-1", "name": "Draft", "summary": "Draft", "url": "https://agensi.io/skills/draft-1", "isPublished": false},
				},
				"nextCursor": "p2",
			})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"slug": "aklapper",
			"skills": []map[string]any{
				{"slug": "s1", "name": "Skill One", "summary": "First", "url": "https://agensi.io/skills/s1", "sortOrder": 1},
			},
		})
	}))
	defer targetSrv.Close()

	// Cross-origin redirect server (different loopback port) verifies x-api-key stripping
	redirSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, targetSrv.URL+r.URL.RequestURI(), http.StatusFound)
	}))
	defer redirSrv.Close()

	cfg := Config{
		BaseURL:        redirSrv.URL,
		APIPath:        "/api/creators/aklapper",
		CreatorHandle:  "aklapper",
		APIKey:         "super-secret-agensi-key",
		TimeoutMs:      1500,
		MaxPages:       MaxPages,
		AllowedOrigins: []string{"https://agensi.io", "https://www.agensi.io", redirSrv.URL, targetSrv.URL},
	}

	res := FetchCreatorCatalog(context.Background(), cfg, FetchOptions{CorrelationID: "corr-ag-1"})
	if !res.OK || res.NotModified || len(res.Items) != 2 {
		t.Fatalf("expected 2 paginated skills, got %+v", res)
	}
	if res.Items[0].Slug != "s1" || res.Items[1].Slug != "s2" {
		t.Fatalf("expected sorted [s1, s2], got %+v", res.Items)
	}
	if res.RejectedUnpublishedCount != 1 {
		t.Fatalf("expected 1 unpublished rejected, got %d", res.RejectedUnpublishedCount)
	}
	if seenCrossOriginKey != "" {
		t.Fatalf("expected X-Api-Key stripped on cross-origin redirect, got %q", seenCrossOriginKey)
	}

	notMod := FetchCreatorCatalog(context.Background(), cfg, FetchOptions{ETag: `"v1"`})
	if !notMod.OK || !notMod.NotModified {
		t.Fatalf("expected 304 NotModified, got %+v", notMod)
	}

	cfgOversized := cfg
	cfgOversized.BaseURL = targetSrv.URL
	cfgOversized.APIPath = "/api/creators/aklapper?oversized=1"
	tooBig := FetchCreatorCatalog(context.Background(), cfgOversized, FetchOptions{})
	if tooBig.OK || tooBig.ErrorCode != "AGENSI_PAYLOAD_TOO_LARGE" {
		t.Fatalf("expected AGENSI_PAYLOAD_TOO_LARGE, got %+v", tooBig)
	}
}
