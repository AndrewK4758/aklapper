package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

type cadenceStreamEmitter interface {
	EmitPhase(ev contracts.CadenceStreamPhaseEvent) error
	EmitLog(ev contracts.CadenceStreamLogEvent) error
	EmitComplete(ev contracts.CadenceStreamCompleteEvent) error
	EmitError(ev contracts.CadenceStreamErrorEvent) error
}

type sseCadenceEmitter struct {
	sse *httpkit.SSEWriter
}

func (e *sseCadenceEmitter) EmitPhase(ev contracts.CadenceStreamPhaseEvent) error {
	return e.sse.WriteEvent("phase", ev)
}

func (e *sseCadenceEmitter) EmitLog(ev contracts.CadenceStreamLogEvent) error {
	return e.sse.WriteEvent("log", ev)
}

func (e *sseCadenceEmitter) EmitComplete(ev contracts.CadenceStreamCompleteEvent) error {
	return e.sse.WriteEvent("complete", ev)
}

func (e *sseCadenceEmitter) EmitError(ev contracts.CadenceStreamErrorEvent) error {
	return e.sse.WriteEvent("error", ev)
}

func buildReadyStatus() (contracts.Osc7501Status, string) {
	pct := 100
	st := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     "ready",
		Label:     "CHORD spec + sandbox artifact ready",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}
	return st, contracts.FormatOSC7501(st)
}

func resolveAuthorizedSession(w http.ResponseWriter, r *http.Request, claims *internalauth.Claims, candidate string, requireCandidate bool) (string, bool) {
	corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))
	sessionID, svcErr := resolveAuthorizedSessionClaims(claims, candidate, requireCandidate, r.URL.Path, corrID)
	if svcErr != nil {
		httpkit.WriteError(w, svcErr.HTTPStatus, svcErr.Error.Message)
		return "", false
	}
	return sessionID, true
}

func requireAuthorizedRunSession(
	w http.ResponseWriter,
	r *http.Request,
	claims *internalauth.Claims,
	runID string,
) (string, bool) {
	headerSession := strings.TrimSpace(r.Header.Get("X-Session-Id"))
	if headerSession == "" && (claims == nil || strings.TrimSpace(claims.Sub) == "") {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
			"runId":  runID,
			"reason": "missing_session",
		})
		httpkit.WriteError(w, http.StatusUnauthorized, "missing X-Session-Id header")
		return "", false
	}
	return resolveAuthorizedSession(w, r, claims, headerSession, false)
}

func commitCompletedSandboxRun(
	commitCtx context.Context,
	reqCtx context.Context,
	emit cadenceStreamEmitter,
	store *pg.Store,
	input pg.CompleteSandboxRunInput,
) (*pg.SandboxRun, bool) {
	completed, compErr := store.CompleteSandboxRunWithArtifacts(commitCtx, input)
	if compErr != nil {
		_ = store.FailSandboxRun(commitCtx, input.RunID, "CHORD execution failed before completion")
		if reqCtx.Err() == nil {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     input.RunID,
				Error:     "failed to commit completed run",
				Code:      "ERR_CADENCE_COMMIT",
				RunStatus: contracts.CadenceStatusFailed,
			})
		}
		return nil, false
	}
	return completed, true
}

func makeStreamCallbacks(
	reqCtx context.Context,
	emit cadenceStreamEmitter,
	runID string,
	fixedRunStatus string,
) (func(contracts.CadenceTurn, string, int, *contracts.CadenceSpecArtifact), func(string)) {
	onPhase := func(turn contracts.CadenceTurn, runStatus string, progress int, spec *contracts.CadenceSpecArtifact) {
		if reqCtx.Err() != nil {
			return
		}
		st := contracts.Osc7501Status{
			Source:    "cadence-demo",
			State:     runStatus,
			Label:     "CHORD " + turn.Phase + " · " + turn.Status,
			Progress:  &progress,
			Timestamp: time.Now().UTC(),
		}
		effectiveStatus := runStatus
		if fixedRunStatus != "" {
			effectiveStatus = fixedRunStatus
		}
		_ = emit.EmitPhase(contracts.CadenceStreamPhaseEvent{
			RunID:     runID,
			RunStatus: effectiveStatus,
			Status:    &st,
			Progress:  progress,
			Turn:      turn,
			Spec:      spec,
		})
	}
	onLog := func(line string) {
		if reqCtx.Err() != nil {
			return
		}
		_ = emit.EmitLog(contracts.CadenceStreamLogEvent{
			RunID:     runID,
			Line:      line,
			Timestamp: time.Now().UTC().Format(time.RFC3339),
		})
	}
	return onPhase, onLog
}

func handleRunStream(deps cadenceServiceDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, ok := httpkit.RequireInternalAuth(w, r)
		if !ok {
			return
		}

		runID := strings.TrimSpace(r.PathValue("id"))
		if !contracts.ValidateUUID(runID) {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid run id")
			return
		}

		sessionID, authOK := requireAuthorizedRunSession(w, r, claims, runID)
		if !authOK {
			return
		}

		run, err := deps.store.GetSandboxRun(r.Context(), runID)
		if err != nil {
			if errors.Is(err, pg.ErrRunNotFound) {
				httpkit.WriteError(w, http.StatusNotFound, "sandbox run not found")
				return
			}
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to load sandbox run")
			return
		}

		if run.SessionID != sessionID {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
				"runId":  runID,
				"reason": "session_mismatch",
			})
			httpkit.WriteError(w, http.StatusForbidden, "sandbox run belongs to a different session")
			return
		}

		role := claimsRoleOrGuest(claims)
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))

		sse := httpkit.NewSSEWriter(w)
		stopHeartbeat := sse.StartHeartbeat(r.Context(), httpkit.DefaultSSEHeartbeatInterval)
		defer stopHeartbeat()

		executeCadenceRunStream(r.Context(), deps, run, role, sessionID, corrID, &sseCadenceEmitter{sse: sse})
	}
}

func executeCadenceRunStream(
	ctx context.Context,
	deps cadenceServiceDeps,
	run *pg.SandboxRun,
	role, sessionID, corrID string,
	emit cadenceStreamEmitter,
) {
	runID := run.RunID
	if run.Status == contracts.CadenceStatusReady || run.Status == contracts.CadenceStatusAwaitingApproval {
		logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
			"branch": "stream-replay",
			"runId":  runID,
			"status": run.Status,
		})
		replayRun(ctx, emit, deps.store, role, sessionID, run)
		return
	}

	if run.Status == contracts.CadenceStatusFailed {
		_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
			RunID:     runID,
			Error:     "sandbox run failed before artifact completion",
			RunStatus: contracts.CadenceStatusFailed,
		})
		return
	}

	if run.Status == contracts.CadenceStatusBuildQueued {
		executeBuildQueuedStream(ctx, deps, runID, role, sessionID, corrID, emit)
		return
	}

	executePendingRunStream(ctx, deps, run, role, sessionID, corrID, emit)
}

func executeBuildQueuedStream(
	ctx context.Context,
	deps cadenceServiceDeps,
	runID, role, sessionID, corrID string,
	emit cadenceStreamEmitter,
) {
	claimedBuild, buildClaimedOK, claimBuildErr := deps.store.ClaimBuildQueuedSandboxRun(ctx, runID, sessionID)
	if claimBuildErr != nil {
		_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
			RunID:     runID,
			Error:     "failed to claim approved build run",
			RunStatus: contracts.CadenceStatusFailed,
		})
		return
	}
	if !buildClaimedOK || claimedBuild == nil {
		pollActiveRun(ctx, emit, deps.store, role, sessionID, runID)
		return
	}

	mode := pg.ExtractModeFromTurns(claimedBuild.Turns)
	if mode == "" {
		mode = contracts.CadenceModeFast
	}
	presetSlug := pg.ExtractPresetSlugFromTurns(claimedBuild.Turns, claimedBuild.MenuSlug)

	var (
		workCtx    context.Context
		workCancel context.CancelFunc
	)
	if mode == contracts.CadenceModeLLM {
		workCtx, workCancel = context.WithTimeout(ctx, 120*time.Second)
	} else {
		workCtx, workCancel = context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	}
	defer workCancel()

	var recalledPatterns []string
	if claimedBuild.SpecJSON != nil {
		recalledPatterns = claimedBuild.SpecJSON.RecalledPatterns
	}
	onPhase, onLog := makeStreamCallbacks(ctx, emit, runID, contracts.CadenceStatusBuilding)

	out, execErr := executeChordBuildPhase(workCtx, chordExecInput{
		Provider:    deps.provider,
		VectorStore: deps.vectorStore,
		Store:       deps.store,
		PrivacyCfg:  deps.privacyCfg,
		CorrID:      corrID,
		RunID:       runID,
		Prompt:      claimedBuild.Prompt,
		PresetSlug:  presetSlug,
		Mode:        mode,
		OnPhase:     onPhase,
		OnLog:       onLog,
	}, claimedBuild.SpecJSON, recalledPatterns, claimedBuild.TokensOut, nil)
	if execErr != nil {
		failCtx, failCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer failCancel()
		if (errors.Is(execErr, context.Canceled) || errors.Is(ctx.Err(), context.Canceled)) && mode == contracts.CadenceModeLLM {
			_ = deps.store.FailSandboxRun(failCtx, runID, "CHORD build cancelled by client")
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.cancellation_reconciled", "info", map[string]any{
				"phase":         "build",
				"runId":         runID,
				"refunded":      false,
				"correlationId": corrID,
			})
			return
		}
		code := "ERR_CADENCE_STREAM"
		safeFailureSummary := "CHORD build failed before completion"
		if errors.Is(execErr, privacy.ErrPrivacyAborted) {
			code = contracts.ErrCodeForbidden
			safeFailureSummary = "Generated output blocked by privacy policy."
		}
		_ = deps.store.FailSandboxRun(failCtx, runID, safeFailureSummary)
		if ctx.Err() == nil {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     safeFailureSummary,
				Code:      code,
				RunStatus: contracts.CadenceStatusFailed,
			})
		}
		return
	}

	commitCtx, commitCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer commitCancel()
	completed, committed := commitCompletedSandboxRun(commitCtx, ctx, emit, deps.store, pg.CompleteSandboxRunInput{
		RunID:         runID,
		TokensIn:      out.TokensIn,
		TokensOut:     out.TokensOut,
		ArtifactHTML:  out.ArtifactHTML,
		ExecutionMode: out.ExecutionMode,
		SpecJSON:      out.Spec,
		GateAuditJSON: out.GateAudit,
		PromptHash:    claimedBuild.PromptHash,
	})
	if !committed {
		return
	}

	if ctx.Err() == nil {
		quota, _ := deps.store.GetQuotaStatus(commitCtx, role, sessionID)
		result := pg.SandboxRunToContractResult(completed, &quota, &out.Status, out.OSC7501)
		_ = emit.EmitComplete(contracts.CadenceStreamCompleteEvent{
			Run:   result,
			Quota: &quota,
		})
	}
}

func executePendingRunStream(
	ctx context.Context,
	deps cadenceServiceDeps,
	run *pg.SandboxRun,
	role, sessionID, corrID string,
	emit cadenceStreamEmitter,
) {
	runID := run.RunID
	claimed, claimedOK, claimErr := deps.store.ClaimPendingSandboxRun(ctx, runID, sessionID)
	if claimErr != nil {
		_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
			RunID:     runID,
			Error:     "failed to claim sandbox run",
			RunStatus: contracts.CadenceStatusFailed,
		})
		return
	}
	if !claimedOK || claimed == nil {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.run.invalid_claim_state", "warn", map[string]any{
			"runId":  runID,
			"status": run.Status,
		})
		pollActiveRun(ctx, emit, deps.store, role, sessionID, runID)
		return
	}

	mode := pg.ExtractModeFromTurns(claimed.Turns)
	if mode == "" {
		mode = contracts.CadenceModeFast
	}
	presetSlug := pg.ExtractPresetSlugFromTurns(claimed.Turns, claimed.MenuSlug)
	requireSpecApproval := pg.ExtractRequireSpecApprovalFromTurns(claimed.Turns)

	logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
		"branch":              mode + "-go",
		"runId":               runID,
		"requireSpecApproval": requireSpecApproval,
	})

	var (
		workCtx    context.Context
		workCancel context.CancelFunc
	)
	if mode == contracts.CadenceModeLLM {
		workCtx, workCancel = context.WithTimeout(ctx, 180*time.Second)
	} else {
		workCtx, workCancel = context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
	}
	defer workCancel()

	onPhase, onLog := makeStreamCallbacks(ctx, emit, runID, "")
	execInput := chordExecInput{
		Provider:    deps.provider,
		VectorStore: deps.vectorStore,
		Store:       deps.store,
		PrivacyCfg:  deps.privacyCfg,
		CorrID:      corrID,
		RunID:       runID,
		Prompt:      claimed.Prompt,
		PresetSlug:  presetSlug,
		Mode:        mode,
		OnPhase:     onPhase,
		OnLog:       onLog,
	}

	if requireSpecApproval {
		executeSpecApprovalStream(ctx, workCtx, deps, claimed, role, sessionID, corrID, mode, execInput, emit)
		return
	}

	out, execErr := executeChordStepsWithOptions(workCtx, execInput)
	if execErr != nil {
		failCtx, failCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer failCancel()
		if (errors.Is(execErr, context.Canceled) || errors.Is(ctx.Err(), context.Canceled)) && mode == contracts.CadenceModeLLM {
			refunded, _ := deps.store.RefundSandboxRunQuotaTx(failCtx, runID)
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.cancellation_reconciled", "info", map[string]any{
				"phase":         "full",
				"runId":         runID,
				"refunded":      refunded,
				"correlationId": corrID,
			})
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.audit", "info", map[string]any{
				"deltaStatus":   "refunded",
				"runId":         runID,
				"refunded":      refunded,
				"executionMode": contracts.CadenceExecutionModeLive,
				"isGolden":      false,
				"tokensIn":      0,
				"tokensOut":     0,
				"correlationId": corrID,
			})
			return
		}

		code := "ERR_CADENCE_STREAM"
		deltaStatus := "failed"
		safeFailureSummary := "CHORD execution failed before completion"
		if errors.Is(execErr, privacy.ErrPrivacyAborted) {
			code = contracts.ErrCodeForbidden
			deltaStatus = "privacy_aborted"
			safeFailureSummary = "Generated output blocked by privacy policy."
		}
		_ = deps.store.FailSandboxRun(failCtx, runID, safeFailureSummary)
		logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.audit", "critical", map[string]any{
			"deltaStatus":   deltaStatus,
			"runId":         runID,
			"executionMode": mode,
			"isGolden":      false,
			"tokensIn":      0,
			"tokensOut":     0,
			"correlationId": corrID,
		})
		if ctx.Err() == nil {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     safeFailureSummary,
				Code:      code,
				RunStatus: contracts.CadenceStatusFailed,
			})
		}
		return
	}

	commitCtx, commitCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer commitCancel()
	completed, committed := commitCompletedSandboxRun(commitCtx, ctx, emit, deps.store, pg.CompleteSandboxRunInput{
		RunID:         runID,
		TokensIn:      out.TokensIn,
		TokensOut:     out.TokensOut,
		ArtifactHTML:  out.ArtifactHTML,
		ExecutionMode: out.ExecutionMode,
		SpecJSON:      out.Spec,
		GateAuditJSON: out.GateAudit,
		PromptHash:    claimed.PromptHash,
	})
	if !committed {
		return
	}

	logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.audit", "info", map[string]any{
		"deltaStatus":   out.ExecutionMode,
		"runId":         completed.RunID,
		"executionMode": out.ExecutionMode,
		"isGolden":      false,
		"tokensIn":      completed.TokensIn,
		"tokensOut":     completed.TokensOut,
		"correlationId": corrID,
	})

	if ctx.Err() == nil {
		quota, _ := deps.store.GetQuotaStatus(commitCtx, role, sessionID)
		result := pg.SandboxRunToContractResult(completed, &quota, &out.Status, out.OSC7501)
		_ = emit.EmitComplete(contracts.CadenceStreamCompleteEvent{
			Run:   result,
			Quota: &quota,
		})
	}
}

func executeSpecApprovalStream(
	ctx, workCtx context.Context,
	deps cadenceServiceDeps,
	claimed *pg.SandboxRun,
	role, sessionID, corrID, mode string,
	execInput chordExecInput,
	emit cadenceStreamEmitter,
) {
	runID := claimed.RunID
	specOut, specErr := executeChordSpecPhase(workCtx, execInput)
	if specErr != nil {
		failCtx, failCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer failCancel()
		if (errors.Is(specErr, context.Canceled) || errors.Is(ctx.Err(), context.Canceled)) && mode == contracts.CadenceModeLLM {
			refunded, _ := deps.store.RefundSandboxRunQuotaTx(failCtx, runID)
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.cancellation_reconciled", "info", map[string]any{
				"phase":         "spec",
				"runId":         runID,
				"refunded":      refunded,
				"correlationId": corrID,
			})
			return
		}
		code := "ERR_CADENCE_STREAM"
		safeFailureSummary := "CHORD spec stage failed before completion"
		if errors.Is(specErr, privacy.ErrPrivacyAborted) {
			code = contracts.ErrCodeForbidden
			safeFailureSummary = "Generated specification blocked by privacy policy."
		}
		_ = deps.store.FailSandboxRun(failCtx, runID, safeFailureSummary)
		if ctx.Err() == nil {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     safeFailureSummary,
				Code:      code,
				RunStatus: contracts.CadenceStatusFailed,
			})
		}
		return
	}

	commitCtx, commitCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer commitCancel()
	paused, pauseErr := deps.store.PauseSandboxRunForSpecApproval(commitCtx, pg.PauseSpecApprovalInput{
		RunID:         runID,
		TokensIn:      specOut.TokensIn,
		TokensOut:     specOut.SpecTokens,
		ExecutionMode: specOut.ExecutionMode,
		SpecJSON:      specOut.Spec,
		PromptHash:    claimed.PromptHash,
	})
	if pauseErr != nil {
		_ = deps.store.FailSandboxRun(commitCtx, runID, "failed to persist spec gate state")
		if ctx.Err() == nil {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "failed to persist spec gate state",
				Code:      "ERR_CADENCE_COMMIT",
				RunStatus: contracts.CadenceStatusFailed,
			})
		}
		return
	}

	if ctx.Err() == nil {
		quota, _ := deps.store.GetQuotaStatus(commitCtx, role, sessionID)
		result := pg.SandboxRunToContractResult(paused, &quota, &specOut.Status, specOut.OSC7501)
		_ = emit.EmitComplete(contracts.CadenceStreamCompleteEvent{
			Run:   result,
			Quota: &quota,
		})
	}
}

func replayRun(ctx context.Context, emit cadenceStreamEmitter, store *pg.Store, role, sessionID string, run *pg.SandboxRun) {
	for idx, turn := range run.Turns {
		if ctx.Err() != nil {
			return
		}
		progress := (idx + 1) * 25
		if progress > 100 {
			progress = 100
		}
		var phaseSpec *contracts.CadenceSpecArtifact
		if turn.Phase == "spec" {
			phaseSpec = run.SpecJSON
		}
		_ = emit.EmitPhase(contracts.CadenceStreamPhaseEvent{
			RunID:     run.RunID,
			RunStatus: run.Status,
			Progress:  progress,
			Turn:      turn,
			Spec:      phaseSpec,
		})
	}
	if ctx.Err() != nil {
		return
	}
	quota, _ := store.GetQuotaStatus(ctx, role, sessionID)
	readyStatus, osc := buildReadyStatus()
	result := pg.SandboxRunToContractResult(run, &quota, &readyStatus, osc)
	_ = emit.EmitComplete(contracts.CadenceStreamCompleteEvent{
		Run:   result,
		Quota: &quota,
	})
}

func pollActiveRun(ctx context.Context, emit cadenceStreamEmitter, store *pg.Store, role, sessionID, runID string) {
	ticker := time.NewTicker(40 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(185 * time.Second)
	defer deadline.Stop()

	for {
		if ctx.Err() != nil {
			return
		}
		latest, err := store.GetSandboxRun(ctx, runID)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "failed reading active run",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}
		if latest.Status == contracts.CadenceStatusReady || latest.Status == contracts.CadenceStatusAwaitingApproval {
			replayRun(ctx, emit, store, role, sessionID, latest)
			return
		}
		if latest.Status == contracts.CadenceStatusFailed {
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "sandbox run failed",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}

		select {
		case <-ctx.Done():
			return
		case <-deadline.C:
			_ = emit.EmitError(contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "timed out waiting for active stream completion",
				RunStatus: contracts.CadenceStatusRunning,
			})
			return
		case <-ticker.C:
		}
	}
}
