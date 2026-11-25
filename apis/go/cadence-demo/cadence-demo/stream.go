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
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func setSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	}
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
	return st, k8sevents.FormatOSC7501(st)
}

func handleRunStream(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
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

		sessionID := strings.TrimSpace(r.Header.Get("X-Session-Id"))
		if sessionID == "" {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.stream.session_mismatch_or_missing", "critical", map[string]any{
				"runId":  runID,
				"reason": "missing_session",
			})
			httpkit.WriteError(w, http.StatusUnauthorized, "missing X-Session-Id header")
			return
		}

		run, err := store.GetSandboxRun(r.Context(), runID)
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

		setSSEHeaders(w)

		// Case 1: Already ready -> replay persisted turns and complete cleanly without re-running or charging quota.
		if run.Status == contracts.CadenceStatusReady {
			logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
				"branch": "stream-replay",
				"runId":  runID,
			})
			replayRun(w, r, store, role, sessionID, run)
			return
		}

		if run.Status == contracts.CadenceStatusFailed {
			_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "sandbox run failed before artifact completion",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}

		// Case 2: Attempt atomic pending -> running claim.
		claimed, ok, claimErr := store.ClaimPendingSandboxRun(r.Context(), runID, sessionID)
		if claimErr != nil {
			_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "failed to claim sandbox run",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}
		if !ok || claimed == nil {
			logCadenceSeam("UNSOUND_CONDITION", "cadence.run.invalid_claim_state", "warn", map[string]any{
				"runId":  runID,
				"status": run.Status,
			})
			pollActiveRun(w, r, store, role, sessionID, runID)
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

		// Detach DB lifecycle commits from HTTP client cancel so reloads see durable terminal state.
		workTimeout := 15 * time.Second
		if mode == contracts.CadenceModeLLM {
			workTimeout = 45 * time.Second
		}
		workCtx, workCancel := context.WithTimeout(context.WithoutCancel(r.Context()), workTimeout)
		defer workCancel()

		out, execErr := executeChordSteps(
			workCtx,
			provider,
			vectorStore,
			store,
			runID,
			claimed.Prompt,
			presetSlug,
			mode,
			func(turn contracts.CadenceTurn, runStatus string, progress int) {
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
				_ = httpkit.WriteSSEEvent(w, "phase", contracts.CadenceStreamPhaseEvent{
					RunID:     runID,
					RunStatus: runStatus,
					Status:    &st,
					Progress:  progress,
					Turn:      turn,
				})
			},
		)
		if execErr != nil {
			const safeFailureSummary = "CHORD execution failed before completion"
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.execution_failed", "critical", map[string]any{
				"runId": runID,
				"error": execErr.Error(),
			})
			failCtx, failCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 3*time.Second)
			if failErr := store.FailSandboxRun(failCtx, runID, safeFailureSummary); failErr != nil {
				logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.terminal_commit_gap", "critical", map[string]any{
					"runId": runID,
					"error": failErr.Error(),
				})
			}
			failCancel()
			if r.Context().Err() == nil {
				_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
					RunID:     runID,
					Error:     safeFailureSummary,
					Code:      "ERR_CADENCE_STREAM",
					RunStatus: contracts.CadenceStatusFailed,
				})
			}
			return
		}

		completed, compErr := store.CompleteSandboxRun(workCtx, runID, out.TokensIn, out.TokensOut, out.ArtifactHTML)
		if compErr != nil {
			const safeFailureSummary = "CHORD execution failed before completion"
			logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.terminal_commit_gap", "critical", map[string]any{
				"runId": runID,
				"error": compErr.Error(),
			})
			failCtx, failCancel := context.WithTimeout(context.WithoutCancel(r.Context()), 3*time.Second)
			if failErr := store.FailSandboxRun(failCtx, runID, safeFailureSummary); failErr != nil {
				logCadenceSeam("DELTA_AUDIT_GAP", "cadence.run.terminal_commit_gap", "critical", map[string]any{
					"runId": runID,
					"error": failErr.Error(),
				})
			}
			failCancel()
			if r.Context().Err() == nil {
				_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
					RunID:     runID,
					Error:     "failed to commit completed run",
					Code:      "ERR_CADENCE_COMMIT",
					RunStatus: contracts.CadenceStatusFailed,
				})
			}
			return
		}

		if r.Context().Err() == nil {
			quota, _ := store.GetQuotaStatus(workCtx, role, sessionID)
			result := pg.SandboxRunToContractResult(completed, &quota, &out.Status, out.OSC7501)
			_ = httpkit.WriteSSEEvent(w, "complete", contracts.CadenceStreamCompleteEvent{
				Run:   result,
				Quota: &quota,
			})
		}
	}
}

func replayRun(w http.ResponseWriter, r *http.Request, store *pg.Store, role, sessionID string, run *pg.SandboxRun) {
	for idx, turn := range run.Turns {
		if r.Context().Err() != nil {
			return
		}
		progress := (idx + 1) * 25
		if progress > 100 {
			progress = 100
		}
		_ = httpkit.WriteSSEEvent(w, "phase", contracts.CadenceStreamPhaseEvent{
			RunID:     run.RunID,
			RunStatus: run.Status,
			Progress:  progress,
			Turn:      turn,
		})
	}
	if r.Context().Err() != nil {
		return
	}
	quota, _ := store.GetQuotaStatus(r.Context(), role, sessionID)
	readyStatus, osc := buildReadyStatus()
	result := pg.SandboxRunToContractResult(run, &quota, &readyStatus, osc)
	_ = httpkit.WriteSSEEvent(w, "complete", contracts.CadenceStreamCompleteEvent{
		Run:   result,
		Quota: &quota,
	})
}

func pollActiveRun(w http.ResponseWriter, r *http.Request, store *pg.Store, role, sessionID, runID string) {
	ticker := time.NewTicker(40 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.NewTimer(12 * time.Second)
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
			_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "failed reading active run",
				RunStatus: contracts.CadenceStatusFailed,
			})
			return
		}
		if latest.Status == contracts.CadenceStatusReady {
			replayRun(w, r, store, role, sessionID, latest)
			return
		}
		if latest.Status == contracts.CadenceStatusFailed {
			_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
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
			_ = httpkit.WriteSSEEvent(w, "error", contracts.CadenceStreamErrorEvent{
				RunID:     runID,
				Error:     "timed out waiting for active stream completion",
				RunStatus: contracts.CadenceStatusRunning,
			})
			return
		case <-ticker.C:
		}
	}
}
