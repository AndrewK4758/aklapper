package adminapi_e2e_test

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"strings"
	"testing"
)

func encodeCBORBytes(b []byte) []byte {
	var out bytes.Buffer
	n := len(b)
	switch {
	case n < 24:
		out.WriteByte(0x40 | byte(n))
	case n < 256:
		out.WriteByte(0x58)
		out.WriteByte(byte(n))
	default:
		out.WriteByte(0x59)
		_ = binary.Write(&out, binary.BigEndian, uint16(n))
	}
	out.Write(b)
	return out.Bytes()
}

func buildTestPasskeyAttestationJSON(t *testing.T, challenge, origin, rpID string, credID []byte) string {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatalf("ecdsa.GenerateKey: %v", err)
	}
	xBytes := make([]byte, 32)
	yBytes := make([]byte, 32)
	priv.PublicKey.X.FillBytes(xBytes)
	priv.PublicKey.Y.FillBytes(yBytes)

	// Deterministic CBOR COSE_Key map: {1: 2 (EC2), 3: -7 (ES256), -1: 1 (P-256), -2: x, -3: y}.
	var cose bytes.Buffer
	cose.Write([]byte{0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21})
	cose.Write(encodeCBORBytes(xBytes))
	cose.WriteByte(0x22)
	cose.Write(encodeCBORBytes(yBytes))

	rpHash := sha256.Sum256([]byte(rpID))
	var authData bytes.Buffer
	authData.Write(rpHash[:])
	authData.WriteByte(0x5d) // UP | UV | BE | BS | AT
	_ = binary.Write(&authData, binary.BigEndian, uint32(0))
	authData.Write(make([]byte, 16)) // AAGUID
	_ = binary.Write(&authData, binary.BigEndian, uint16(len(credID)))
	authData.Write(credID)
	authData.Write(cose.Bytes())

	// CBOR attestationObject: {"fmt":"none","attStmt":{},"authData":<bytes>}.
	var attObj bytes.Buffer
	attObj.WriteByte(0xa3)
	attObj.Write([]byte{0x63, 'f', 'm', 't', 0x64, 'n', 'o', 'n', 'e'})
	attObj.Write([]byte{0x67, 'a', 't', 't', 'S', 't', 'm', 't', 0xa0})
	attObj.Write([]byte{0x68, 'a', 'u', 't', 'h', 'D', 'a', 't', 'a'})
	attObj.Write(encodeCBORBytes(authData.Bytes()))

	clientData, _ := json.Marshal(map[string]any{
		"type":      "webauthn.create",
		"challenge": challenge,
		"origin":    origin,
	})
	credIDB64 := base64.RawURLEncoding.EncodeToString(credID)
	payload, _ := json.Marshal(map[string]any{
		"id":    credIDB64,
		"rawId": credIDB64,
		"type":  "public-key",
		"response": map[string]any{
			"clientDataJSON":    base64.RawURLEncoding.EncodeToString(clientData),
			"attestationObject": base64.RawURLEncoding.EncodeToString(attObj.Bytes()),
			"transports":        []string{"internal"},
		},
	})
	return string(payload)
}

func parseStructuredSeamLogs(rawLogs string) []map[string]any {
	out := make([]map[string]any, 0)
	for _, line := range strings.Split(rawLogs, "\n") {
		idx := strings.IndexByte(line, '{')
		if idx < 0 {
			continue
		}
		var entry map[string]any
		if err := json.Unmarshal([]byte(line[idx:]), &entry); err == nil {
			if _, hasEvent := entry["event"]; hasEvent {
				out = append(out, entry)
			}
		}
	}
	return out
}

func hasSeamEntry(entries []map[string]any, seamType, event string, match func(map[string]any) bool) bool {
	for _, e := range entries {
		st, _ := e["seam_type"].(string)
		ev, _ := e["event"].(string)
		corr, _ := e["correlationId"].(string)
		if st == seamType && ev == event && strings.TrimSpace(corr) != "" {
			if match == nil || match(e) {
				return true
			}
		}
	}
	return false
}
