package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

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
			AttemptID: turn.AttemptID, CorrelationID: turn.CorrelationID, Mode: turn.Mode, Provider: r.Provider, Model: r.Model,
		})
		_ = emitter.EmitSources(r.Sources)
		if r.Answer != "" {
			_ = emitter.EmitDelta(r.Answer)
		}
		_ = emitter.EmitDone(askStreamDone{
			AttemptID: turn.AttemptID, Grounded: r.Grounded, Abstained: r.Abstained, Answer: r.Answer,
			Provider: r.Provider, Model: r.Model, TokensUsed: r.TokensUsed, LatencyMs: r.LatencyMs,
			CorrelationID: turn.CorrelationID, Quota: &quota,
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

func filterGroundedHits(hits []qdrant.SearchHit) ([]qdrant.SearchHit, float64) {
	filtered := make([]qdrant.SearchHit, 0, len(hits))
	topScore := 0.0
	for _, hit := range hits {
		if hit.Score > topScore {
			topScore = hit.Score
		}
		if hit.Score >= minGroundScore {
			filtered = append(filtered, hit)
		}
	}
	return filtered, topScore
}

func buildGroundedPromptContext(filtered []qdrant.SearchHit) ([]contracts.AskSource, string) {
	var b strings.Builder
	sources := make([]contracts.AskSource, 0, len(filtered))
	for i, hit := range filtered {
		docID := stringFromPayload(hit.Payload, "docId", fmt.Sprintf("%v", hit.ID))
		title := stringFromPayload(hit.Payload, "title", "Portfolio Evidence")
		snippet := stringFromPayload(hit.Payload, "snippet", "")
		category := stringFromPayload(hit.Payload, "category", "portfolio")
		sources = append(sources, contracts.AskSource{ID: docID, Title: title, Snippet: snippet, Score: hit.Score, Category: category})
		fmt.Fprintf(&b, "[%d] %s (%s, score=%.2f): %s\n", i+1, title, category, hit.Score, snippet)
	}
	return sources, b.String()
}

func streamAbstainedTurn(
	ctx context.Context,
	deps askStreamDeps,
	emitter streamEmitter,
	attemptID string,
	in askStreamInput,
	role, mode string,
	topScore float64,
	hitCount int,
	started time.Time,
) {
	_ = emitter.EmitSources([]contracts.AskSource{})
	reason := fmt.Sprintf("Abstaining: top corpus evidence score (%.2f) fell below strict grounding threshold (%.2f).", topScore, minGroundScore)
	if hitCount == 0 {
		reason = "Abstaining: no grounded portfolio evidence matched your request above threshold."
	}
	latency := int(time.Since(started).Milliseconds())
	abstainedResp := contracts.AskResponse{
		AttemptID: attemptID, Grounded: false, Abstained: true, Mode: mode, Answer: reason,
		Sources: []contracts.AskSource{}, Provider: deps.provider.Name(), TokensUsed: 0, LatencyMs: latency, CorrelationID: in.CorrelationID,
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
		return
	}
	_ = emitter.EmitDone(askStreamDone{
		AttemptID: attemptID, Grounded: false, Abstained: true, Answer: reason,
		Provider: deps.provider.Name(), TokensUsed: 0, LatencyMs: latency, CorrelationID: in.CorrelationID, Quota: &quota,
	})
	logAskEvent("ai_ask.turn.audit", map[string]any{
		"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
		"provider": deps.provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
		"tokensUsed": 0, "deltaStatus": "abstained", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
	})
}

func finalizeStreamOutcome(
	ctx context.Context,
	deps askStreamDeps,
	emitter streamEmitter,
	attemptID string,
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
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
			"reason": "privacy_abort", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}

	if streamErr != nil && (errors.Is(ctx.Err(), context.Canceled) || errors.Is(streamErr, context.Canceled)) {
		emittedRunes := utf8.RuneCountInString(postGuardAnswer)
		if emittedRunes == 0 {
			quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeStreamAborted)
			_ = emitter.EmitError(contracts.PublicAppError{
				Code: contracts.ErrCodeStreamAborted, Status: 499,
				Message: "Request cancelled early.", Action: "Retry if you still need this view.", CorrelationID: in.CorrelationID,
			}, &quota)
			logAskEvent("ai_ask.turn.audit", map[string]any{
				"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
				"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
				"reason": "client_aborted_zero_runes", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
			})
			return
		}
		charged := result.TokensUsed
		if charged <= 0 {
			charged = max(1, emittedRunes/4)
		}
		partialResp := contracts.AskResponse{
			AttemptID: attemptID, Grounded: true, Abstained: false, Mode: mode, Answer: postGuardAnswer,
			Sources: sources, Provider: deps.provider.Name(), Model: result.Model, TokensUsed: charged,
			LatencyMs: latency, CorrelationID: in.CorrelationID,
		}
		_, _ = deps.store.ReconcileTurnTx(cleanCtx, attemptID, partialResp)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "model": result.Model, "tokensUsed": charged,
			"deltaStatus": "aborted_partial", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
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
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensUsed": 0, "deltaStatus": "refunded",
			"reason": "llm_stream_error", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return
	}

	resp := contracts.AskResponse{
		AttemptID: attemptID, Grounded: true, Abstained: false, Mode: mode, Answer: postGuardAnswer,
		Sources: sources, Provider: deps.provider.Name(), Model: result.Model, TokensUsed: result.TokensUsed,
		LatencyMs: latency, CorrelationID: in.CorrelationID,
	}
	quota, recErr := deps.store.ReconcileTurnTx(cleanCtx, attemptID, resp)
	if recErr != nil {
		refQuota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, contracts.ErrCodeStreamTimeout)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code: contracts.ErrCodeStreamTimeout, Status: http.StatusGatewayTimeout,
			Message: "Section took too long to load.", Action: "Retry loading or refresh.", CorrelationID: in.CorrelationID,
		}, &refQuota)
		return
	}
	_ = emitter.EmitDone(askStreamDone{
		AttemptID: attemptID, Grounded: true, Abstained: false, Answer: postGuardAnswer,
		Provider: deps.provider.Name(), Model: result.Model, TokensUsed: result.TokensUsed,
		UsageEstimated: result.UsageEstimated, LatencyMs: latency, CorrelationID: in.CorrelationID, Quota: &quota,
	})
	logAskEvent("ai_ask.turn.audit", map[string]any{
		"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
		"provider": deps.provider.Name(), "model": result.Model, "tokensReserved": pg.DefaultAskTurnReserveTokens,
		"tokensUsed": result.TokensUsed, "deltaStatus": "reconciled", "correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
	})
}
