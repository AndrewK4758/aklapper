package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

func logStreamLifecycleOutcome(branch, attemptID, corrID string) {
	logAskEvent("ai_ask.stream.lifecycle_outcome", map[string]any{
		"seam_type":     "RULE_DIVERGENCE",
		"branch":        branch,
		"attemptId":     attemptID,
		"correlationId": corrID,
	})
}

func handleReusedStreamTurn(
	turn pg.TurnRecord,
	quota contracts.QuotaStatus,
	startStream func() (streamEmitter, func(), error),
) *streamSyncFailure {
	state := turn.ToState(&quota)
	switch turn.Status {
	case contracts.TurnStatusCompleted, contracts.TurnStatusAbstained:
		if turn.Result == nil {
			return newSyncFailure(http.StatusConflict, contracts.ErrCodeConstraint,
				"Request is already in progress.", "Poll GET /v1/ask/turns/"+turn.AttemptID+" for status.", turn.CorrelationID, &quota)
		}
		emitter, stopStream, err := startStream()
		if err != nil {
			return newSyncFailure(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
				"Upstream service unreachable.", "Retry shortly or go home.", turn.CorrelationID, &quota)
		}
		if stopStream != nil {
			defer stopStream()
		}
		r := turn.Result
		_ = emitter.EmitMeta(askStreamMeta{
			AttemptID:      turn.AttemptID,
			ConversationID: turn.ConversationID,
			TurnIndex:      turn.TurnIndex,
			CorrelationID:  turn.CorrelationID,
			Mode:           turn.Mode,
			Provider:       r.Provider,
			Model:          r.Model,
		})
		_ = emitter.EmitSources(r.Sources)
		if r.Answer != "" {
			_ = emitter.EmitDelta(r.Answer)
		}
		_ = emitter.EmitDone(askStreamDone{
			AttemptID:         turn.AttemptID,
			ConversationID:    turn.ConversationID,
			TurnIndex:         turn.TurnIndex,
			Grounded:          r.Grounded,
			Abstained:         r.Abstained,
			GroundingTier:     r.GroundingTier,
			Answer:            r.Answer,
			SuggestedLinks:    r.SuggestedLinks,
			FollowUpQuestions: r.FollowUpQuestions,
			Provider:          r.Provider,
			Model:             r.Model,
			TokensUsed:        r.TokensUsed,
			LatencyMs:         r.LatencyMs,
			CorrelationID:     turn.CorrelationID,
			Quota:             &quota,
		})
		return nil
	case contracts.TurnStatusFailed, contracts.TurnStatusExpired:
		if state.Error != nil {
			return &streamSyncFailure{
				HTTPStatus: state.Error.Status, GRPCCode: httpStatusToGRPCCode(state.Error.Status),
				Error: *state.Error, Quota: &quota,
			}
		}
		return newSyncFailure(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
			"Upstream service unreachable.", "Retry shortly or go home.", turn.CorrelationID, &quota)
	default:
		return newSyncFailure(http.StatusConflict, contracts.ErrCodeConstraint,
			"Request is already in progress.", "Poll GET /v1/ask/turns/"+turn.AttemptID+" for status.", turn.CorrelationID, &quota)
	}
}

func streamAbstainedTurn(
	ctx context.Context,
	deps askStreamDeps,
	emitter streamEmitter,
	attemptID, convID string,
	turnIndex int,
	in askStreamInput,
	role, mode string,
	topScore float64,
	hitCount int,
	started time.Time,
) {
	_ = emitter.EmitSources([]contracts.AskSource{})
	reason := fmt.Sprintf("Abstaining: top corpus evidence score (%.2f) fell below strict grounding threshold (%.2f).", topScore, minGroundScore)
	if hitCount == 0 && topScore == 0 {
		reason = "Abstaining: no grounded portfolio evidence matched your request above threshold."
	}
	latency := int(time.Since(started).Milliseconds())
	links := defaultSuggestedLinksForTier(contracts.GroundingTierBoundary, nil, in.CorrelationID)
	followUps := defaultFollowUpQuestionsForTier(contracts.GroundingTierBoundary)

	abstainedResp := contracts.AskResponse{
		AttemptID:         attemptID,
		ConversationID:    convID,
		TurnIndex:         turnIndex,
		Grounded:          false,
		Abstained:         true,
		GroundingTier:     contracts.GroundingTierBoundary,
		Mode:              mode,
		Answer:            reason,
		Sources:           []contracts.AskSource{},
		SuggestedLinks:    links,
		FollowUpQuestions: followUps,
		Provider:          deps.provider.Name(),
		TokensUsed:        0,
		LatencyMs:         latency,
		CorrelationID:     in.CorrelationID,
	}
	cleanCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedCleanupTimeout)
	defer cancel()
	quota, recErr := deps.store.ReconcileTurnTx(cleanCtx, attemptID, abstainedResp)
	if recErr != nil {
		refQuota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeStreamTimeout)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code: contracts.ErrCodeStreamTimeout, Status: http.StatusGatewayTimeout,
			Message: "Section took too long to load.", Action: "Retry loading or refresh.", CorrelationID: in.CorrelationID,
		}, &refQuota)
		logStreamLifecycleOutcome("upstream_error", attemptID, in.CorrelationID)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "deltaStatus": "refunded", "reason": "reconcile_failed",
			"correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}
	_ = emitter.EmitDone(askStreamDone{
		AttemptID:         attemptID,
		ConversationID:    convID,
		TurnIndex:         turnIndex,
		Grounded:          false,
		Abstained:         true,
		GroundingTier:     contracts.GroundingTierBoundary,
		Answer:            reason,
		SuggestedLinks:    links,
		FollowUpQuestions: followUps,
		Provider:          deps.provider.Name(),
		TokensUsed:        0,
		LatencyMs:         latency,
		CorrelationID:     in.CorrelationID,
		Quota:             &quota,
	})
	logStreamLifecycleOutcome("abstained", attemptID, in.CorrelationID)
	logAskEvent("ai_ask.turn.audit", map[string]any{
		"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
		"groundingTier": contracts.GroundingTierBoundary,
		"provider":      deps.provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
		"tokensUsed": 0, "deltaStatus": "abstained", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
	})
}

func finalizeStreamOutcome(
	ctx context.Context,
	deps askStreamDeps,
	emitter streamEmitter,
	attemptID, convID string,
	turnIndex int,
	tier string,
	rewriteTokens int,
	in askStreamInput,
	role, mode string,
	sources []contracts.AskSource,
	postGuardAnswer string,
	result llm.ChatStreamResult,
	streamErr error,
	started time.Time,
) {
	cleanCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedCleanupTimeout)
	defer cancel()
	latency := int(time.Since(started).Milliseconds())

	if errors.Is(streamErr, privacy.ErrPrivacyAborted) {
		quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeForbidden)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code: contracts.ErrCodeForbidden, Status: http.StatusForbidden,
			Message: "Permission denied for action.", Action: "Return home or sign in again.", CorrelationID: in.CorrelationID,
		}, &quota)
		logStreamLifecycleOutcome("privacy_aborted", attemptID, in.CorrelationID)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
			"reason": "privacy_abort", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}

	if streamErr != nil && (errors.Is(ctx.Err(), context.Canceled) || errors.Is(streamErr, context.Canceled) || errors.Is(streamErr, errClientDisconnected)) {
		emittedRunes := utf8.RuneCountInString(postGuardAnswer)
		if emittedRunes == 0 {
			quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeStreamAborted)
			_ = emitter.EmitError(contracts.PublicAppError{
				Code: contracts.ErrCodeStreamAborted, Status: 499,
				Message: "Request cancelled early.", Action: "Retry if you still need this view.", CorrelationID: in.CorrelationID,
			}, &quota)
			logStreamLifecycleOutcome("client_aborted_zero_tokens", attemptID, in.CorrelationID)
			logAskEvent("ai_ask.turn.audit", map[string]any{
				"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
				"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
				"reason": "client_aborted_zero_runes", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
			})
			return
		}
		charged := result.TokensUsed + rewriteTokens
		if charged <= 0 {
			charged = max(1, emittedRunes/4)
		}
		deltaStatus := "aborted_partial"
		if _, recErr := deps.store.ReconcilePartialAbortTurnTx(cleanCtx, attemptID, charged, contracts.ErrCodeStreamAborted); recErr != nil {
			deltaStatus = "reconcile_failed"
		}
		logStreamLifecycleOutcome("client_aborted_partial", attemptID, in.CorrelationID)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "model": result.Model, "tokensUsed": charged,
			"deltaStatus": deltaStatus, "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}

	if streamErr != nil {
		status := http.StatusBadGateway
		errCode := contracts.ErrCodeUpstreamUnavailable
		msg := "Upstream service unreachable."
		action := "Retry shortly or go home."
		if errors.Is(streamErr, llm.ErrStreamIdleTimeout) || errors.Is(streamErr, context.DeadlineExceeded) {
			status = http.StatusGatewayTimeout
			errCode = contracts.ErrCodeStreamTimeout
			msg = "Section took too long to load."
			action = "Retry loading or refresh."
		}
		quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, errCode)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code: errCode, Status: status, Message: msg, Action: action, CorrelationID: in.CorrelationID,
		}, &quota)
		logStreamLifecycleOutcome("upstream_error", attemptID, in.CorrelationID)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
			"reason": "llm_stream_error", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}

	totalTokens := result.TokensUsed + rewriteTokens
	links := defaultSuggestedLinksForTier(tier, sources, in.CorrelationID)
	followUps := defaultFollowUpQuestionsForTier(tier)
	resp := contracts.AskResponse{
		AttemptID:         attemptID,
		ConversationID:    convID,
		TurnIndex:         turnIndex,
		Grounded:          true,
		Abstained:         false,
		GroundingTier:     tier,
		Mode:              mode,
		Answer:            postGuardAnswer,
		Sources:           sources,
		SuggestedLinks:    links,
		FollowUpQuestions: followUps,
		Provider:          deps.provider.Name(),
		Model:             result.Model,
		TokensUsed:        totalTokens,
		LatencyMs:         latency,
		CorrelationID:     in.CorrelationID,
	}
	quota, recErr := deps.store.ReconcileTurnTx(cleanCtx, attemptID, resp)
	if recErr != nil {
		refQuota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeStreamTimeout)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code: contracts.ErrCodeStreamTimeout, Status: http.StatusGatewayTimeout,
			Message: "Section took too long to load.", Action: "Retry loading or refresh.", CorrelationID: in.CorrelationID,
		}, &refQuota)
		logStreamLifecycleOutcome("upstream_error", attemptID, in.CorrelationID)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "model": result.Model, "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "deltaStatus": "refunded", "reason": "reconcile_failed",
			"correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}
	_ = emitter.EmitDone(askStreamDone{
		AttemptID:         attemptID,
		ConversationID:    convID,
		TurnIndex:         turnIndex,
		Grounded:          true,
		Abstained:         false,
		GroundingTier:     tier,
		Answer:            postGuardAnswer,
		SuggestedLinks:    links,
		FollowUpQuestions: followUps,
		Provider:          deps.provider.Name(),
		Model:             result.Model,
		TokensUsed:        totalTokens,
		UsageEstimated:    result.UsageEstimated,
		LatencyMs:         latency,
		CorrelationID:     in.CorrelationID,
		Quota:             &quota,
	})
	logStreamLifecycleOutcome("completed", attemptID, in.CorrelationID)
	logAskEvent("ai_ask.turn.audit", map[string]any{
		"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
		"groundingTier": tier,
		"provider":      deps.provider.Name(), "model": result.Model, "tokensReserved": pg.DefaultAskTurnReserveTokens,
		"tokensUsed": totalTokens, "deltaStatus": "reconciled", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
	})
}
