package analytics

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

const (
	DevFallbackDailySalt   = "dev-only"
	MaxCampaignValueLen    = 120
	MaxPathLen             = 512
	MaxReferrerLen         = 512
	MaxHeaderGeoLen        = 64
	MaxDNSHostnameLen      = 253
	DefaultGraceWindowMins = 30

	BotBranchHuman           = "human"
	BotBranchIsbot           = "bot_isbot"
	BotBranchHeadlessMissing = "bot_headless_or_missing_ua"
)

var (
	ErrMissingProductionSalt = errors.New("ANALYTICS_DAILY_SALT is required in production")

	headlessOrScraperRE = regexp.MustCompile(`(?i)headlesschrome|playwright|puppeteer|phantomjs|curl/|wget/|python-requests|go-http-client|scrapy|httpx/|libwww-perl|axios/|node-fetch|undici`)
	osIOSRE             = regexp.MustCompile(`(?i)iphone|ipad|ipod|cpu os|cpu iphone os`)
	osAndroidRE         = regexp.MustCompile(`(?i)android`)
	osChromeOSRE        = regexp.MustCompile(`(?i)cros`)
	osWindowsRE         = regexp.MustCompile(`(?i)windows nt|win64|wow64`)
	osMacOSRE           = regexp.MustCompile(`(?i)mac os x|macintosh`)
	osLinuxRE           = regexp.MustCompile(`(?i)linux|x11`)

	browserEdgeRE    = regexp.MustCompile(`(?i)edg/|edga/|edgios/`)
	browserOperaRE   = regexp.MustCompile(`(?i)opr/|opera`)
	browserSamsungRE = regexp.MustCompile(`(?i)samsungbrowser`)
	browserFirefoxRE = regexp.MustCompile(`(?i)firefox/|fxios/`)
	browserChromeRE  = regexp.MustCompile(`(?i)chrome/|crios/`)
	browserSafariRE  = regexp.MustCompile(`(?i)safari/`)

	deviceTabletRE  = regexp.MustCompile(`(?i)ipad|tablet|playbook|silk`)
	deviceMobileRE  = regexp.MustCompile(`(?i)mobile|iphone|ipod|android.*mobile|windows phone|blackberry`)
	deviceDesktopRE = regexp.MustCompile(`(?i)windows|macintosh|mac os x|linux|cros|x11|mozilla/`)
	trailingPortRE  = regexp.MustCompile(`:\d+$`)
)

var searchHosts = map[string]struct{}{
	"bing.com": {}, "duckduckgo.com": {}, "search.yahoo.com": {}, "yahoo.com": {},
	"ecosia.org": {}, "kagi.com": {}, "search.brave.com": {}, "baidu.com": {},
	"perplexity.ai": {}, "chatgpt.com": {},
}

var socialHosts = map[string]struct{}{
	"linkedin.com": {}, "lnkd.in": {}, "x.com": {}, "twitter.com": {}, "t.co": {},
	"bsky.app": {}, "mastodon.social": {}, "threads.net": {}, "reddit.com": {},
	"old.reddit.com": {}, "facebook.com": {}, "m.facebook.com": {}, "instagram.com": {},
	"youtube.com": {}, "youtu.be": {}, "tiktok.com": {},
}

var developerHosts = map[string]struct{}{
	"github.com": {}, "gist.github.com": {}, "gitlab.com": {}, "news.ycombinator.com": {},
	"lobste.rs": {}, "dev.to": {}, "stackoverflow.com": {}, "npmjs.com": {},
	"agensi.dev": {}, "agensi.ai": {}, "hashnode.com": {}, "medium.com": {},
}

type BotClassificationResult struct {
	IsBot  bool
	Branch string
}

type UserAgentProfile struct {
	DeviceType  string
	OSName      *string
	BrowserName *string
}

type NormalizedReferrer struct {
	Referrer         *string
	ReferrerHost     *string
	ReferrerCategory string
}

type CampaignParams struct {
	LandingPath string
	RefParam    *string
	UTMSource   *string
	UTMMedium   *string
	UTMCampaign *string
	UTMContent  *string
}

// ResolveDailySaltSecret returns explicit salt or ANALYTICS_DAILY_SALT, failing closed
// in production when absent and returning DevFallbackDailySalt outside production.
func ResolveDailySaltSecret(explicit string) (string, error) {
	if s := strings.TrimSpace(explicit); s != "" {
		return s, nil
	}
	if s := strings.TrimSpace(os.Getenv("ANALYTICS_DAILY_SALT")); s != "" {
		return s, nil
	}
	if internalauth.IsProductionEnv() {
		return "", ErrMissingProductionSalt
	}
	return DevFallbackDailySalt, nil
}

func BuildDailySalt(baseSalt string, now time.Time) string {
	salt := strings.TrimSpace(baseSalt)
	if salt == "" {
		salt = DevFallbackDailySalt
	}
	return salt + ":" + now.UTC().Format("2006-01-02")
}

func BuildPreviousUtcDaySalt(baseSalt string, now time.Time) string {
	return BuildDailySalt(baseSalt, now.UTC().Add(-24*time.Hour))
}

func IsWithinUtcMidnightGraceWindow(now time.Time, graceMinutes int) bool {
	if graceMinutes <= 0 {
		graceMinutes = DefaultGraceWindowMins
	}
	utc := now.UTC()
	return utc.Hour() == 0 && utc.Minute() < graceMinutes
}

func HashVisitorIP(ip, dailySalt string) string {
	sum := sha256.Sum256([]byte(dailySalt + ":" + ip))
	return hex.EncodeToString(sum[:])[:24]
}

func HashVisitorIdentity(ip, userAgent, dailySalt string) string {
	sum := sha256.Sum256([]byte(dailySalt + ":" + ip + ":" + strings.TrimSpace(userAgent)))
	return hex.EncodeToString(sum[:])[:32]
}

func ClassifyBotUserAgent(ua string) BotClassificationResult {
	trimmed := strings.TrimSpace(ua)
	if trimmed == "" || headlessOrScraperRE.MatchString(trimmed) {
		return BotClassificationResult{IsBot: true, Branch: BotBranchHeadlessMissing}
	}
	if isIsbotMatch(trimmed) {
		return BotClassificationResult{IsBot: true, Branch: BotBranchIsbot}
	}
	return BotClassificationResult{IsBot: false, Branch: BotBranchHuman}
}

func detectOSName(ua string) *string {
	var name string
	switch {
	case osIOSRE.MatchString(ua):
		name = "iOS"
	case osAndroidRE.MatchString(ua):
		name = "Android"
	case osChromeOSRE.MatchString(ua):
		name = "ChromeOS"
	case osWindowsRE.MatchString(ua):
		name = "Windows"
	case osMacOSRE.MatchString(ua):
		name = "macOS"
	case osLinuxRE.MatchString(ua):
		name = "Linux"
	default:
		return nil
	}
	return &name
}

func detectBrowserName(ua string) *string {
	var name string
	switch {
	case browserEdgeRE.MatchString(ua):
		name = "Edge"
	case browserOperaRE.MatchString(ua):
		name = "Opera"
	case browserSamsungRE.MatchString(ua):
		name = "Samsung Internet"
	case browserFirefoxRE.MatchString(ua):
		name = "Firefox"
	case browserChromeRE.MatchString(ua):
		name = "Chrome"
	case browserSafariRE.MatchString(ua):
		name = "Safari"
	default:
		return nil
	}
	return &name
}

func ParseUserAgentProfile(ua string) UserAgentProfile {
	trimmed := strings.TrimSpace(ua)
	if trimmed == "" || ClassifyBotUserAgent(trimmed).IsBot {
		return UserAgentProfile{DeviceType: "bot"}
	}
	deviceType := "unknown"
	if deviceTabletRE.MatchString(trimmed) || (osAndroidRE.MatchString(trimmed) && !strings.Contains(strings.ToLower(trimmed), "mobile")) {
		deviceType = "tablet"
	} else if deviceMobileRE.MatchString(trimmed) {
		deviceType = "mobile"
	} else if deviceDesktopRE.MatchString(trimmed) {
		deviceType = "desktop"
	}
	return UserAgentProfile{
		DeviceType:  deviceType,
		OSName:      detectOSName(trimmed),
		BrowserName: detectBrowserName(trimmed),
	}
}

func truncateRunes(s string, maxRunes int) string {
	if maxRunes <= 0 || utf8.RuneCountInString(s) <= maxRunes {
		return s
	}
	return string([]rune(s)[:maxRunes])
}

func SanitizeControlChars(raw string, maxLen int) *string {
	if raw == "" {
		return nil
	}
	var b strings.Builder
	b.Grow(len(raw))
	for _, r := range raw {
		if r <= 0x1f || r == 0x7f {
			continue
		}
		b.WriteRune(r)
	}
	cleaned := strings.TrimSpace(b.String())
	if cleaned == "" {
		return nil
	}
	cleaned = truncateRunes(cleaned, maxLen)
	return &cleaned
}

func SanitizeCampaignValue(raw string) *string {
	return SanitizeControlChars(raw, MaxCampaignValueLen)
}

func SanitizeHeaderGeo(raw string) *string {
	return SanitizeControlChars(raw, MaxHeaderGeoLen)
}

func normalizeHostToken(input string) string {
	trimmed := strings.ToLower(strings.TrimSpace(input))
	if trimmed == "" {
		return ""
	}
	if strings.Contains(trimmed, "://") {
		parsed, err := url.Parse(trimmed)
		if err != nil {
			return ""
		}
		return strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	}
	withoutPort := trailingPortRE.ReplaceAllString(trimmed, "")
	return strings.TrimPrefix(withoutPort, "www.")
}

func classifyReferrerCategory(host string) string {
	if _, ok := searchHosts[host]; ok ||
		host == "google.com" ||
		strings.HasPrefix(host, "google.") ||
		strings.HasSuffix(host, ".google.com") ||
		strings.HasPrefix(host, "yandex.") {
		return "search"
	}
	if _, ok := socialHosts[host]; ok ||
		strings.HasSuffix(host, ".linkedin.com") ||
		strings.HasSuffix(host, ".reddit.com") {
		return "social"
	}
	if _, ok := developerHosts[host]; ok || strings.HasSuffix(host, ".github.io") {
		return "developer"
	}
	return "referral"
}

func NormalizeReferrer(rawReferrer string, ownHosts []string) NormalizedReferrer {
	trimmed := strings.TrimSpace(rawReferrer)
	if trimmed == "" {
		return NormalizedReferrer{ReferrerCategory: "direct"}
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return NormalizedReferrer{ReferrerCategory: "direct"}
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if host == "" || len(host) > MaxDNSHostnameLen {
		return NormalizedReferrer{ReferrerCategory: "direct"}
	}
	ownSet := map[string]struct{}{"andrew-k.us": {}}
	for _, rawOwn := range ownHosts {
		if norm := normalizeHostToken(rawOwn); norm != "" {
			ownSet[norm] = struct{}{}
		}
	}
	if _, isOwn := ownSet[host]; isOwn {
		return NormalizedReferrer{ReferrerCategory: "direct"}
	}
	pathname := parsed.EscapedPath()
	if pathname == "" {
		pathname = "/"
	}
	cleanRef := truncateRunes(parsed.Scheme+"://"+strings.ToLower(parsed.Host)+pathname, MaxReferrerLen)
	return NormalizedReferrer{
		Referrer:         &cleanRef,
		ReferrerHost:     &host,
		ReferrerCategory: classifyReferrerCategory(host),
	}
}

func safeResolvedPath(resolved *url.URL) string {
	pathname := resolved.Path
	if !utf8.ValidString(pathname) || strings.IndexByte(pathname, 0) >= 0 {
		pathname = resolved.EscapedPath()
	}
	return pathname
}

func NormalizeLandingPath(rawPath string) string {
	cleaned := strings.TrimSpace(strings.ReplaceAll(rawPath, "\x00", ""))
	if cleaned == "" {
		return "/"
	}
	base, _ := url.Parse("https://andrew-k.us")
	var pathname string
	if parsed, err := url.Parse(cleaned); err == nil {
		resolved := base.ResolveReference(parsed)
		pathname = safeResolvedPath(resolved)
	}
	if pathname == "" {
		stripped := cleaned
		if idx := strings.IndexAny(stripped, "?#"); idx >= 0 {
			stripped = stripped[:idx]
		}
		stripped = strings.TrimSpace(stripped)
		if stripped == "" {
			pathname = "/"
		} else if strings.HasPrefix(stripped, "/") {
			pathname = stripped
		} else {
			pathname = "/" + stripped
		}
	}
	withoutTrailing := strings.TrimRight(pathname, "/")
	withoutTrailing = strings.ReplaceAll(strings.ToValidUTF8(withoutTrailing, ""), "\x00", "")
	if withoutTrailing == "" {
		withoutTrailing = "/"
	}
	return truncateRunes(withoutTrailing, MaxPathLen)
}

func ExtractCampaignParams(rawURL string) CampaignParams {
	base, _ := url.Parse("https://andrew-k.us")
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return CampaignParams{LandingPath: NormalizeLandingPath(rawURL)}
	}
	resolved := base.ResolveReference(parsed)
	q := resolved.Query()
	return CampaignParams{
		LandingPath: NormalizeLandingPath(safeResolvedPath(resolved)),
		RefParam:    SanitizeCampaignValue(q.Get("ref")),
		UTMSource:   SanitizeCampaignValue(q.Get("utm_source")),
		UTMMedium:   SanitizeCampaignValue(q.Get("utm_medium")),
		UTMCampaign: SanitizeCampaignValue(q.Get("utm_campaign")),
		UTMContent:  SanitizeCampaignValue(q.Get("utm_content")),
	}
}
