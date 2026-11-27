package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1/cadencev1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type cadenceConnectServer struct {
	deps cadenceServiceDeps
}

var _ cadencev1connect.CadenceServiceHandler = (*cadenceConnectServer)(nil)

func newCadenceConnectServer(deps cadenceServiceDeps) *cadenceConnectServer {
	return &cadenceConnectServer{deps: deps}
}

type connectCadenceEmitter struct {
	mu     sync.Mutex
	stream *connect.ServerStream[cadencev1.StreamRunResponse]
}

func (e *connectCadenceEmitter) send(resp *cadencev1.StreamRunResponse) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.stream.Send(resp)
}

func (e *connectCadenceEmitter) EmitPhase(ev contracts.CadenceStreamPhaseEvent) error {
	return e.send(&cadencev1.StreamRunResponse{
		Payload: &cadencev1.StreamRunResponse_Phase{Phase: toProtoPhaseEvent(ev)},
	})
}

func (e *connectCadenceEmitter) EmitLog(ev contracts.CadenceStreamLogEvent) error {
	return e.send(&cadencev1.StreamRunResponse{
		Payload: &cadencev1.StreamRunResponse_Log{Log: toProtoLogEvent(ev)},
	})
}

func (e *connectCadenceEmitter) EmitComplete(ev contracts.CadenceStreamCompleteEvent) error {
	return e.send(&cadencev1.StreamRunResponse{
		Payload: &cadencev1.StreamRunResponse_Complete{Complete: toProtoCompleteEvent(ev)},
	})
}

func (e *connectCadenceEmitter) EmitError(ev contracts.CadenceStreamErrorEvent) error {
	return e.send(&cadencev1.StreamRunResponse{
		Payload: &cadencev1.StreamRunResponse_Error{Error: toProtoErrorEvent(ev)},
	})
}

func resolveCadenceCorrID(ctx context.Context) string {
	if corrID := grpckit.CorrelationIDFromContext(ctx); corrID != "" {
		return corrID
	}
	return contracts.NewUUIDv4()
}

func (s *cadenceConnectServer) CreateRun(
	ctx context.Context,
	req *connect.Request[cadencev1.CreateRunRequest],
) (*connect.Response[cadencev1.CreateRunResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)

	res, createdImmediately, svcErr := executeCreateRun(ctx, s.deps, claims, contracts.CadenceRunRequest{
		Prompt:              req.Msg.GetPrompt(),
		PresetSlug:          req.Msg.GetPresetSlug(),
		Mode:                req.Msg.GetMode(),
		DeferExecution:      req.Msg.GetDeferExecution(),
		RequireSpecApproval: req.Msg.GetRequireSpecApproval(),
	}, claims.Sub, corrID)
	if svcErr != nil {
		return nil, svcErr.toConnectError()
	}
	return connect.NewResponse(&cadencev1.CreateRunResponse{
		Run:                toProtoCadenceRunResult(res),
		CreatedImmediately: createdImmediately,
	}), nil
}

func (s *cadenceConnectServer) ListRuns(
	ctx context.Context,
	req *connect.Request[cadencev1.ListRunsRequest],
) (*connect.Response[cadencev1.ListRunsResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)

	candidate := strings.TrimSpace(req.Msg.GetSessionId())
	if candidate == "" {
		candidate = strings.TrimSpace(claims.Sub)
	}
	runs, quota, svcErr := executeListRuns(ctx, s.deps, claims, candidate, true, int(req.Msg.GetLimit()), corrID)
	if svcErr != nil {
		return nil, svcErr.toConnectError()
	}

	protoRuns := make([]*cadencev1.CadenceRunResult, 0, len(runs))
	for i := range runs {
		contractRun := pg.SandboxRunToContractResult(&runs[i], nil, nil, "")
		protoRuns = append(protoRuns, toProtoCadenceRunResult(contractRun))
	}

	goldenRuns, gErr := s.deps.store.ListGoldenSandboxRuns(ctx)
	if gErr != nil {
		return nil, newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to list golden showcase runs", "Retry or share the reference ID.", corrID, nil).toConnectError()
	}
	protoGolden := make([]*cadencev1.CadenceRunResult, 0, len(goldenRuns))
	for i := range goldenRuns {
		contractRun := pg.SandboxRunToContractResult(&goldenRuns[i], nil, nil, "")
		protoGolden = append(protoGolden, toProtoCadenceRunResult(contractRun))
	}

	return connect.NewResponse(&cadencev1.ListRunsResponse{
		Runs:       protoRuns,
		Quota:      grpckit.ToProtoQuota(&quota),
		GoldenRuns: protoGolden,
	}), nil
}

func (s *cadenceConnectServer) ClearSessionRuns(
	ctx context.Context,
	_ *connect.Request[cadencev1.ClearSessionRunsRequest],
) (*connect.Response[cadencev1.ClearSessionRunsResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)
	sessionID := strings.TrimSpace(claims.Sub)
	if sessionID == "" {
		return nil, newCadenceError(http.StatusUnauthorized, connect.CodeUnauthenticated,
			contracts.ErrCodeUnauthorized, "missing session principal", "Refresh your session and retry.", corrID, nil).toConnectError()
	}

	deleted, err := s.deps.store.ClearSandboxRunsForSession(ctx, sessionID)
	if err != nil {
		return nil, newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to reset session runs", "Retry or share the reference ID.", corrID, nil).toConnectError()
	}
	return connect.NewResponse(&cadencev1.ClearSessionRunsResponse{
		DeletedCount: int32(deleted),
	}), nil
}

func (s *cadenceConnectServer) ApproveSpecGate(
	ctx context.Context,
	req *connect.Request[cadencev1.ApproveSpecGateRequest],
) (*connect.Response[cadencev1.ApproveSpecGateResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)

	_, contractRun, quota, svcErr := executeApproveSpecGate(ctx, s.deps, claims, req.Msg.GetRunId(), claims.Sub, corrID)
	if svcErr != nil {
		return nil, svcErr.toConnectError()
	}
	return connect.NewResponse(&cadencev1.ApproveSpecGateResponse{
		Run:   toProtoCadenceRunResult(contractRun),
		Quota: grpckit.ToProtoQuota(&quota),
	}), nil
}

func (s *cadenceConnectServer) SubmitGateVerdict(
	ctx context.Context,
	req *connect.Request[cadencev1.SubmitGateVerdictRequest],
) (*connect.Response[cadencev1.SubmitGateVerdictResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)

	_, contractRun, svcErr := executeSubmitGateVerdict(ctx, s.deps, claims, req.Msg.GetRunId(), claims.Sub, req.Msg.GetVerdict(), corrID)
	if svcErr != nil {
		return nil, svcErr.toConnectError()
	}
	return connect.NewResponse(&cadencev1.SubmitGateVerdictResponse{
		Run: toProtoCadenceRunResult(contractRun),
	}), nil
}

func (s *cadenceConnectServer) StreamRun(
	ctx context.Context,
	req *connect.Request[cadencev1.StreamRunRequest],
	stream *connect.ServerStream[cadencev1.StreamRunResponse],
) error {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveCadenceCorrID(ctx)

	runID := strings.TrimSpace(req.Msg.GetRunId())
	if !contracts.ValidateUUID(runID) {
		return newCadenceError(http.StatusBadRequest, connect.CodeInvalidArgument,
			contracts.ErrCodeValidation, "invalid run id", "Verify the run ID and retry.", corrID, nil).toConnectError()
	}
	sessionID := strings.TrimSpace(claims.Sub)
	if sessionID == "" {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
			"runId":         runID,
			"reason":        "missing_session",
			"correlationId": corrID,
		})
		return newCadenceError(http.StatusUnauthorized, connect.CodeUnauthenticated,
			contracts.ErrCodeUnauthorized, "missing session principal", "Refresh your session and retry.", corrID, nil).toConnectError()
	}

	run, err := s.deps.store.GetSandboxRun(ctx, runID)
	if err != nil {
		if errors.Is(err, pg.ErrRunNotFound) {
			return newCadenceError(http.StatusNotFound, connect.CodeNotFound,
				contracts.ErrCodeNotFound, "sandbox run not found", "Start a new run or refresh.", corrID, nil).toConnectError()
		}
		return newCadenceError(http.StatusInternalServerError, connect.CodeInternal,
			contracts.ErrCodeInternal, "failed to load sandbox run", "Retry or share the reference ID.", corrID, nil).toConnectError()
	}

	if run.SessionID != sessionID {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
			"runId":         runID,
			"reason":        "session_mismatch",
			"correlationId": corrID,
		})
		return newCadenceError(http.StatusForbidden, connect.CodePermissionDenied,
			contracts.ErrCodeForbidden, "sandbox run belongs to a different session", "Return home or start your own run.", corrID, nil).toConnectError()
	}

	role := claimsRoleOrGuest(claims)
	stream.ResponseHeader().Set(grpckit.MetadataCorrelationID, corrID)

	emitter := &connectCadenceEmitter{stream: stream}
	// ConnectRPC v1 flushes HTTP/2 HEADERS on first stream.Send; emit an immediate initial log frame
	// before pollActiveRun or slow LLM stages so caller header-only timers clear without timing out.
	initialLine := "[stream] Connected to CHORD pipeline..."
	if run.Status == contracts.CadenceStatusRunning || run.Status == contracts.CadenceStatusBuilding {
		initialLine = "[stream] Reattached to active CHORD run..."
	}
	if sendErr := emitter.EmitLog(contracts.CadenceStreamLogEvent{
		RunID:     runID,
		Line:      initialLine,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}); sendErr != nil {
		return sendErr
	}

	executeCadenceRunStream(ctx, s.deps, run, role, sessionID, corrID, emitter)
	return nil
}
