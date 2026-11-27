package main

import (
	"fmt"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
)

func optionalIntPtr(v *int) *int32 {
	if v == nil {
		return nil
	}
	out := int32(*v)
	return &out
}

func optionalPositiveInt(v int) *int32 {
	if v <= 0 {
		return nil
	}
	out := int32(v)
	return &out
}

func optionalNonNegInt(v int) *int32 {
	if v < 0 {
		return nil
	}
	out := int32(v)
	return &out
}

func toProtoOsc7501Status(s *contracts.Osc7501Status) *cadencev1.Osc7501Status {
	if s == nil {
		return nil
	}
	ts := ""
	if !s.Timestamp.IsZero() {
		ts = s.Timestamp.UTC().Format(time.RFC3339Nano)
	}
	return &cadencev1.Osc7501Status{
		Source:    s.Source,
		State:     s.State,
		Label:     s.Label,
		Progress:  optionalIntPtr(s.Progress),
		Timestamp: ts,
	}
}

func toProtoSpecArtifact(s *contracts.CadenceSpecArtifact) *cadencev1.CadenceSpecArtifact {
	if s == nil {
		return nil
	}
	return &cadencev1.CadenceSpecArtifact{
		Title:            s.Title,
		Summary:          s.Summary,
		Conditions:       s.Conditions,
		Handling:         s.Handling,
		Outcomes:         s.Outcomes,
		Rules:            s.Rules,
		Deltas:           s.Deltas,
		RecalledPatterns: s.RecalledPatterns,
	}
}

func toProtoGateAudit(g *contracts.CadenceGateAudit) *cadencev1.CadenceGateAudit {
	if g == nil {
		return nil
	}
	checks := make([]*cadencev1.CadenceGateCheckItem, 0, len(g.Checks))
	for _, c := range g.Checks {
		checks = append(checks, &cadencev1.CadenceGateCheckItem{
			Id:     c.ID,
			Label:  c.Label,
			Status: c.Status,
			Detail: c.Detail,
		})
	}
	return &cadencev1.CadenceGateAudit{
		Summary:       g.Summary,
		Sanitized:     g.Sanitized,
		ArtifactBytes: int32(g.ArtifactBytes),
		Checks:        checks,
	}
}

func toProtoPayloadValue(v any) *cadencev1.CadenceTurnPayloadValue {
	switch val := v.(type) {
	case nil:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NullValue{NullValue: true},
		}
	case string:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_StringValue{StringValue: val},
		}
	case bool:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_BoolValue{BoolValue: val},
		}
	case int:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: float64(val)},
		}
	case int32:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: float64(val)},
		}
	case int64:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: float64(val)},
		}
	case float32:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: float64(val)},
		}
	case float64:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: val},
		}
	case []string:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_StringListValue{
				StringListValue: &cadencev1.CadenceStringList{Values: val},
			},
		}
	case []any:
		strs := make([]string, 0, len(val))
		for _, item := range val {
			strs = append(strs, fmt.Sprint(item))
		}
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_StringListValue{
				StringListValue: &cadencev1.CadenceStringList{Values: strs},
			},
		}
	default:
		return &cadencev1.CadenceTurnPayloadValue{
			Kind: &cadencev1.CadenceTurnPayloadValue_StringValue{StringValue: fmt.Sprint(val)},
		}
	}
}

func toProtoCadenceTurn(t contracts.CadenceTurn) *cadencev1.CadenceTurn {
	var payload map[string]*cadencev1.CadenceTurnPayloadValue
	if len(t.Payload) > 0 {
		payload = make(map[string]*cadencev1.CadenceTurnPayloadValue, len(t.Payload))
		for k, v := range t.Payload {
			payload[k] = toProtoPayloadValue(v)
		}
	}
	return &cadencev1.CadenceTurn{
		Id:        optionalPositiveInt(t.ID),
		Phase:     t.Phase,
		AgentName: t.AgentName,
		Status:    t.Status,
		Summary:   t.Summary,
		LatencyMs: int32(t.LatencyMs),
		Payload:   payload,
		CreatedAt: t.CreatedAt,
	}
}

func toProtoCadenceRunResult(r contracts.CadenceRunResult) *cadencev1.CadenceRunResult {
	turns := make([]*cadencev1.CadenceTurn, 0, len(r.Turns))
	for _, turn := range r.Turns {
		turns = append(turns, toProtoCadenceTurn(turn))
	}
	return &cadencev1.CadenceRunResult{
		RunId:         r.RunID,
		Prompt:        r.Prompt,
		PresetSlug:    r.PresetSlug,
		RunStatus:     r.RunStatus,
		Mode:          r.Mode,
		ExecutionMode: r.ExecutionMode,
		IsGolden:      r.IsGolden,
		Spec:          toProtoSpecArtifact(r.Spec),
		GateAudit:     toProtoGateAudit(r.GateAudit),
		Status:        toProtoOsc7501Status(r.Status),
		Osc7501:       r.OSC7501,
		GateVerdict:   r.GateVerdict,
		Turns:         turns,
		ArtifactHtml:  r.ArtifactHTML,
		TokensIn:      optionalNonNegInt(r.TokensIn),
		TokensOut:     optionalNonNegInt(r.TokensOut),
		Quota:         grpckit.ToProtoQuota(r.Quota),
		CreatedAt:     r.CreatedAt,
	}
}

func toProtoPhaseEvent(ev contracts.CadenceStreamPhaseEvent) *cadencev1.CadenceStreamPhaseEvent {
	var progress *int32
	if ev.Status != nil && ev.Status.Progress != nil {
		progress = optionalIntPtr(ev.Status.Progress)
	} else if ev.Progress >= 0 {
		p := int32(ev.Progress)
		progress = &p
	}
	return &cadencev1.CadenceStreamPhaseEvent{
		RunId:     ev.RunID,
		RunStatus: ev.RunStatus,
		Status:    toProtoOsc7501Status(ev.Status),
		Progress:  progress,
		Turn:      toProtoCadenceTurn(ev.Turn),
		Spec:      toProtoSpecArtifact(ev.Spec),
	}
}

func toProtoLogEvent(ev contracts.CadenceStreamLogEvent) *cadencev1.CadenceStreamLogEvent {
	return &cadencev1.CadenceStreamLogEvent{
		RunId:     ev.RunID,
		Line:      ev.Line,
		Timestamp: ev.Timestamp,
	}
}

func toProtoCompleteEvent(ev contracts.CadenceStreamCompleteEvent) *cadencev1.CadenceStreamCompleteEvent {
	return &cadencev1.CadenceStreamCompleteEvent{
		Run:   toProtoCadenceRunResult(ev.Run),
		Quota: grpckit.ToProtoQuota(ev.Quota),
	}
}

func toProtoErrorEvent(ev contracts.CadenceStreamErrorEvent) *cadencev1.CadenceStreamErrorEvent {
	return &cadencev1.CadenceStreamErrorEvent{
		RunId:     ev.RunID,
		Error:     ev.Error,
		Code:      ev.Code,
		RunStatus: ev.RunStatus,
	}
}
