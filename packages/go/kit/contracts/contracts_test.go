package contracts

import "testing"

func TestCadenceRunRequestValidate(t *testing.T) {
	t.Parallel()

	if err := (CadenceRunRequest{Prompt: "hi"}).Validate(); err == nil {
		t.Fatal("expected error for short prompt")
	}
	if err := (CadenceRunRequest{Prompt: "Build a Solar Forge latency gauge"}).Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestContactRequestValidate(t *testing.T) {
	t.Parallel()

	if err := (ContactRequest{Name: "A", Email: "bad", Message: "short"}).Validate(); err == nil {
		t.Fatal("expected error for invalid contact payload")
	}
	valid := ContactRequest{
		Name:    "Andrew",
		Email:   "hello@andrew-k.us",
		Subject: "Architecture",
		Message: "Would love to discuss CADENCE and GKE scale-to-zero.",
	}
	if err := valid.Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateUUID(t *testing.T) {
	t.Parallel()

	if !ValidateUUID("11111111-1111-4111-8111-111111111111") {
		t.Fatal("expected canonical UUIDv4 to validate")
	}
	if ValidateUUID("not-a-uuid") || ValidateUUID("11111111-1111-4111-8111-11111111111g") {
		t.Fatal("expected malformed UUID to fail validation")
	}
}
