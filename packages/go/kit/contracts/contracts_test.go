package contracts

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestCadenceRunRequestValidate(t *testing.T) {
	t.Parallel()

	if err := (CadenceRunRequest{Prompt: "hi"}).Validate(); err == nil {
		t.Fatal("expected error for short prompt")
	}
	if err := (CadenceRunRequest{Prompt: "Build a Solar Forge latency gauge"}).Validate(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := (CadenceRunRequest{Prompt: "Build a Solar Forge latency gauge", Mode: CadenceModeFast}).Validate(); err != nil {
		t.Fatalf("unexpected error for fast mode: %v", err)
	}
	if err := (CadenceRunRequest{Prompt: "Build a Solar Forge latency gauge", Mode: CadenceModeLLM}).Validate(); err != nil {
		t.Fatalf("unexpected error for llm mode: %v", err)
	}
	if err := (CadenceRunRequest{Prompt: "Build a Solar Forge latency gauge", Mode: "invalid"}).Validate(); err == nil {
		t.Fatal("expected error for unrecognized mode")
	}
}

func TestCadenceRunResultAndStreamJSONParity(t *testing.T) {
	t.Parallel()

	res := CadenceRunResult{
		RunID:        "11111111-1111-4111-8111-111111111111",
		Prompt:       "Inspect pipeline telemetry",
		PresetSlug:   "chord-pipeline-monitor",
		RunStatus:    CadenceStatusPending,
		Mode:         CadenceModeFast,
		GateVerdict:  "pending",
		Turns:        []CadenceTurn{},
		ArtifactHTML: "",
	}
	raw, err := json.Marshal(res)
	if err != nil {
		t.Fatalf("marshal CadenceRunResult: %v", err)
	}
	text := string(raw)
	for _, needle := range []string{
		`"runId":"11111111-1111-4111-8111-111111111111"`,
		`"presetSlug":"chord-pipeline-monitor"`,
		`"runStatus":"pending"`,
		`"mode":"fast"`,
		`"gateVerdict":"pending"`,
		`"turns":[]`,
		`"artifactHtml":""`,
	} {
		if !strings.Contains(text, needle) {
			t.Fatalf("expected %s in JSON %s", needle, text)
		}
	}

	ev := CadenceStreamPhaseEvent{
		RunID:     res.RunID,
		RunStatus: CadenceStatusRunning,
		Progress:  50,
		Turn: CadenceTurn{
			Phase:     "spec",
			AgentName: "chord-spec",
			Status:    "completed",
			Summary:   "Spec drafted",
			LatencyMs: 3,
		},
	}
	evRaw, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("marshal phase event: %v", err)
	}
	if !strings.Contains(string(evRaw), `"runStatus":"running"`) {
		t.Fatalf("unexpected phase event JSON: %s", string(evRaw))
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
