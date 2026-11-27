package geoip

import (
	"bytes"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func encodeMMDBSize(typeNum byte, size int) []byte {
	if size < 29 {
		return []byte{(typeNum << 5) | byte(size)}
	}
	return []byte{(typeNum << 5) | 29, byte(size - 29)}
}

func encodeMMDBUTF8(val string) []byte {
	raw := []byte(val)
	return append(encodeMMDBSize(2, len(raw)), raw...)
}

func encodeMMDBUint(typeNum byte, val uint64) []byte {
	var raw []byte
	for v := val; v > 0; v >>= 8 {
		raw = append([]byte{byte(v & 0xff)}, raw...)
	}
	if typeNum >= 8 {
		return append([]byte{byte(len(raw)), typeNum - 7}, raw...)
	}
	return append([]byte{(typeNum << 5) | byte(len(raw))}, raw...)
}

type mmdbKV struct {
	key string
	val []byte
}

func encodeMMDBMap(entries []mmdbKV) []byte {
	out := encodeMMDBSize(7, len(entries))
	for _, kv := range entries {
		out = append(out, encodeMMDBUTF8(kv.key)...)
		out = append(out, kv.val...)
	}
	return out
}

func encodeMMDBArray(items [][]byte) []byte {
	out := []byte{byte(len(items)), 11 - 7}
	for _, it := range items {
		out = append(out, it...)
	}
	return out
}

func buildMinimalMMDB(dbType string, payloadMap []byte) []byte {
	searchTree := []byte{0x00, 0x00, 0x11, 0x00, 0x00, 0x11}
	separator := make([]byte, 16)
	marker := append([]byte{0xab, 0xcd, 0xef}, []byte("MaxMind.com")...)
	metadata := encodeMMDBMap([]mmdbKV{
		{"binary_format_major_version", encodeMMDBUint(5, 2)},
		{"binary_format_minor_version", encodeMMDBUint(5, 0)},
		{"build_epoch", encodeMMDBUint(9, 1700000000)},
		{"database_type", encodeMMDBUTF8(dbType)},
		{"ip_version", encodeMMDBUint(5, 4)},
		{"node_count", encodeMMDBUint(6, 1)},
		{"record_size", encodeMMDBUint(5, 24)},
	})
	var buf bytes.Buffer
	buf.Write(searchTree)
	buf.Write(separator)
	buf.Write(payloadMap)
	buf.Write(marker)
	buf.Write(metadata)
	return buf.Bytes()
}

func writeFixtureMMDBDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	cityRec := encodeMMDBMap([]mmdbKV{
		{"country", encodeMMDBMap([]mmdbKV{{"iso_code", encodeMMDBUTF8("US")}})},
		{"subdivisions", encodeMMDBArray([][]byte{
			encodeMMDBMap([]mmdbKV{
				{"iso_code", encodeMMDBUTF8("GA")},
				{"names", encodeMMDBMap([]mmdbKV{{"en", encodeMMDBUTF8("Georgia")}})},
			}),
		})},
		{"city", encodeMMDBMap([]mmdbKV{{"names", encodeMMDBMap([]mmdbKV{{"en", encodeMMDBUTF8("Atlanta")}})}})},
		{"location", encodeMMDBMap([]mmdbKV{{"time_zone", encodeMMDBUTF8("America/New_York")}})},
	})
	asnRec := encodeMMDBMap([]mmdbKV{
		{"autonomous_system_number", encodeMMDBUint(6, 64512)},
		{"autonomous_system_organization", encodeMMDBUTF8("Acme Recruiting Fiber")},
	})
	if err := os.WriteFile(filepath.Join(dir, CityDBFilename), buildMinimalMMDB("GeoLite2-City", cityRec), 0o600); err != nil {
		t.Fatalf("write city mmdb: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, ASNDBFilename), buildMinimalMMDB("GeoLite2-ASN", asnRec), 0o600); err != nil {
		t.Fatalf("write asn mmdb: %v", err)
	}
	return dir
}

func TestGeoIPReaderLookupPrivateAbsentCorruptAndClose(t *testing.T) {
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))

	dir := writeFixtureMMDBDir(t)
	reader := NewReader(dir, logger)

	hit := reader.Lookup("198.51.100.42")
	if hit.Branch != BranchHit || hit.Country == nil || *hit.Country != "US" ||
		hit.Region == nil || *hit.Region != "GA" ||
		hit.City == nil || *hit.City != "Atlanta" ||
		hit.Timezone == nil || *hit.Timezone != "America/New_York" ||
		hit.ASN == nil || *hit.ASN != 64512 ||
		hit.ASNOrg == nil || *hit.ASNOrg != "Acme Recruiting Fiber" {
		t.Fatalf("unexpected hit enrichment: %+v", hit)
	}

	for _, priv := range []string{"127.0.0.1", "10.0.0.1", "192.168.1.10", "::1", "fd00::1", "::ffff:127.0.0.1"} {
		res := reader.Lookup(priv)
		if res.Branch != BranchPrivateOrUnmap || res.Country != nil || res.ASN != nil {
			t.Fatalf("expected private short-circuit for %q, got %+v", priv, res)
		}
	}

	if err := reader.Close(); err != nil {
		t.Fatalf("close reader: %v", err)
	}
	// Idempotent second Close succeeds.
	if err := reader.Close(); err != nil {
		t.Fatalf("second close reader: %v", err)
	}

	emptyReader := NewReader(t.TempDir(), logger)
	defer emptyReader.Close()
	absent := emptyReader.Lookup("198.51.100.42")
	if absent.Branch != BranchAbsentFallback || absent.Country != nil {
		t.Fatalf("expected absent fallback, got %+v", absent)
	}

	corruptDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(corruptDir, CityDBFilename), []byte("corrupt-bytes"), 0o600); err != nil {
		t.Fatalf("write corrupt mmdb: %v", err)
	}
	corruptReader := NewReader(corruptDir, logger)
	defer corruptReader.Close()
	corrupt := corruptReader.Lookup("198.51.100.42")
	if corrupt.Branch != BranchCorruptDegraded || corrupt.Country != nil {
		t.Fatalf("expected corrupt degraded, got %+v", corrupt)
	}

	logged := logBuf.String()
	if !strings.Contains(logged, "analytics.geoip.mmdb_load_failed") ||
		!strings.Contains(logged, "analytics.geoip.lookup_branch") {
		t.Fatalf("expected geoip seam logs, got:\n%s", logged)
	}
	if strings.Contains(logged, "198.51.100.42") || strings.Contains(logged, "127.0.0.1") {
		t.Fatalf("raw IP leaked into geoip logs:\n%s", logged)
	}
}

func TestGeoIPReaderMidLookupReadErrorEmitsLookupBranchSeam(t *testing.T) {
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))

	// Valid MMDB metadata header whose search tree points past the data section,
	// so Open succeeds and the first Lookup triggers a mid-lookup read error.
	badTree := []byte{0x00, 0x00, 0x99, 0x00, 0x00, 0x99}
	separator := make([]byte, 16)
	marker := append([]byte{0xab, 0xcd, 0xef}, []byte("MaxMind.com")...)
	metadata := encodeMMDBMap([]mmdbKV{
		{"binary_format_major_version", encodeMMDBUint(5, 2)},
		{"binary_format_minor_version", encodeMMDBUint(5, 0)},
		{"build_epoch", encodeMMDBUint(9, 1700000000)},
		{"database_type", encodeMMDBUTF8("GeoLite2-City")},
		{"ip_version", encodeMMDBUint(5, 4)},
		{"node_count", encodeMMDBUint(6, 1)},
		{"record_size", encodeMMDBUint(5, 24)},
	})
	var raw bytes.Buffer
	raw.Write(badTree)
	raw.Write(separator)
	raw.Write(marker)
	raw.Write(metadata)

	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, CityDBFilename), raw.Bytes(), 0o600); err != nil {
		t.Fatalf("write mid-lookup bad city mmdb: %v", err)
	}

	reader := NewReader(dir, logger)
	defer reader.Close()
	res := reader.Lookup("198.51.100.42")
	if res.Branch != BranchCorruptDegraded {
		t.Fatalf("expected BranchCorruptDegraded on mid-lookup error, got %+v", res)
	}
	logged := logBuf.String()
	if !strings.Contains(logged, `"event":"analytics.geoip.mmdb_load_failed"`) ||
		!strings.Contains(logged, `"event":"analytics.geoip.lookup_branch"`) ||
		!strings.Contains(logged, `"branch":"mmdb_corrupt_degraded"`) {
		t.Fatalf("expected both mmdb_load_failed and lookup_branch(mmdb_corrupt_degraded) on mid-lookup error, got:\n%s", logged)
	}
}
