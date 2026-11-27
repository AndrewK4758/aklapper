package analytics

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"
	"unicode/utf8"

	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
)

const (
	MaxEventsPerBatch     = 50
	MaxMetadataKeys       = 16
	MaxMetadataKeyLen     = 64
	MaxMetadataStringLen  = 256
	MaxEventMetadataBytes = 2048
	MaxBatchPayloadBytes  = 64 * 1024
)

func isAllowedEventType(t string) bool {
	switch t {
	case "page_view", "interaction", "web_vital", "error":
		return true
	default:
		return false
	}
}

func containsNul(s string) bool {
	return strings.IndexByte(s, 0) >= 0
}

// ValidateBatchBounds enforces strict payload and metadata caps before any database write.
func ValidateBatchBounds(batch *portalv1.IngestAnalyticsRequest) error {
	if batch == nil {
		return errors.New("analytics batch is required")
	}
	sessionID := strings.TrimSpace(batch.GetSessionId())
	if sessionID == "" || len(sessionID) > 128 || containsNul(batch.GetSessionId()) {
		return errors.New("sessionId must be 1..128 characters without NUL bytes")
	}
	if len(batch.GetEvents()) == 0 || len(batch.GetEvents()) > MaxEventsPerBatch {
		return fmt.Errorf("events must contain 1..%d items", MaxEventsPerBatch)
	}

	batchBytes := len(batch.GetSessionId()) + len(batch.GetReferrer()) + len(batch.GetLandingPath()) +
		len(batch.GetRefParam()) + len(batch.GetUtmSource()) + len(batch.GetUtmMedium()) +
		len(batch.GetUtmCampaign()) + len(batch.GetUtmContent())

	for _, optField := range []struct {
		name string
		val  string
		max  int
	}{
		{"referrer", batch.GetReferrer(), 1024},
		{"landingPath", batch.GetLandingPath(), MaxPathLen},
		{"refParam", batch.GetRefParam(), MaxPathLen},
		{"utmSource", batch.GetUtmSource(), MaxPathLen},
		{"utmMedium", batch.GetUtmMedium(), MaxPathLen},
		{"utmCampaign", batch.GetUtmCampaign(), MaxPathLen},
		{"utmContent", batch.GetUtmContent(), MaxPathLen},
	} {
		if containsNul(optField.val) || utf8.RuneCountInString(optField.val) > optField.max {
			return fmt.Errorf("%s exceeds bounds or contains NUL", optField.name)
		}
	}

	for idx, ev := range batch.GetEvents() {
		if ev == nil || !isAllowedEventType(ev.GetType()) {
			return fmt.Errorf("event[%d] has unsupported type", idx)
		}
		name := strings.TrimSpace(ev.GetName())
		path := strings.TrimSpace(ev.GetPath())
		if name == "" || utf8.RuneCountInString(name) > 120 || containsNul(ev.GetName()) {
			return fmt.Errorf("event[%d].name invalid", idx)
		}
		if path == "" || utf8.RuneCountInString(path) > MaxPathLen || containsNul(ev.GetPath()) {
			return fmt.Errorf("event[%d].path invalid", idx)
		}
		if ev.Value != nil && (math.IsNaN(*ev.Value) || math.IsInf(*ev.Value, 0)) {
			return fmt.Errorf("event[%d].value must be finite", idx)
		}
		if _, err := time.Parse(time.RFC3339Nano, ev.GetTimestamp()); err != nil {
			return fmt.Errorf("event[%d].timestamp must be ISO-8601", idx)
		}

		meta := ev.GetMetadata()
		if len(meta) > MaxMetadataKeys {
			return fmt.Errorf("event[%d].metadata exceeds %d keys", idx, MaxMetadataKeys)
		}
		metaMap := make(map[string]any, len(meta))
		for k, v := range meta {
			if k == "" || utf8.RuneCountInString(k) > MaxMetadataKeyLen || containsNul(k) {
				return fmt.Errorf("event[%d].metadata key invalid", idx)
			}
			if v == nil {
				return fmt.Errorf("event[%d].metadata value missing for %q", idx, k)
			}
			switch kind := v.Kind.(type) {
			case *portalv1.AnalyticsMetadataValue_StringValue:
				if containsNul(kind.StringValue) || utf8.RuneCountInString(kind.StringValue) > MaxMetadataStringLen {
					return fmt.Errorf("event[%d].metadata[%q] string exceeds %d chars or contains NUL", idx, k, MaxMetadataStringLen)
				}
				metaMap[k] = kind.StringValue
			case *portalv1.AnalyticsMetadataValue_NumberValue:
				if math.IsNaN(kind.NumberValue) || math.IsInf(kind.NumberValue, 0) {
					return fmt.Errorf("event[%d].metadata[%q] number must be finite", idx, k)
				}
				metaMap[k] = kind.NumberValue
			case *portalv1.AnalyticsMetadataValue_BoolValue:
				metaMap[k] = kind.BoolValue
			default:
				return fmt.Errorf("event[%d].metadata[%q] unsupported value kind", idx, k)
			}
		}
		serializedMeta, err := json.Marshal(metaMap)
		if err != nil {
			return fmt.Errorf("event[%d].metadata marshal failed", idx)
		}
		if len(serializedMeta) > MaxEventMetadataBytes {
			return fmt.Errorf("event[%d].metadata exceeds %d bytes", idx, MaxEventMetadataBytes)
		}
		batchBytes += len(ev.GetType()) + len(ev.GetName()) + len(ev.GetPath()) + len(ev.GetTimestamp()) + len(serializedMeta) + 16
		if batchBytes > MaxBatchPayloadBytes {
			return fmt.Errorf("analytics batch exceeds %d bytes", MaxBatchPayloadBytes)
		}
	}
	return nil
}
