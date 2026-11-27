package analytics

import (
	"math"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
)

func TestDailySaltHashingAndMidnightGrace(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("ANALYTICS_DAILY_SALT", "")
	if _, err := ResolveDailySaltSecret(""); err == nil {
		t.Fatal("expected production startup failure when ANALYTICS_DAILY_SALT is empty")
	}

	t.Setenv("APP_ENV", "development")
	devSalt, err := ResolveDailySaltSecret("")
	if err != nil || devSalt != DevFallbackDailySalt {
		t.Fatalf("expected dev fallback salt, got %q err=%v", devSalt, err)
	}

	utcEarly := time.Date(2026, 11, 27, 0, 15, 0, 0, time.UTC)
	if !IsWithinUtcMidnightGraceWindow(utcEarly, 30) {
		t.Fatal("expected 00:15 UTC to be inside 30m grace window")
	}
	utcLate := time.Date(2026, 11, 27, 0, 35, 0, 0, time.UTC)
	if IsWithinUtcMidnightGraceWindow(utcLate, 30) {
		t.Fatal("expected 00:35 UTC to be outside 30m grace window")
	}

	curSalt := BuildDailySalt("test-salt", utcEarly)
	prevSalt := BuildPreviousUtcDaySalt("test-salt", utcEarly)
	if curSalt != "test-salt:2026-11-27" || prevSalt != "test-salt:2026-11-26" {
		t.Fatalf("unexpected daily salts: cur=%q prev=%q", curSalt, prevSalt)
	}

	ipHash := HashVisitorIP("198.51.100.42", curSalt)
	visHash := HashVisitorIdentity("198.51.100.42", "  Mozilla/5.0 Chrome/130  ", curSalt)
	if len(ipHash) != 24 || len(visHash) != 32 {
		t.Fatalf("unexpected hash lengths: ipHash=%q visHash=%q", ipHash, visHash)
	}
}

func TestBotClassifierLookaroundsAndUAProfile(t *testing.T) {
	cases := []struct {
		ua     string
		isBot  bool
		branch string
	}{
		{"", true, BotBranchHeadlessMissing},
		{"curl/8.7.1", true, BotBranchHeadlessMissing},
		{"Mozilla/5.0 HeadlessChrome/128.0.0.0 Safari/537.36", true, BotBranchHeadlessMissing},
		{"Googlebot/2.1 (+http://www.google.com/bot.html)", true, BotBranchIsbot},
		{"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15", false, BotBranchHuman},
		{"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1", false, BotBranchHuman},
		// Exact lookaround exclusions from isbot@5.2.4:
		{"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Google Pixel Browser", false, BotBranchHuman},
		{"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 GoogleApp/300.0", false, BotBranchHuman},
		{"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile CamScanner/6.0", false, BotBranchHuman},
		{"Mozilla/5.0 (X11; Linux x86_64) NewsSapphire/1.0 Safari/537.36", false, BotBranchHuman},
		{"Mozilla/5.0 (X11; Linux x86_64) CuBot/2.0 Safari/537.36", false, BotBranchHuman},
		{"Mozilla/5.0 (X11; Linux x86_64) LibHTTP/1.0 Safari/537.36", false, BotBranchHuman},
		{"Mozilla/5.0 (X11; Linux x86_64) Java; Safari/537.36", false, BotBranchHuman},
		// Positive lookaround bot triggers:
		{"Mozilla/5.0 NewsReader/2.0", true, BotBranchIsbot},
		{"Mozilla/5.0 CustomScan/1.0", true, BotBranchIsbot},
		{"Java/17.0.1", true, BotBranchIsbot},
	}

	for _, tc := range cases {
		got := ClassifyBotUserAgent(tc.ua)
		if got.IsBot != tc.isBot || got.Branch != tc.branch {
			t.Errorf("ClassifyBotUserAgent(%q) = %+v, want {IsBot:%v Branch:%q}", tc.ua, got, tc.isBot, tc.branch)
		}
	}

	profile := ParseUserAgentProfile("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1")
	if profile.DeviceType != "mobile" || profile.OSName == nil || *profile.OSName != "iOS" || profile.BrowserName == nil || *profile.BrowserName != "Chrome" {
		t.Fatalf("unexpected mobile profile: %+v", profile)
	}
}

func TestReferrerCampaignAndBatchBounds(t *testing.T) {
	ref := NormalizeReferrer("https://user:secret@www.linkedin.com/feed/update/123?token=abc#frag", []string{"andrew-k.us"})
	if ref.Referrer == nil || *ref.Referrer != "https://www.linkedin.com/feed/update/123" ||
		ref.ReferrerHost == nil || *ref.ReferrerHost != "linkedin.com" ||
		ref.ReferrerCategory != "social" {
		t.Fatalf("unexpected normalized referrer: %+v", ref)
	}
	selfRef := NormalizeReferrer("https://www.andrew-k.us/about", []string{"andrew-k.us"})
	if selfRef.Referrer != nil || selfRef.ReferrerCategory != "direct" {
		t.Fatalf("expected direct self-ref, got %+v", selfRef)
	}

	camp := ExtractCampaignParams("https://andrew-k.us/about/?ref=recruiter&utm_source=linkedin&utm_campaign=fall26")
	if camp.LandingPath != "/about" || camp.RefParam == nil || *camp.RefParam != "recruiter" || camp.UTMSource == nil || *camp.UTMSource != "linkedin" {
		t.Fatalf("unexpected campaign params: %+v", camp)
	}

	validBatch := &portalv1.IngestAnalyticsRequest{
		SessionId: "sess_1",
		Events: []*portalv1.AnalyticsEvent{
			{
				Type:      "error",
				Name:      "client_error",
				Path:      "/about",
				Timestamp: "2026-11-27T12:00:00Z",
				Metadata: map[string]*portalv1.AnalyticsMetadataValue{
					"correlationId": {Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: strings.Repeat("a", 128)}},
					"code":          {Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: "ERR_INTERNAL"}},
					"source":        {Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: "boundary"}},
					"status":        {Kind: &portalv1.AnalyticsMetadataValue_NumberValue{NumberValue: 500}},
					"recovered":     {Kind: &portalv1.AnalyticsMetadataValue_BoolValue{BoolValue: true}},
				},
			},
		},
	}
	if err := ValidateBatchBounds(validBatch); err != nil {
		t.Fatalf("expected valid client error batch to pass, got %v", err)
	}

	// 17 metadata keys rejected
	tooManyKeys := map[string]*portalv1.AnalyticsMetadataValue{}
	for i := 0; i < 17; i++ {
		tooManyKeys["k"+strings.Repeat("x", i+1)] = &portalv1.AnalyticsMetadataValue{
			Kind: &portalv1.AnalyticsMetadataValue_BoolValue{BoolValue: true},
		}
	}
	if err := ValidateBatchBounds(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_1",
		Events: []*portalv1.AnalyticsEvent{{
			Type: "interaction", Name: "click", Path: "/", Timestamp: "2026-11-27T12:00:00Z", Metadata: tooManyKeys,
		}},
	}); err == nil {
		t.Fatal("expected 17 metadata keys to fail")
	}

	// 257-char string value rejected
	if err := ValidateBatchBounds(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_1",
		Events: []*portalv1.AnalyticsEvent{{
			Type: "interaction", Name: "click", Path: "/", Timestamp: "2026-11-27T12:00:00Z",
			Metadata: map[string]*portalv1.AnalyticsMetadataValue{
				"k": {Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: strings.Repeat("a", 257)}},
			},
		}},
	}); err == nil {
		t.Fatal("expected 257-char metadata string to fail")
	}

	// NaN rejected
	if err := ValidateBatchBounds(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_1",
		Events: []*portalv1.AnalyticsEvent{{
			Type: "web_vital", Name: "LCP", Path: "/", Timestamp: "2026-11-27T12:00:00Z",
			Metadata: map[string]*portalv1.AnalyticsMetadataValue{
				"n": {Kind: &portalv1.AnalyticsMetadataValue_NumberValue{NumberValue: math.NaN()}},
			},
		}},
	}); err == nil {
		t.Fatal("expected NaN metadata number to fail")
	}

	// >2048 B serialized metadata rejected (10 keys x 220 chars = ~2300 B)
	bigMeta := map[string]*portalv1.AnalyticsMetadataValue{}
	for i := 0; i < 10; i++ {
		bigMeta["key_"+strings.Repeat("k", i+1)] = &portalv1.AnalyticsMetadataValue{
			Kind: &portalv1.AnalyticsMetadataValue_StringValue{StringValue: strings.Repeat("v", 220)},
		}
	}
	if err := ValidateBatchBounds(&portalv1.IngestAnalyticsRequest{
		SessionId: "sess_1",
		Events: []*portalv1.AnalyticsEvent{{
			Type: "interaction", Name: "click", Path: "/", Timestamp: "2026-11-27T12:00:00Z", Metadata: bigMeta,
		}},
	}); err == nil {
		t.Fatal("expected >2048 byte metadata to fail")
	}
}

func TestUTF8SafeRuneTruncation(t *testing.T) {
	cjkPath := "/p/" + strings.Repeat("日", 200)
	gotCJK := NormalizeLandingPath(cjkPath)
	if !utf8.ValidString(gotCJK) || gotCJK != cjkPath {
		t.Fatalf("expected valid intact 203-rune CJK path, got valid=%v runes=%d", utf8.ValidString(gotCJK), utf8.RuneCountInString(gotCJK))
	}

	accentPath := "/" + strings.Repeat("a", 510) + "é"
	gotAccent := NormalizeLandingPath(accentPath)
	if !utf8.ValidString(gotAccent) || gotAccent != accentPath {
		t.Fatalf("expected valid 512-rune accented path, got valid=%v runes=%d", utf8.ValidString(gotAccent), utf8.RuneCountInString(gotAccent))
	}

	overPath := "/p/" + strings.Repeat("日", 600)
	gotOver := NormalizeLandingPath(overPath)
	if !utf8.ValidString(gotOver) || utf8.RuneCountInString(gotOver) != MaxPathLen {
		t.Fatalf("expected valid UTF-8 truncated to %d runes, got valid=%v runes=%d", MaxPathLen, utf8.ValidString(gotOver), utf8.RuneCountInString(gotOver))
	}

	overRef := "https://example.com/" + strings.Repeat("é", 600)
	gotRef := NormalizeReferrer(overRef, nil)
	if gotRef.Referrer == nil || !utf8.ValidString(*gotRef.Referrer) || utf8.RuneCountInString(*gotRef.Referrer) > MaxReferrerLen {
		t.Fatalf("expected valid UTF-8 truncated referrer <= %d runes, got %+v", MaxReferrerLen, gotRef)
	}
}
