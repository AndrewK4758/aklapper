package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/jackc/pgx/v5"
)

type adminOpsServiceServer struct {
	deps adminServiceDeps
}

var _ adminv1connect.AdminOpsServiceHandler = (*adminOpsServiceServer)(nil)

func newAdminOpsServiceServer(deps adminServiceDeps) *adminOpsServiceServer {
	return &adminOpsServiceServer{deps: deps}
}

func mapSandboxTurnToProto(id int32, phase, agentName, status string, latencyMs int32, payloadRaw string, createdAt time.Time) *cadencev1.CadenceTurn {
	if phase != "triage" && phase != "spec" && phase != "build" && phase != "gate" {
		phase = "build"
	}
	if status != "pending" && status != "running" && status != "completed" && status != "failed" {
		status = "completed"
	}
	var payloadMap map[string]any
	_ = json.Unmarshal([]byte(payloadRaw), &payloadMap)
	summary := ""
	protoPayload := make(map[string]*cadencev1.CadenceTurnPayloadValue)
	for k, v := range payloadMap {
		if k == "summary" {
			if s, ok := v.(string); ok {
				summary = s
			}
			continue
		}
		switch tv := v.(type) {
		case string:
			protoPayload[k] = &cadencev1.CadenceTurnPayloadValue{Kind: &cadencev1.CadenceTurnPayloadValue_StringValue{StringValue: tv}}
		case float64:
			protoPayload[k] = &cadencev1.CadenceTurnPayloadValue{Kind: &cadencev1.CadenceTurnPayloadValue_NumberValue{NumberValue: tv}}
		case bool:
			protoPayload[k] = &cadencev1.CadenceTurnPayloadValue{Kind: &cadencev1.CadenceTurnPayloadValue_BoolValue{BoolValue: tv}}
		case nil:
			protoPayload[k] = &cadencev1.CadenceTurnPayloadValue{Kind: &cadencev1.CadenceTurnPayloadValue_NullValue{NullValue: true}}
		case []any:
			strs := make([]string, 0, len(tv))
			allStr := true
			for _, item := range tv {
				if sv, ok := item.(string); ok {
					strs = append(strs, sv)
				} else {
					allStr = false
					break
				}
			}
			if allStr {
				protoPayload[k] = &cadencev1.CadenceTurnPayloadValue{Kind: &cadencev1.CadenceTurnPayloadValue_StringListValue{StringListValue: &cadencev1.CadenceStringList{Values: strs}}}
			}
		}
	}
	idCopy := id
	return &cadencev1.CadenceTurn{
		Id:        &idCopy,
		Phase:     phase,
		AgentName: agentName,
		Status:    status,
		Summary:   summary,
		LatencyMs: latencyMs,
		Payload:   protoPayload,
		CreatedAt: formatRFC3339Millis(createdAt),
	}
}

func (s *adminOpsServiceServer) loadSandboxTurnsByRunIDs(ctx context.Context, runIDs []string) (map[string][]*cadencev1.CadenceTurn, error) {
	out := make(map[string][]*cadencev1.CadenceTurn, len(runIDs))
	if len(runIDs) == 0 {
		return out, nil
	}
	rows, err := s.deps.store.Pool().Query(
		ctx,
		`SELECT id, run_id::text, phase, agent_name, status, latency_ms, COALESCE(payload_json::text, '{}'), created_at
		 FROM sandbox_turns
		 WHERE run_id = ANY($1::uuid[])
		 ORDER BY id ASC`,
		runIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id, latencyMs int32
		var runID, phase, agentName, status, payloadRaw string
		var createdAt time.Time
		if err := rows.Scan(&id, &runID, &phase, &agentName, &status, &latencyMs, &payloadRaw, &createdAt); err != nil {
			return nil, err
		}
		out[runID] = append(out[runID], mapSandboxTurnToProto(id, phase, agentName, status, latencyMs, payloadRaw, createdAt))
	}
	return out, rows.Err()
}

func normalizeVerdict(v string) string {
	if v == "approved" || v == "rejected" {
		return v
	}
	return "pending"
}

func (s *adminOpsServiceServer) ListSandboxRuns(
	ctx context.Context,
	req *connect.Request[adminv1.ListSandboxRunsRequest],
) (*connect.Response[adminv1.ListSandboxRunsResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	limit := int(req.Msg.GetLimit())
	if limit <= 0 {
		limit = 25
	}
	if limit > 100 {
		limit = 100
	}
	rows, err := s.deps.store.Pool().Query(
		ctx,
		`SELECT id::text, session_id, menu_slug, status, prompt, gate_verdict, COALESCE(artifact_html, ''), tokens_in, tokens_out, created_at
		 FROM sandbox_runs
		 WHERE is_golden = false
		 ORDER BY created_at DESC
		 LIMIT $1`,
		limit,
	)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	defer rows.Close()
	runs := make([]*adminv1.AdminSandboxRun, 0)
	runIDs := make([]string, 0)
	for rows.Next() {
		var r adminv1.AdminSandboxRun
		var createdAt time.Time
		if err := rows.Scan(&r.RunId, &r.SessionId, &r.MenuSlug, &r.RunStatus, &r.Prompt, &r.GateVerdict, &r.ArtifactHtml, &r.TokensIn, &r.TokensOut, &createdAt); err != nil {
			return nil, mapAdminStoreError(err, corrID)
		}
		r.GateVerdict = normalizeVerdict(r.GateVerdict)
		r.CreatedAt = formatRFC3339Millis(createdAt)
		runs = append(runs, &r)
		runIDs = append(runIDs, r.RunId)
	}
	if err := rows.Err(); err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	turnsMap, err := s.loadSandboxTurnsByRunIDs(ctx, runIDs)
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	for _, r := range runs {
		r.Turns = turnsMap[r.RunId]
	}
	return connect.NewResponse(&adminv1.ListSandboxRunsResponse{Runs: runs}), nil
}

func (s *adminOpsServiceServer) OverrideSandboxGateVerdict(
	ctx context.Context,
	req *connect.Request[adminv1.OverrideSandboxGateVerdictRequest],
) (*connect.Response[adminv1.OverrideSandboxGateVerdictResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	runID := strings.TrimSpace(req.Msg.GetRunId())
	verdict := strings.TrimSpace(req.Msg.GetGateVerdict())
	if !contracts.ValidateUUID(runID) || (verdict != "approved" && verdict != "rejected" && verdict != "pending") {
		return nil, newAdminError(connect.CodeInvalidArgument, contracts.ErrCodeValidation, http.StatusBadRequest, "Valid runId and gateVerdict are required.", "Review the gate override parameters.", corrID, nil)
	}

	pool := s.deps.store.Pool()
	var isGolden bool
	err := pool.QueryRow(ctx, `SELECT is_golden FROM sandbox_runs WHERE id = $1::uuid LIMIT 1`, runID).Scan(&isGolden)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Sandbox run not found.", "Refresh the runs list.", corrID, nil)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	if isGolden {
		logAdminSeam("UNSOUND_CONDITION", "cadence.gate.golden_mutation_blocked", map[string]any{
			"runId":         runID,
			"correlationId": corrID,
		})
		return nil, newAdminError(
			connect.CodeFailedPrecondition,
			contracts.ErrCodeConstraint,
			http.StatusConflict,
			"Golden showcase runs are immutable and cannot be modified.",
			"Choose a live visitor run instead.",
			corrID,
			nil,
		)
	}

	var updated adminv1.AdminSandboxRun
	var createdAt time.Time
	err = pool.QueryRow(
		ctx,
		`UPDATE sandbox_runs
		 SET gate_verdict = $2
		 WHERE id = $1::uuid AND is_golden = false
		 RETURNING id::text, session_id, menu_slug, status, prompt, gate_verdict, COALESCE(artifact_html, ''), tokens_in, tokens_out, created_at`,
		runID, verdict,
	).Scan(&updated.RunId, &updated.SessionId, &updated.MenuSlug, &updated.RunStatus, &updated.Prompt, &updated.GateVerdict, &updated.ArtifactHtml, &updated.TokensIn, &updated.TokensOut, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, newAdminError(connect.CodeNotFound, contracts.ErrCodeNotFound, http.StatusNotFound, "Sandbox run not found.", "Refresh the runs list.", corrID, nil)
	}
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	updated.GateVerdict = normalizeVerdict(updated.GateVerdict)
	updated.CreatedAt = formatRFC3339Millis(createdAt)
	turnsMap, err := s.loadSandboxTurnsByRunIDs(ctx, []string{updated.RunId})
	if err != nil {
		return nil, mapAdminStoreError(err, corrID)
	}
	updated.Turns = turnsMap[updated.RunId]
	return connect.NewResponse(&adminv1.OverrideSandboxGateVerdictResponse{Run: &updated}), nil
}
