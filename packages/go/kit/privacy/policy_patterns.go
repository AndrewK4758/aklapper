package privacy

import (
	"regexp"
	"strings"
)

// Finding is a structured, zero-literal privacy policy finding returned on fail-closed rejections.
type Finding struct {
	RuleID   string `json:"ruleId"`
	Category string `json:"category"`
	Field    string `json:"field"`
	Location string `json:"location"`
}

// PatternRule defines a single static RE2 privacy pattern rule with optional fast O(N) pre-check.
type PatternRule struct {
	RuleID     string
	Category   string
	Regex      *regexp.Regexp
	QuickCheck func(string) bool
}

// PortalHomeAllowedPublicEmails lists the exact public email addresses permitted on portal-home.
var PortalHomeAllowedPublicEmails = map[string]struct{}{
	"andrew@andrew-k.us": {},
}

// CaseInsensitiveTrackerPrefixes lists internal governance issue-key prefixes blocked in any case.
var CaseInsensitiveTrackerPrefixes = map[string]struct{}{
	"akl":  {},
	"dec":  {},
	"ii":   {},
	"prod": {},
	"oq":   {},
}

// AllowedTechPrefixes lists all 75 benign uppercase technical prefixes exempted from tracker-key blocking.
var AllowedTechPrefixes = map[string]struct{}{
	"AES": {}, "AMD": {}, "ANSI": {}, "AP": {}, "ARGON": {}, "ARM": {}, "ASCII": {}, "AV": {},
	"AWS": {}, "B2B": {}, "B2C": {}, "BASE": {}, "CENTRAL": {}, "CI": {}, "CVE": {}, "CWE": {},
	"DDR": {}, "EAST": {}, "ECMA": {}, "ES": {}, "EU": {}, "FIPS": {}, "GCP": {}, "GO": {},
	"GPT": {}, "GRPC": {}, "HMAC": {}, "HTML": {}, "HTTP": {}, "HTTPS": {}, "IEEE": {}, "IPV": {},
	"ISO": {}, "JS": {}, "JSON": {}, "JWT": {}, "K8S": {}, "MD": {}, "MP": {}, "NIST": {},
	"NODE": {}, "NORTH": {}, "NVME": {}, "OAUTH": {}, "OIDC": {}, "OS": {}, "OWASP": {}, "PBKDF": {},
	"PCI": {}, "PG": {}, "PKCS": {}, "POSIX": {}, "PYTHON": {}, "RFC": {}, "RSA": {}, "SAML": {},
	"SHA": {}, "SOC": {}, "SOUTH": {}, "SQL": {}, "SSL": {}, "TCP": {}, "TIER": {}, "TLS": {},
	"TS": {}, "UDP": {}, "US": {}, "USB": {}, "UTF": {}, "UUID": {}, "VP": {}, "WCAG": {},
	"WEST": {}, "X86": {}, "XML": {},
}

var (
	// CoreRegexRules holds the 14 RE2-compiled static rules (paired with linear email and phone scanners = 16 core rules).
	CoreRegexRules = []PatternRule{
		{
			RuleID:     "secret.pem_private_key",
			Category:   "secret",
			Regex:      regexp.MustCompile(`-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "PRIVATE KEY-----") },
		},
		{
			RuleID:     "secret.aws_access_key",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA)[A-Z0-9]{16}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "A") && hasASCIIDigitOrUpper(s) },
		},
		{
			RuleID:     "secret.gcp_api_key",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\bAIza[0-9A-Za-z_-]{35}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "AIza") },
		},
		{
			RuleID:     "secret.github_token",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "_") && (strings.Contains(s, "gh") || strings.Contains(s, "github_pat_")) },
		},
		{
			RuleID:     "secret.openai_key",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "sk-") },
		},
		{
			RuleID:     "secret.stripe_key",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "_live_") || strings.Contains(s, "_test_") },
		},
		{
			RuleID:     "secret.slack_token",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "xox") },
		},
		{
			RuleID:     "secret.jwt_token",
			Category:   "secret",
			Regex:      regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "eyJ") },
		},
		{
			RuleID:     "secret.connection_uri_credentials",
			Category:   "secret",
			Regex:      regexp.MustCompile(`(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp)://[^\s:@]+:[^\s@]+@`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "://") && strings.Contains(s, "@") },
		},
		{
			RuleID:     "pii.us_ssn",
			Category:   "pii",
			Regex:      regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, "-") && hasASCIIDigit(s) },
		},
		{
			RuleID:     "pii.us_postal_zip",
			Category:   "pii",
			Regex:      regexp.MustCompile(`\b(?:A[LKSZR]|C[AOT]|D[EC]|F[LM]|G[AU]|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[ARW]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY])(?:,[ \t]{0,4}|[ \t]{1,4})\d{5}(?:-\d{4})?\b|\b\d{5}-\d{4}\b|\b[Zz][Ii][Pp](?:[ \t]{1,4}[Cc][Oo][Dd][Ee])?[:#\s]{1,8}\d{5}(?:-\d{4})?\b`),
			QuickCheck: hasASCIIDigit,
		},
		{
			RuleID:     "workspace.private_governance_repo",
			Category:   "workspace",
			Regex:      regexp.MustCompile(`(?i)\baklapper[-_/]cadence\b`),
			QuickCheck: func(s string) bool { return containsASCIIFold(s, "cadence") },
		},
		{
			RuleID:     "workspace.private_governance_file",
			Category:   "workspace",
			Regex:      regexp.MustCompile(`(?i)\b(?:CADENCE_ORG\.md|CADENCE_DIRECTIVES\.md|triage-context\.md|design-options\.md|evidence\.yaml|certainty[-_]gate)\b`),
			QuickCheck: func(s string) bool { return strings.Contains(s, ".") || strings.Contains(s, "-") || strings.Contains(s, "_") },
		},
		{
			RuleID:     "workspace.local_project_path",
			Category:   "workspace",
			Regex:      regexp.MustCompile(`(?i)(?:~|/home/[A-Za-z0-9._-]+|/Users/[A-Za-z0-9._-]+)/projects/[A-Za-z0-9._/-]+`),
			QuickCheck: func(s string) bool { return containsASCIIFold(s, "/projects/") },
		},
	}

	// PortalHomeExtraRules holds the 3 additional privacy rules enforced on site_content portal-home.
	PortalHomeExtraRules = []PatternRule{
		{
			RuleID:     "pii.us_postal_address_zip",
			Category:   "pii",
			Regex:      regexp.MustCompile(`\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC),?\s+\d{5}(?:-\d{4})?\b`),
			QuickCheck: hasASCIIDigit,
		},
		{
			RuleID:     "pii.us_postal_address_zip",
			Category:   "pii",
			Regex:      regexp.MustCompile(`(?i)\b(?:zip|postal)(?:[ \t]{1,8}code)?[ \t]{0,16}(?:[:#-][ \t]{0,8})?\d{5}(?:-\d{4})?\b`),
			QuickCheck: hasASCIIDigit,
		},
		{
			RuleID:     "pii.references_section",
			Category:   "pii",
			Regex:      regexp.MustCompile(`(?im)^[ \t]*(?:(?:#{1,6}|[-*+])[ \t]+)?(?:\*{1,2}|_{1,2})?(?:(?:professional|personal|work|character)[ \t]+)?references(?:\*{1,2}|_{1,2})?[ \t]*(?:[:—–-].*)?$`),
			QuickCheck: func(s string) bool { return containsASCIIFold(s, "references") },
		},
	}

	// TrackerIssueKeyRe matches candidate issue-tracker keys such as PROJ-1234.
	TrackerIssueKeyRe = regexp.MustCompile(`\b([A-Za-z]{2,8})-(\d{1,8})\b`)

	// usPhoneCandidateRe matches standard North American phone forms (including +1(555) 010-1234,
	// 1(555) 010-1234, and compact E.164 +15550101234) in linear RE2 time; left/right boundaries
	// are verified in FindUSPhoneSpans without regex lookarounds.
	usPhoneCandidateRe = regexp.MustCompile(`(?:(?:\+?1[-.\s]?)?\(\d{3}\)[-.\s]?|(?:\+?1[-.\s])?\d{3}[-.\s])\d{3}[-.\s]\d{4}|\+1\d{10}`)
)

// IsBlockedTrackerPrefix reports whether a tracker issue-key prefix is blocked.
func IsBlockedTrackerPrefix(rawPrefix string) bool {
	if rawPrefix == "" {
		return false
	}
	if _, blocked := CaseInsensitiveTrackerPrefixes[strings.ToLower(rawPrefix)]; blocked {
		return true
	}
	if rawPrefix != strings.ToUpper(rawPrefix) {
		return false
	}
	_, allowed := AllowedTechPrefixes[rawPrefix]
	return !allowed
}

func isASCIIAlpha(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func isASCIIDigit(b byte) bool {
	return b >= '0' && b <= '9'
}

func isASCIIAlnum(b byte) bool {
	return isASCIIAlpha(b) || isASCIIDigit(b)
}

func isASCIIWordByte(b byte) bool {
	return isASCIIAlnum(b) || b == '_'
}

func isEmailLocalByte(b byte) bool {
	return isASCIIAlnum(b) || b == '.' || b == '_' || b == '%' || b == '+' || b == '-'
}

func isDomainLabelByte(b byte) bool {
	return isASCIIAlnum(b) || b == '-'
}

// FindUSPhoneSpans locates all US/NANP phone numbers (including +1(555) 010-1234, 1(555) 010-1234,
// and compact E.164 +15550101234) in strictly linear O(N) time with boundary checks.
func FindUSPhoneSpans(text string) [][2]int {
	if !hasASCIIDigit(text) {
		return nil
	}
	locs := usPhoneCandidateRe.FindAllStringIndex(text, -1)
	if len(locs) == 0 {
		return nil
	}
	out := make([][2]int, 0, len(locs))
	for _, loc := range locs {
		start, end := loc[0], loc[1]
		if start > 0 && isASCIIAlnum(text[start-1]) {
			continue
		}
		if end < len(text) && isASCIIDigit(text[end]) {
			continue
		}
		out = append(out, [2]int{start, end})
	}
	return out
}

// FindEmailSpans locates all email addresses with uncapped local-part lengths (including 65+-char
// local parts) in strictly linear O(N) time without regex backtracking or lookbehinds.
func FindEmailSpans(text string) [][2]int {
	if !strings.ContainsRune(text, '@') {
		return nil
	}
	var out [][2]int
	n := len(text)
	for i := 0; i < n; i++ {
		if text[i] != '@' {
			continue
		}
		start := i
		for start > 0 && isEmailLocalByte(text[start-1]) {
			start--
		}
		if start == i {
			continue
		}
		end := scanEmailDomain(text, i+1)
		if end <= i+1 {
			continue
		}
		out = append(out, [2]int{start, end})
		i = end - 1
	}
	return out
}

// scanEmailDomain scans (?:[A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,24}\b starting at pos, returning the
// end byte offset of the longest valid domain or 0 when no valid domain starts at pos.
func scanEmailDomain(text string, pos int) int {
	n := len(text)
	cursor := pos
	labelCount := 0
	bestEnd := 0

	for cursor < n {
		labelStart := cursor
		allAlpha := true
		for cursor < n && isDomainLabelByte(text[cursor]) {
			if !isASCIIAlpha(text[cursor]) {
				allAlpha = false
			}
			cursor++
		}
		labelLen := cursor - labelStart
		if labelLen == 0 || labelLen > 63 {
			break
		}
		labelCount++

		if labelCount >= 2 && allAlpha && labelLen >= 2 && labelLen <= 24 {
			if cursor == n || !isASCIIWordByte(text[cursor]) {
				bestEnd = cursor
			}
		}

		if cursor < n && text[cursor] == '.' {
			cursor++
			continue
		}
		break
	}
	return bestEnd
}

func hasBoundedMatch(re *regexp.Regexp, folded string) bool {
	if re == nil {
		return false
	}
	for _, loc := range re.FindAllStringIndex(folded, -1) {
		start, end := loc[0], loc[1]
		if start > 0 && isASCIIAlnum(folded[start-1]) {
			continue
		}
		if end < len(folded) && isASCIIAlnum(folded[end]) {
			continue
		}
		return true
	}
	return false
}
