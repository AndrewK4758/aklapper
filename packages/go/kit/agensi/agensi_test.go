package agensi

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"
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

func TestAgensiUnicodeCaseFoldUnaryBoundsUserinfoScrubAndParseModeSeams(t *testing.T) {
	prefix := strings.Repeat("Ⱥ", 30) + "İ"

	tsrWithUnicode := `<!doctype html><html><body><p>` + prefix + `</p>` +
		`<SCRIPT DATA-TSR-STREAM-PART="0">` +
		`$R[1]={queryKey:["creator-profile","aklapper"],state:{data:{slug:"aklapper",user_id:"u-1"}}};` +
		`$R[2]={queryKey:["creator-skills","u-1"],state:{data:[{slug:"uni-tsr",name:"Uni TSR",summary:"Parsed cleanly",creator_id:"u-1"}]}};` +
		`</SCRIPT></body></html>`
	tsrRes := ParseCreatorHTML(tsrWithUnicode, "aklapper", "https://www.agensi.io/creators/aklapper")
	if !tsrRes.OK || tsrRes.ParseMode != "tsr_stream" || len(tsrRes.Items) != 1 || tsrRes.Items[0]["slug"] != "uni-tsr" {
		t.Fatalf("expected unicode-prefixed TSR parse to succeed without panic, got %+v", tsrRes)
	}

	cardsWithUnicode := `<!doctype html><html><body><div>` + prefix + `</div>` +
		`<ARTICLE><p>` + prefix + `</p><A HREF="/skills/uni-card"><H3>Unicode Card</H3></A><P>Summary text</P></ARTICLE>` +
		`</body></html>`
	cardRes := ParseCreatorHTML(cardsWithUnicode, "aklapper", "https://www.agensi.io/creators/aklapper")
	if !cardRes.OK || cardRes.ParseMode != "html_fallback" || len(cardRes.Items) != 1 || cardRes.Items[0]["slug"] != "uni-card" {
		t.Fatalf("expected unicode-prefixed HTML fallback parse to succeed without panic, got %+v", cardRes)
	}

	// Deep unary `!` nesting must fail closed with depth_limit_exceeded.
	deepUnary := `<script data-tsr-stream-part="0">` + strings.Repeat("!", MaxTSRDepth+5) + `0</script>`
	unaryRes := ParseCreatorHTML(deepUnary, "aklapper", "https://www.agensi.io/creators/aklapper")
	if unaryRes.OK || unaryRes.Reason != "depth_limit_exceeded" {
		t.Fatalf("expected depth_limit_exceeded on deep unary nesting, got %+v", unaryRes)
	}

	// Userinfo skill URLs must be rejected.
	var logBuf bytes.Buffer
	origOut := log.Writer()
	log.SetOutput(&logBuf)
	t.Cleanup(func() { log.SetOutput(origOut) })

	filtered := FilterCreatorPublishedSkills([]map[string]any{
		{
			"slug":          "bad-userinfo",
			"name":          "Userinfo Skill",
			"summary":       "Should be rejected",
			"url":           "https://user:pass@agensi.io/skills/bad-userinfo",
			"creatorHandle": "aklapper",
			"isPublished":   true,
		},
		{
			"slug":          "foreign-item",
			"name":          "Foreign",
			"summary":       "Foreign summary",
			"url":           "https://agensi.io/skills/foreign-item",
			"creatorHandle": "other",
			"isPublished":   true,
		},
		{
			"slug":          "draft-item",
			"name":          "Draft",
			"summary":       "Draft summary",
			"url":           "https://agensi.io/skills/draft-item",
			"creatorHandle": "aklapper",
			"isPublished":   false,
		},
	}, "aklapper", DefaultAllowedOrigins, FilterContext{CorrelationID: "corr-filter-1"})
	if len(filtered.Items) != 0 || filtered.RejectedInvalidCount != 1 || filtered.RejectedForeignCount != 1 || filtered.RejectedUnpublishedCount != 1 {
		t.Fatalf("unexpected filter rejection counts: %+v", filtered)
	}

	// ScrubSecret truncates on valid UTF-8 rune boundaries while redacting secrets.
	scrubbed := ScrubSecret("err secret-key-99 "+strings.Repeat("日", 320), "secret-key-99")
	if strings.Contains(scrubbed, "secret-key-99") || !strings.Contains(scrubbed, "[REDACTED]") ||
		!utf8.ValidString(scrubbed) || utf8.RuneCountInString(scrubbed) > 300 {
		t.Fatalf("expected valid UTF-8 scrubbed string <= 300 runes, got valid=%v runes=%d", utf8.ValidString(scrubbed), utf8.RuneCountInString(scrubbed))
	}

	// Verify agensi.catalog.parse_mode_total emissions across tsr_stream, html_fallback, parse_empty, and json.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Query().Get("mode") {
		case "tsr":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(tsrWithUnicode))
		case "html":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(cardsWithUnicode))
		case "empty":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte("<html><body>empty</body></html>"))
		default:
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"slug":"aklapper","skills":[{"slug":"j1","name":"J1","summary":"JSON item","url":"https://agensi.io/skills/j1"}]}`))
		}
	}))
	defer srv.Close()

	baseCfg := Config{
		BaseURL:        srv.URL,
		CreatorHandle:  "aklapper",
		TimeoutMs:      1500,
		MaxPages:       1,
		AllowedOrigins: append([]string{srv.URL}, DefaultAllowedOrigins...),
	}
	for _, tc := range []struct {
		path   string
		wantOK bool
	}{
		{"/creators/aklapper?mode=tsr", true},
		{"/creators/aklapper?mode=html", true},
		{"/creators/aklapper?mode=empty", false},
		{"/api/creators/aklapper?mode=json", true},
	} {
		c := baseCfg
		c.APIPath = tc.path
		r := FetchCreatorCatalog(context.Background(), c, FetchOptions{CorrelationID: "corr-pm"})
		if r.OK != tc.wantOK {
			t.Fatalf("FetchCreatorCatalog(%s) OK=%v want %v: %+v", tc.path, r.OK, tc.wantOK, r)
		}
	}

	logs := logBuf.String()
	for _, expected := range []string{
		`"event":"agensi.catalog.parse_mode_total"`,
		`"parse_mode":"tsr_stream"`,
		`"parse_mode":"html_fallback"`,
		`"parse_mode":"parse_empty"`,
		`"parse_mode":"json"`,
		`"event":"agensi.catalog.foreign_creator_rejected"`,
		`"event":"agensi.catalog.unpublished_item_rejected"`,
		`"event":"agensi.catalog.payload_validation_failed"`,
	} {
		if !strings.Contains(logs, expected) {
			t.Fatalf("expected seam log %s in:\n%s", expected, logs)
		}
	}
}
