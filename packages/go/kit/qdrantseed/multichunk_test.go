package qdrantseed

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func TestMultiChunkPointIDDedupAndSectionHeadingSanitization(t *testing.T) {
	// CollectionChunkPointID delegates portfolio_docs directly to PortfolioPointID(docKey, chunkIndex)
	for chunk := 0; chunk < 3; chunk++ {
		got := qdrant.CollectionChunkPointID(CollectionPortfolioDocs, "dossier:platform-lead", chunk)
		want := qdrant.PortfolioPointID("dossier:platform-lead", chunk)
		if got != want {
			t.Fatalf("chunk %d point ID mismatch: got %q want %q", chunk, got, want)
		}
	}
	if qdrant.CollectionChunkPointID(CollectionPortfolioDocs, "dossier:platform-lead", 0) ==
		qdrant.CollectionChunkPointID(CollectionPortfolioDocs, "dossier:platform-lead", 1) {
		t.Fatal("expected distinct UUIDv5 point IDs for chunks 0 and 1")
	}

	// MergeSeedDocuments deduplicates on (ID, ChunkIndex), preserving distinct chunks of same docKey
	merged := MergeSeedDocuments(
		[]SeedDocument{
			{ID: "dossier:platform-lead", ChunkIndex: 0, Title: "Platform", Body: "Summary", Category: "career_dossier", Source: "postgres"},
			{ID: "dossier:platform-lead", ChunkIndex: 1, Title: "Platform", SectionHeading: "Database", Body: "PG19 details", Category: "career_dossier", Source: "postgres"},
		},
		[]SeedDocument{
			{ID: "dossier:platform-lead", ChunkIndex: 0, Title: "Duplicate", Body: "Should drop", Category: "career_dossier", Source: "postgres"},
			{ID: "dossier:platform-lead", ChunkIndex: 2, Title: "Platform", SectionHeading: "Security", Body: "Auth details", Category: "career_dossier", Source: "postgres"},
		},
	)
	if len(merged) != 3 {
		t.Fatalf("expected 3 unique (ID, ChunkIndex) chunks, got %d: %+v", len(merged), merged)
	}

	// ValidateOriginConfidentiality scans SectionHeading against both built-in rules and DOSSIER_PRIVACY_DENYLIST without leaking literals
	rawJSON, _ := json.Marshal([]string{"SyntheticConfidentialClientX"})
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", base64.StdEncoding.EncodeToString(rawJSON))

	err := ValidateOriginConfidentiality([]SeedDocument{
		{
			ID:             "dossier:test",
			ChunkIndex:     1,
			Title:          "Clean Title",
			SectionHeading: "SyntheticConfidentialClientX Migration",
			Body:           "Clean body text",
			Category:       "career_dossier",
			Source:         "postgres",
		},
	})
	if !errors.Is(err, ErrOriginConfidentiality) {
		t.Fatalf("expected ErrOriginConfidentiality on denylisted sectionHeading, got %v", err)
	}
	if strings.Contains(err.Error(), "SyntheticConfidentialClientX") {
		t.Fatalf("error message must not echo blocked denylist literal: %v", err)
	}

	// Malformed non-empty DOSSIER_PRIVACY_DENYLIST fails closed without echoing raw env bytes
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", "!!!not-valid-base64-secret-value!!!")
	malformedErr := ValidateOriginConfidentiality([]SeedDocument{
		{ID: "dossier:clean", Title: "Clean", Body: "Clean body", Category: "career_dossier", Source: "postgres"},
	})
	if !errors.Is(malformedErr, ErrOriginConfidentiality) {
		t.Fatalf("expected ErrOriginConfidentiality on malformed DOSSIER_PRIVACY_DENYLIST, got %v", malformedErr)
	}
	if strings.Contains(malformedErr.Error(), "not-valid-base64-secret-value") {
		t.Fatalf("malformed denylist error must not leak raw env value: %v", malformedErr)
	}

	// ValidateOriginConfidentiality catches newline, double-space, hyphen, dot, slash, Cf (ZWSP/U+2060), fullwidth, Hangul+Mn, and NFD obfuscation
	obfJSON, _ := json.Marshal([]string{"Acme Capital", "SecretClient", "CafeCorp", "\uD55C\uAE00Corp"})
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", strings.TrimRight(base64.StdEncoding.EncodeToString(obfJSON), "="))
	for _, variant := range []string{
		"Built for Acme\nCapital platform",
		"Built for Acme  Capital platform",
		"Built for Acme-Capital platform",
		"Built for Acme.Capital platform",
		"Built for Acme/Capital platform",
		"Built for Sec\u200BretClient platform",
		"Built for Sec\u2060retClient platform",
		"Built for \uFF33\uFF45\uFF43\uFF52\uFF45\uFF54\uFF23\uFF4C\uFF49\uFF45\uFF4E\uFF54 platform",
		"Built for Cafe\u0301Corp platform",
		"Built for \uD55C\u0301\uAE00Corp platform",
	} {
		vErr := ValidateOriginConfidentiality([]SeedDocument{
			{ID: "dossier:obf", Title: "Clean", Body: variant, Category: "career_dossier", Source: "postgres"},
		})
		if !errors.Is(vErr, ErrOriginConfidentiality) {
			t.Fatalf("expected ErrOriginConfidentiality for obfuscated variant %q, got %v", variant, vErr)
		}
	}

	// Base64 JSON null in DOSSIER_PRIVACY_DENYLIST fails closed
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", base64.StdEncoding.EncodeToString([]byte("null")))
	if nullErr := ValidateOriginConfidentiality([]SeedDocument{
		{ID: "dossier:clean", Title: "Clean", Body: "Clean body", Category: "career_dossier", Source: "postgres"},
	}); !errors.Is(nullErr, ErrOriginConfidentiality) {
		t.Fatalf("expected ErrOriginConfidentiality on base64 JSON null DOSSIER_PRIVACY_DENYLIST, got %v", nullErr)
	}

	// Empty DOSSIER_PRIVACY_DENYLIST STILL blocks built-in secrets, extended credentials, and ZWSP-obfuscated tokens
	t.Setenv("DOSSIER_PRIVACY_DENYLIST", "")
	jwtHeader := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	jwtPayload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"user-123","iss":"issuer"}`))
	fakeJWT := jwtHeader + "." + jwtPayload + "." + strings.Repeat("S", 32)
	for _, secretVariant := range []string{
		"Connect postgres://admin:S3cr3tP4ss@db.internal:5432/app",
		"Bearer " + fakeJWT,
		"Token github_pat_11ABCDEFGH0123456789_abcdefghijklmnopqrstuvwxyz",
		"OpenAI sk-proj-AbCdEf1234567890GhIjKlMnOpQrStUv",
		"Stripe sk_live_1234567890abcdefghij",
		"AWS ASIAIOSFODNN7EXAMPLE",
		"AWS AK\u200BIAIOSFODNN7EXAMPLE",
		"Slack xoxb-123456789012-123456789012-abcdefg",
		"Reference OQ\u200B-999 internal item",
	} {
		sErr := ValidateOriginConfidentiality([]SeedDocument{
			{ID: "dossier:secret", Title: "Clean", Body: secretVariant, Category: "career_dossier", Source: "postgres"},
		})
		if !errors.Is(sErr, ErrOriginConfidentiality) {
			t.Fatalf("expected empty-denylist ValidateOriginConfidentiality to reject %q, got %v", secretVariant, sErr)
		}
	}
}
