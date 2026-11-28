package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

func executeCreateRun(
	ctx context.Context,
	deps cadenceServiceDeps,
	claims *internalauth.Claims,
	req contracts.CadenceRunRequest,
	candidateSession string,
	corrID string,
) (contracts.CadenceRunResult, bool, *cadenceServiceError) {
	if err := req.Validate(); err != nil {
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusBadRequest, connect.CodeInvalidArgument, contracts.ErrCodeValidation,
			err.Error(), "Review highlighted fields and retry.", corrID, nil)
	}

	role := claimsRoleOrGuest(claims)
	sessionID, authErr := resolveAuthorizedSessionClaims(claims, candidateSession, false, "/v1/cadence/runs", corrID)
	if authErr != nil {
		return contracts.CadenceRunResult{}, false, authErr
	}
	if sessionID == "" {
		sessionID = "anonymous"
	}

	presetSlug := strings.TrimSpace(req.PresetSlug)
	if presetSlug == "" {
		if req.DeferExecution {
			presetSlug = "custom"
		} else {
			presetSlug = "chord-decomposition-workbench"
		}
	}

	mode := strings.TrimSpace(req.Mode)
	if mode == "" {
		mode = contracts.CadenceModeLLM
	}

	var cacheRes cacheLookupResult
	if mode == contracts.CadenceModeFast && !req.RequireSpecApproval {
		var cacheErr error
		cacheRes, cacheErr = resolveCacheLookupAndClone(
			ctx, deps.store, sessionID, unifiedProxyIPHash, presetSlug, mode, strings.TrimSpace(req.Prompt),
		)
		if cacheErr == nil && cacheRes.Hit && cacheRes.ClonedRun != nil {
			quota, _ := deps.store.GetQuotaStatus(ctx, role, sessionID)
			readyStatus, osc := buildReadyStatus()
			return pg.SandboxRunToContractResult(cacheRes.ClonedRun, &quota, &readyStatus, osc), true, nil
		}
	} else {
		cacheRes.PromptHash = computePromptHash(presetSlug, "", mode, strings.TrimSpace(req.Prompt))
		logCadenceSeam("RULE_DIVERGENCE", "cadence.cache.lookup_outcome", "info", map[string]any{
			"branch":              "bypass_live_or_gated",
			"presetSlug":          nonEmptyOr(presetSlug, "custom"),
			"mode":                mode,
			"requireSpecApproval": req.RequireSpecApproval,
		})
	}

	if req.DeferExecution {
		return createDeferredRun(ctx, deps, role, sessionID, presetSlug, mode, req, cacheRes.PromptHash, corrID)
	}
	return createImmediateRun(ctx, deps, role, sessionID, presetSlug, mode, req, cacheRes.PromptHash, corrID)
}

func createDeferredRun(
	ctx context.Context,
	deps cadenceServiceDeps,
	role, sessionID, presetSlug, mode string,
	req contracts.CadenceRunRequest,
	promptHash, corrID string,
) (contracts.CadenceRunResult, bool, *cadenceServiceError) {
	pendingRun, quota, allowed, initErr := deps.store.CreatePendingSandboxRunWithQuota(
		ctx, role, sessionID, 1, 800,
		pg.PendingSandboxRunInput{
			SessionID:           sessionID,
			IPHash:              unifiedProxyIPHash,
			PresetSlug:          presetSlug,
			Prompt:              strings.TrimSpace(req.Prompt),
			Mode:                mode,
			PromptHash:          promptHash,
			RequireSpecApproval: req.RequireSpecApproval,
		},
	)
	if initErr != nil {
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusInternalServerError, connect.CodeInternal, contracts.ErrCodeInternal,
			"failed to initialize sandbox run", "Retry or share the reference ID.", corrID, nil)
	}
	if !allowed {
		quotaCopy := quota
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusTooManyRequests, connect.CodeResourceExhausted, contracts.ErrCodeRateLimited,
			"Session or daily CADENCE quota exceeded.", "Wait a moment and submit again.", corrID, &quotaCopy)
	}
	pct := 0
	queuedStatus := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     contracts.CadenceStatusRunning,
		Label:     "CHORD pipeline queued (" + mode + ")",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}
	res := pg.SandboxRunToContractResult(pendingRun, &quota, &queuedStatus, contracts.FormatOSC7501(queuedStatus))
	return res, false, nil
}

func createImmediateRun(
	ctx context.Context,
	deps cadenceServiceDeps,
	role, sessionID, presetSlug, mode string,
	req contracts.CadenceRunRequest,
	promptHash, corrID string,
) (contracts.CadenceRunResult, bool, *cadenceServiceError) {
	quota, allowed, quotaErr := deps.store.CheckAndConsumeQuota(ctx, role, sessionID, 1, 800)
	if quotaErr != nil {
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusInternalServerError, connect.CodeInternal, contracts.ErrCodeInternal,
			"failed to evaluate quota", "Retry or share the reference ID.", corrID, nil)
	}
	if !allowed {
		quotaCopy := quota
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusTooManyRequests, connect.CodeResourceExhausted, contracts.ErrCodeRateLimited,
			"Session or daily CADENCE quota exceeded.", "Wait a moment and submit again.", corrID, &quotaCopy)
	}

	logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_branch", "info", map[string]any{
		"branch": mode + "-go",
	})

	execOut, execErr := executeChordStepsWithOptions(ctx, chordExecInput{
		Provider:    deps.provider,
		VectorStore: deps.vectorStore,
		Store:       deps.store,
		PrivacyCfg:  deps.privacyCfg,
		CorrID:      corrID,
		Prompt:      req.Prompt,
		PresetSlug:  presetSlug,
		Mode:        mode,
	})
	if execErr != nil {
		if errors.Is(execErr, privacy.ErrPrivacyAborted) {
			return contracts.CadenceRunResult{}, false, newCadenceError(
				http.StatusForbidden, connect.CodePermissionDenied, contracts.ErrCodeForbidden,
				"output blocked by privacy boundary", "Adjust your prompt and retry.", corrID, nil)
		}
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusInternalServerError, connect.CodeInternal, contracts.ErrCodeInternal,
			"failed to execute sandbox run", "Retry or share the reference ID.", corrID, nil)
	}

	runID, err := deps.store.CreateSandboxRun(ctx, pg.SandboxRunInput{
		SessionID:     sessionID,
		IPHash:        unifiedProxyIPHash,
		MenuSlug:      presetSlug,
		Prompt:        req.Prompt,
		Status:        contracts.CadenceStatusReady,
		GateVerdict:   "pending",
		TokensIn:      execOut.TokensIn,
		TokensOut:     execOut.TokensOut,
		ArtifactHTML:  execOut.ArtifactHTML,
		PromptHash:    promptHash,
		ExecutionMode: execOut.ExecutionMode,
		SpecJSON:      execOut.Spec,
		GateAuditJSON: execOut.GateAudit,
	})
	if err != nil {
		return contracts.CadenceRunResult{}, false, newCadenceError(
			http.StatusInternalServerError, connect.CodeInternal, contracts.ErrCodeInternal,
			"failed to persist sandbox run", "Retry or share the reference ID.", corrID, nil)
	}

	turns := make([]contracts.CadenceTurn, 0, len(execOut.Turns))
	for _, ti := range execOut.Turns {
		ti.RunID = runID
		recorded, turnErr := deps.store.InsertSandboxTurn(ctx, ti)
		if turnErr == nil {
			turns = append(turns, recorded)
		}
	}

	res := contracts.CadenceRunResult{
		RunID:         runID,
		Prompt:        req.Prompt,
		PresetSlug:    presetSlug,
		RunStatus:     contracts.CadenceStatusReady,
		Mode:          mode,
		ExecutionMode: execOut.ExecutionMode,
		IsGolden:      false,
		Spec:          execOut.Spec,
		GateAudit:     execOut.GateAudit,
		Status:        &execOut.Status,
		OSC7501:       execOut.OSC7501,
		GateVerdict:   "pending",
		Turns:         turns,
		ArtifactHTML:  execOut.ArtifactHTML,
		TokensIn:      execOut.TokensIn,
		TokensOut:     execOut.TokensOut,
		Quota:         &quota,
	}
	return res, true, nil
}
