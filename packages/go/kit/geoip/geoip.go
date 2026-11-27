package geoip

import (
	"encoding/json"
	"errors"
	"log"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/oschwald/maxminddb-golang"
)

const (
	CityDBFilename = "GeoLite2-City.mmdb"
	ASNDBFilename  = "GeoLite2-ASN.mmdb"

	BranchHit              = "mmdb_hit"
	BranchPrivateOrUnmap   = "mmdb_private_or_unmapped"
	BranchAbsentFallback   = "mmdb_absent_fallback"
	BranchCorruptDegraded  = "mmdb_corrupt_degraded"
)

// Enrichment holds resolved MaxMind GeoLite2 City + ASN metadata and the branch taken.
type Enrichment struct {
	Country  *string
	Region   *string
	City     *string
	Timezone *string
	ASN      *int32
	ASNOrg   *string
	Branch   string
}

type slotState int

const (
	slotUnopened slotState = iota
	slotReady
	slotAbsent
	slotCorrupt
)

type mmdbCityRecord struct {
	Country struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"country"`
	RegisteredCountry struct {
		ISOCode string `maxminddb:"iso_code"`
	} `maxminddb:"registered_country"`
	Subdivisions []struct {
		ISOCode string            `maxminddb:"iso_code"`
		Names   map[string]string `maxminddb:"names"`
	} `maxminddb:"subdivisions"`
	City struct {
		Names map[string]string `maxminddb:"names"`
	} `maxminddb:"city"`
	Location struct {
		TimeZone string `maxminddb:"time_zone"`
	} `maxminddb:"location"`
}

type mmdbASNRecord struct {
	AutonomousSystemNumber       uint   `maxminddb:"autonomous_system_number"`
	AutonomousSystemOrganization string `maxminddb:"autonomous_system_organization"`
}

// Reader lazily memory-maps GeoLite2 City & ASN databases on first public IP lookup
// and releases mmap descriptors cleanly when Close is called on shutdown.
type Reader struct {
	dbDir     string
	logger    *slog.Logger
	mu        sync.Mutex
	opened    bool
	closed    bool
	cityDB    *maxminddb.Reader
	asnDB     *maxminddb.Reader
	cityState slotState
	asnState  slotState
}

// NewReader creates a lazy GeoLite2 reader bound to dbDir (or GEOLITE2_DB_DIR / "data/geolite2").
func NewReader(dbDir string, logger *slog.Logger) *Reader {
	resolved := strings.TrimSpace(dbDir)
	if resolved == "" {
		resolved = strings.TrimSpace(os.Getenv("GEOLITE2_DB_DIR"))
	}
	if resolved == "" {
		resolved = filepath.Join("data", "geolite2")
	}
	return &Reader{
		dbDir:  resolved,
		logger: logger,
	}
}

func isPrivateIPv4(a4 [4]byte) bool {
	a, b := a4[0], a4[1]
	if a == 0 || a == 10 || a == 127 {
		return true
	}
	if a == 100 && b >= 64 && b <= 127 {
		return true
	}
	if a == 169 && b == 254 {
		return true
	}
	if a == 172 && b >= 16 && b <= 31 {
		return true
	}
	if a == 192 && b == 168 {
		return true
	}
	return a >= 224
}

// IsPrivateOrNonRoutableIP returns true for invalid, loopback, RFC1918, CGNAT, link-local,
// ULA, multicast, or unspecified IPv4/IPv6 addresses matching Node's geoip.ts semantics.
func IsPrivateOrNonRoutableIP(ip string) bool {
	trimmed := strings.TrimSpace(ip)
	addr, err := netip.ParseAddr(trimmed)
	if err != nil || !addr.IsValid() {
		return true
	}
	if addr.Is4In6() {
		addr = addr.Unmap()
	}
	if addr.Is4() {
		return isPrivateIPv4(addr.As4())
	}
	if addr.IsUnspecified() || addr.IsLoopback() || addr.IsMulticast() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() {
		return true
	}
	b := addr.As16()
	// Unique Local Address fc00::/7 (fc.. / fd..)
	return (b[0] & 0xfe) == 0xfc
}

func (r *Reader) emitSeam(level string, payload map[string]any) {
	if r != nil && r.logger != nil {
		args := make([]any, 0, len(payload)*2)
		for k, v := range payload {
			args = append(args, k, v)
		}
		if level == "warn" {
			r.logger.Warn("geoip seam", args...)
		} else {
			r.logger.Info("geoip seam", args...)
		}
		return
	}
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func (r *Reader) emitLookupBranch(branch string) {
	r.emitSeam("info", map[string]any{
		"seam_type": "RULE_DIVERGENCE",
		"event":     "analytics.geoip.lookup_branch",
		"branch":    branch,
	})
}

func (r *Reader) openSlotLocked(filename, database string) (*maxminddb.Reader, slotState) {
	fullPath := filepath.Join(r.dbDir, filename)
	if _, err := os.Stat(fullPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, slotAbsent
		}
		r.emitSeam("warn", map[string]any{
			"seam_type": "BOUNDARY_FAULT",
			"event":     "analytics.geoip.mmdb_load_failed",
			"database":  database,
			"detail":    "mmdb_stat_failed",
		})
		return nil, slotCorrupt
	}
	db, err := maxminddb.Open(fullPath)
	if err != nil {
		r.emitSeam("warn", map[string]any{
			"seam_type": "BOUNDARY_FAULT",
			"event":     "analytics.geoip.mmdb_load_failed",
			"database":  database,
			"detail":    err.Error(),
		})
		return nil, slotCorrupt
	}
	return db, slotReady
}

func (r *Reader) ensureOpenedLocked() {
	if r.opened || r.closed {
		return
	}
	r.opened = true
	r.cityDB, r.cityState = r.openSlotLocked(CityDBFilename, "city")
	r.asnDB, r.asnState = r.openSlotLocked(ASNDBFilename, "asn")
}

func strPtrIfNonEmpty(raw string) *string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// Lookup enriches a public IP using lazily opened mmap GeoLite2 City & ASN databases.
// Never logs the raw IP address.
func (r *Reader) Lookup(ip string) Enrichment {
	if IsPrivateOrNonRoutableIP(ip) {
		r.emitLookupBranch(BranchPrivateOrUnmap)
		return Enrichment{Branch: BranchPrivateOrUnmap}
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		r.emitLookupBranch(BranchAbsentFallback)
		return Enrichment{Branch: BranchAbsentFallback}
	}
	r.ensureOpenedLocked()

	corrupt := r.cityState == slotCorrupt || r.asnState == slotCorrupt
	if corrupt {
		r.emitLookupBranch(BranchCorruptDegraded)
	} else if r.cityState == slotAbsent && r.asnState == slotAbsent {
		r.emitLookupBranch(BranchAbsentFallback)
		return Enrichment{Branch: BranchAbsentFallback}
	}

	parsedIP := net.ParseIP(strings.TrimSpace(ip))
	if parsedIP == nil {
		r.emitLookupBranch(BranchPrivateOrUnmap)
		return Enrichment{Branch: BranchPrivateOrUnmap}
	}

	out := Enrichment{}
	if r.cityState == slotReady && r.cityDB != nil {
		var rec mmdbCityRecord
		if err := r.cityDB.Lookup(parsedIP, &rec); err != nil {
			r.emitSeam("warn", map[string]any{
				"seam_type": "BOUNDARY_FAULT",
				"event":     "analytics.geoip.mmdb_load_failed",
				"database":  "lookup",
				"detail":    err.Error(),
			})
			return Enrichment{Branch: BranchCorruptDegraded}
		}
		if c := strPtrIfNonEmpty(rec.Country.ISOCode); c != nil {
			out.Country = c
		} else {
			out.Country = strPtrIfNonEmpty(rec.RegisteredCountry.ISOCode)
		}
		if len(rec.Subdivisions) > 0 {
			if iso := strPtrIfNonEmpty(rec.Subdivisions[0].ISOCode); iso != nil {
				out.Region = iso
			} else if en := strPtrIfNonEmpty(rec.Subdivisions[0].Names["en"]); en != nil {
				out.Region = en
			}
		}
		out.City = strPtrIfNonEmpty(rec.City.Names["en"])
		out.Timezone = strPtrIfNonEmpty(rec.Location.TimeZone)
	}

	if r.asnState == slotReady && r.asnDB != nil {
		var rec mmdbASNRecord
		if err := r.asnDB.Lookup(parsedIP, &rec); err != nil {
			r.emitSeam("warn", map[string]any{
				"seam_type": "BOUNDARY_FAULT",
				"event":     "analytics.geoip.mmdb_load_failed",
				"database":  "lookup",
				"detail":    err.Error(),
			})
			return Enrichment{Branch: BranchCorruptDegraded}
		}
		if rec.AutonomousSystemNumber > 0 {
			asnVal := int32(rec.AutonomousSystemNumber)
			out.ASN = &asnVal
		}
		out.ASNOrg = strPtrIfNonEmpty(rec.AutonomousSystemOrganization)
	}

	hasMatch := out.Country != nil || out.Region != nil || out.City != nil ||
		out.Timezone != nil || out.ASN != nil || out.ASNOrg != nil
	if corrupt {
		out.Branch = BranchCorruptDegraded
		return out
	}
	if hasMatch {
		out.Branch = BranchHit
	} else {
		out.Branch = BranchPrivateOrUnmap
	}
	r.emitLookupBranch(out.Branch)
	return out
}

// Close releases mmap handles cleanly (idempotent, safe to invoke on SIGTERM).
func (r *Reader) Close() error {
	if r == nil {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return nil
	}
	r.closed = true
	var firstErr error
	if r.cityDB != nil {
		if err := r.cityDB.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
		r.cityDB = nil
	}
	if r.asnDB != nil {
		if err := r.asnDB.Close(); err != nil && firstErr == nil {
			firstErr = err
		}
		r.asnDB = nil
	}
	return firstErr
}
