package analytics

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

type goldenParityCorpus struct {
	NowISO      string `json:"nowIso"`
	BaseSalt    string `json:"baseSalt"`
	CurrentSalt string `json:"currentSalt"`
	PriorSalt   string `json:"priorSalt"`
	WithinGrace bool   `json:"withinGrace"`
	Identities  []struct {
		IP                 string `json:"ip"`
		UA                 string `json:"ua"`
		CurrentIPHash      string `json:"currentIpHash"`
		PriorIPHash        string `json:"priorIpHash"`
		CurrentVisitorHash string `json:"currentVisitorHash"`
		PriorVisitorHash   string `json:"priorVisitorHash"`
		AdvisoryLockKey    string `json:"advisoryLockKey"`
	} `json:"identities"`
	UserAgents []struct {
		UA  string `json:"ua"`
		Bot struct {
			IsBot  bool   `json:"isBot"`
			Branch string `json:"branch"`
		} `json:"bot"`
		Profile struct {
			DeviceType  string  `json:"deviceType"`
			OSName      *string `json:"osName"`
			BrowserName *string `json:"browserName"`
		} `json:"profile"`
	} `json:"userAgents"`
	Referrers []struct {
		Raw      string   `json:"raw"`
		OwnHosts []string `json:"ownHosts"`
		Expected struct {
			Referrer         *string `json:"referrer"`
			ReferrerHost     *string `json:"referrerHost"`
			ReferrerCategory string  `json:"referrerCategory"`
		} `json:"expected"`
	} `json:"referrers"`
	Campaigns []struct {
		RawURL         string `json:"rawUrl"`
		NormalizedPath string `json:"normalizedPath"`
		Expected       struct {
			LandingPath string  `json:"landingPath"`
			RefParam    *string `json:"refParam"`
			UTMSource   *string `json:"utmSource"`
			UTMMedium   *string `json:"utmMedium"`
			UTMCampaign *string `json:"utmCampaign"`
			UTMContent  *string `json:"utmContent"`
		} `json:"expected"`
	} `json:"campaigns"`
}

func ptrEqual(a, b *string) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func TestCrossLanguageGoldenParityMatchesNode(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("testdata", "golden_parity.json"))
	if err != nil {
		t.Fatalf("read golden_parity.json: %v", err)
	}
	var corpus goldenParityCorpus
	if err := json.Unmarshal(raw, &corpus); err != nil {
		t.Fatalf("unmarshal golden_parity.json: %v", err)
	}
	now, err := time.Parse(time.RFC3339Nano, corpus.NowISO)
	if err != nil {
		t.Fatalf("parse nowIso: %v", err)
	}

	curSalt := BuildDailySalt(corpus.BaseSalt, now)
	priorSalt := BuildPreviousUtcDaySalt(corpus.BaseSalt, now)
	if curSalt != corpus.CurrentSalt || priorSalt != corpus.PriorSalt {
		t.Fatalf("daily salt drift: got (%q, %q), want (%q, %q)", curSalt, priorSalt, corpus.CurrentSalt, corpus.PriorSalt)
	}
	if IsWithinUtcMidnightGraceWindow(now, 30) != corpus.WithinGrace {
		t.Fatalf("grace window drift: want %v", corpus.WithinGrace)
	}

	for _, id := range corpus.Identities {
		if got := HashVisitorIP(id.IP, curSalt); got != id.CurrentIPHash {
			t.Errorf("ip_hash mismatch for %q: got %q want %q", id.IP, got, id.CurrentIPHash)
		}
		if got := HashVisitorIP(id.IP, priorSalt); got != id.PriorIPHash {
			t.Errorf("prior ip_hash mismatch for %q: got %q want %q", id.IP, got, id.PriorIPHash)
		}
		gotVis := HashVisitorIdentity(id.IP, id.UA, curSalt)
		if gotVis != id.CurrentVisitorHash {
			t.Errorf("visitor_hash mismatch for %q: got %q want %q", id.IP, gotVis, id.CurrentVisitorHash)
		}
		if got := HashVisitorIdentity(id.IP, id.UA, priorSalt); got != id.PriorVisitorHash {
			t.Errorf("prior visitor_hash mismatch for %q: got %q want %q", id.IP, got, id.PriorVisitorHash)
		}
		if lockKey := "analytics_session:portal:" + gotVis; lockKey != id.AdvisoryLockKey {
			t.Errorf("advisory lock key mismatch: got %q want %q", lockKey, id.AdvisoryLockKey)
		}
	}

	for _, uaCase := range corpus.UserAgents {
		gotBot := ClassifyBotUserAgent(uaCase.UA)
		if gotBot.IsBot != uaCase.Bot.IsBot || gotBot.Branch != uaCase.Bot.Branch {
			t.Errorf("bot mismatch for %q: got %+v want %+v", uaCase.UA, gotBot, uaCase.Bot)
		}
		gotProf := ParseUserAgentProfile(uaCase.UA)
		if gotProf.DeviceType != uaCase.Profile.DeviceType ||
			!ptrEqual(gotProf.OSName, uaCase.Profile.OSName) ||
			!ptrEqual(gotProf.BrowserName, uaCase.Profile.BrowserName) {
			t.Errorf("profile mismatch for %q: got %+v want %+v", uaCase.UA, gotProf, uaCase.Profile)
		}
	}

	for _, refCase := range corpus.Referrers {
		got := NormalizeReferrer(refCase.Raw, refCase.OwnHosts)
		if !ptrEqual(got.Referrer, refCase.Expected.Referrer) ||
			!ptrEqual(got.ReferrerHost, refCase.Expected.ReferrerHost) ||
			got.ReferrerCategory != refCase.Expected.ReferrerCategory {
			t.Errorf("referrer mismatch for %q: got %+v want %+v", refCase.Raw, got, refCase.Expected)
		}
	}

	for _, c := range corpus.Campaigns {
		got := ExtractCampaignParams(c.RawURL)
		if got.LandingPath != c.Expected.LandingPath ||
			!ptrEqual(got.RefParam, c.Expected.RefParam) ||
			!ptrEqual(got.UTMSource, c.Expected.UTMSource) ||
			!ptrEqual(got.UTMMedium, c.Expected.UTMMedium) ||
			!ptrEqual(got.UTMCampaign, c.Expected.UTMCampaign) ||
			!ptrEqual(got.UTMContent, c.Expected.UTMContent) {
			t.Errorf("campaign mismatch for %q: got %+v want %+v", c.RawURL, got, c.Expected)
		}
		if gotPath := NormalizeLandingPath(c.RawURL); gotPath != c.NormalizedPath {
			t.Errorf("landing path mismatch for %q: got %q want %q", c.RawURL, gotPath, c.NormalizedPath)
		}
	}
}
