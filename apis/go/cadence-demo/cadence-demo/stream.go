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
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

func buildReadyStatus() (contracts.Osc7501Status, string) {
	pct := 100
	st := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     "ready",
		Label:     "CHORD spec + sandbox artifact ready",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}
	return st, k8sevents.FormatOSC7501(st)
}

func resolveAuthorizedSession(w http.ResponseWriter, r *http.Request, claims *internalauth.Claims, candidate string, requireCandidate bool) (string, bool) {
	trimmed := strings.TrimSpace(candidate)
	if claims != nil && claims.Role == internalauth.RoleAdmin {
		if trimmed == "" {
			trimmed = strings.TrimSpace(claims.Sub)
		}
		return trimmed, true
	}
	claimSub := ""
	if claims != nil {
		claimSub = strings.TrimSpace(claims.Sub)
	}
	if requireCandidate && trimmed == "" {
		httpkit.WriteError(w, http.StatusBadRequest, "sessionId is required")
		return "", false
	}
	if claimSub != "" && trimmed != "" && trimmed != claimSub {
		logCadenceSeam("UNSOUND_CONDITION", "cadence.auth.session_claim_mismatch", "critical", map[string]any{
			"path": r.URL.Path,
		})
		httpkit.WriteError(w, http.StatusForbidden, "session id does not match authenticated principal")
		return "", false
	}
	if claimSub != "" {
		return claimSub, true
	}
	if trimmed != "" {
		return trimmed, true
	}
	return "", true
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

		headerSession := strings.TrimSpace(r.Header.Get("X-Session-Id"))
		if headerSession == "" && (claims == nil || strings.TrimSpace(claims.Sub) == "") {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
				"runId":  runID,
				"reason": "missing_session",
			})
			httpkit.WriteError(w, http.StatusUnauthorized, "missing X-Session-Id header")
			return
		}
		sessionID, authOK := resolveAuthorizedSession(w, r, claims, headerSession, false)
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

		role := contracts.RoleGuest
		if claims.Role == internalauth.RoleAdmin {
			role = contracts.RoleAdmin
		}
		corrID := strings.TrimSpace(r.Header.Get("X-Correlation-Id"))

		sse := httpkit.NewSSEWriter(w)
		stopHeartbeat := sse.StartHeartbeat(r.Context(), httpkit.DefaultSSEHeartbeatInterval)
		defer stopHeartbeat()

		// Case 1: Already ready -> replay persisted turns and complete cleanly without re-running or charging quota.
		if run.Status == contracts.CadenceStatusReady {
			logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
				"branch": "stream-replay",
				"runId":  runID,
			})
			replayRun(sse, r, deps.store, role, sessionID, run)
			return
		}

		if run.Status == contracts.CadenceStatusFailed {
			_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "sandbox run failed before artifact completion",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}

		// Case 2: Attempt atomic pending -> running claim.
		claimed, claimedOK, claimErr := deps.store.ClaimPendingSandboxRun(r.Context(), runID, sessionID)
		if claimErr != nil {
			_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
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
			pollActiveRun(sse, r, deps.store, role, sessionID, runID)
			return
		}

		mode := pg.ExtractModeFromTurns(claimed.Turns)
		if mode == "" {
			mode = contracts.CadenceModeFast
		}
		presetSlug := pg.ExtractPresetSlugFromTurns(claimed.Turns, claimed.MenuSlug)

		logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
			"branch": mode + "-go",
			"runId":  runID,
		})

		// Live llm cancels immediately on client disconnect and refunds quota; fast detaches for reload continuity.
		var (
			workCtx    context.Context
			workCancel context.CancelFunc
		)
		if mode == contracts.CadenceModeLLM {
			workCtx, workCancel = context.WithTimeout(r.Context(), 90*time.Second)
		} else {
			workCtx, workCancel = context.WithTimeout(context.WithoutCancel(r.Context()), 15*time.Second)
		}
		defer workCancel()

		out, execErr := executeChordStepsWithOptions(workCtx, chordExecInput{
			Provider:    deps.provider,
			VectorStore: deps.vectorStore,
			Store:       deps.store,
			PrivacyCfg:  deps.privacyCfg,
			CorrID:      corrID,
			RunID:       runID,
			Prompt:      claimed.Prompt,
			PresetSlug:  presetSlug,
			Mode:        mode,
			OnPhase: func(turn contracts.CadenceTurn, runStatus string, progress int, spec *contracts.CadenceSpecArtifact) {
				if r.Context().Err() != nil {
					return
				}
				st := contracts.Osc7501Status{
					Source:    "cadence-demo",
					State:     runStatus,
					Label:     "CHORD " + turn.Phase + " · " + turn.Status,
					Progress:  &progress,
					Timestamp: time.Now().UTC(),
				}
				_ = sse.WriteEvent("phase", contracts.CadenceStreamPhaseEvent{
					RunID:     runID,
					RunStatus: runStatus,
					Status:    &st,
					Progress:  progress,
					Turn:      turn,
					Spec:      spec,
				})
			},
			OnLog: func(line string) {
				if r.Context().Err() != nil {
					return
				}
				_ = sse.WriteEvent("log", contracts.CadenceStreamLogEvent{
					RunID:     runID,
					Line:      line,
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				})
			},
		})
		if execErr != nil {
			failCtx, failCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
			defer failCancel()

			if errors.Is(execErr, context.Canceled) && mode == contracts.CadenceModeLLM {
				refunded, _ := deps.store.RefundSandboxRunQuotaTx(failCtx, runID)
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
			if r.Context().Err() == nil {
				_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
					RunID:     runID,
					Error:     safeFailureSummary,
					Code:      code,
					RunStatus: contracts.CadenceStatusFailed,
				})
			}
			return
		}

		commitCtx, commitCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 5*time.Second)
		defer commitCancel()
		completed, compErr := deps.store.CompleteSandboxRunWithArtifacts(commitCtx, pg.CompleteSandboxRunInput{
			RunID:         runID,
			TokensIn:      out.TokensIn,
			TokensOut:     out.TokensOut,
			ArtifactHTML:  out.ArtifactHTML,
			ExecutionMode: out.ExecutionMode,
			SpecJSON:      out.Spec,
			GateAuditJSON: out.GateAudit,
			PromptHash:    claimed.PromptHash,
		})
		if compErr != nil {
			_ = deps.store.FailSandboxRun(commitCtx, runID, "CHORD execution failed before completion")
			if r.Context().Err() == nil {
				_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
					RunID:     runID,
					Error:     "failed to commit completed run",
					Code:      "ERR_CADENCE_COMMIT",
					RunStatus: contracts.CadenceStatusFailed,
				})
			}
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

		if r.Context().Err() == nil {
			quota, _ := deps.store.GetQuotaStatus(commitCtx, role, sessionID)
			result := pg.SandboxRunToContractResult(completed, &quota, &out.Status, out.OSC7501)
			_ = sse.WriteEvent("complete", contracts.CadenceStreamCompleteEvent{
				Run:   result,
				Quota: &quota,
			})
		}
	}
}

func replayRun(sse *httpkit.SSEWriter, r *http.Request, store *pg.Store, role, sessionID string, run *pg.SandboxRun) {
	for idx, turn := range run.Turns {
		if r.Context().Err() != nil {
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
		_ = sse.WriteEvent("phase", contracts.CadenceStreamPhaseEvent{
			RunID:     run.RunID,
			RunStatus: run.Status,
			Progress:  progress,
			Turn:      turn,
			Spec:      phaseSpec,
		})
	}
	if r.Context().Err() != nil {
		return
	}
	quota, _ := store.GetQuotaStatus(r.Context(), role, sessionID)
	readyStatus, osc := buildReadyStatus()
	result := pg.SandboxRunToContractResult(run, &quota, &readyStatus, osc)
	_ = sse.WriteEvent("complete", contracts.CadenceStreamCompleteEvent{
		Run:   result,
		Quota: &quota,
	})
}

func pollActiveRun(sse *httpkit.SSEWriter, r *http.Request, store *pg.Store, role, sessionID, runID string) {
	ticker := time.NewTicker(40 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(75 * time.Second)
	defer deadline.Stop()

	for {
		if r.Context().Err() != nil {
			return
		}
		latest, err := store.GetSandboxRun(r.Context(), runID)
		if err != nil {
			if r.Context().Err() != nil {
				return
			}
			_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "failed reading active run",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}
		if latest.Status == contracts.CadenceStatusReady {
			replayRun(sse, r, store, role, sessionID, latest)
			return
		}
		if latest.Status == contracts.CadenceStatusFailed {
			_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "sandbox run failed",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}

		select {
		case <-r.Context().Done():
			return
		case <-deadline.C:
			_ = sse.WriteEvent("error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "timed out waiting for active stream completion",
				RunStatus: contracts.CadenceStatusRunning,
			})
			return
		case <-ticker.C:
		}
	}
}
