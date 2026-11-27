package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

var errClientDisconnected = errors.New("client disconnected during stream emit")

func executeStreamingTurn(
	parentCtx context.Context,
	deps askStreamDeps,
	in askStreamInput,
	startStream func() (streamEmitter, func(), error),
) *streamSyncFailure {
	ctx, cancelWall := context.WithTimeout(parentCtx, pg.MaxStreamWallClock)
	defer cancelWall()

	mode := strings.TrimSpace(in.Mode)
	if mode == "" {
		mode = "qa"
	}
	if mode != "qa" {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Streaming endpoint supports qa mode only.", "Use POST /v1/ask for jd_match or set mode to qa.", in.CorrelationID, nil)
	}
	queryText := strings.TrimSpace(in.Question)
	qRunes := utf8.RuneCountInString(queryText)
	if qRunes < 4 || qRunes > 800 {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Question must be between 4 and 800 characters.", "Adjust your question and retry.", in.CorrelationID, nil)
	}
	attemptID := strings.TrimSpace(in.AttemptID)
	if attemptID == "" {
		attemptID = contracts.NewUUIDv4()
	} else if !contracts.ValidateUUID(attemptID) {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Invalid attempt identifier.", "Refresh and submit again.", in.CorrelationID, nil)
	}

	convID := strings.TrimSpace(in.ConversationID)
	if convID == "" {
		convID = contracts.NewUUIDv4()
	} else if !contracts.ValidateUUID(convID) {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Invalid conversation identifier.", "Start a new conversation and retry.", in.CorrelationID, nil)
	}

	if lens := strings.TrimSpace(in.VisitorLens); lens != "" && !isValidVisitorLensSlug(lens) {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Invalid visitor lens identifier.", "Choose a supported visitor lens and retry.", in.CorrelationID, nil)
	}

	role := contracts.RoleGuest
	if in.Role == contracts.RoleAdmin {
		role = contracts.RoleAdmin
	}
	promptHash := hashPrompt(mode, queryText)
	redactedPrompt := privacy.RedactTextForStorage(deps.privacyCfg, queryText, pg.MaxPromptTextRunes)

	res, allowed, reserveErr := deps.store.ReserveTurnTx(ctx, pg.ReserveTurnInput{
		AttemptID:      attemptID,
		SessionID:      in.SessionID,
		Role:           role,
		Mode:           mode,
		PromptHash:     promptHash,
		ConversationID: convID,
		PromptText:     redactedPrompt,
		CorrelationID:  in.CorrelationID,
		ReserveTokens:  pg.DefaultAskTurnReserveTokens,
	})
	if errors.Is(reserveErr, pg.ErrTurnConflict) {
		return newSyncFailure(http.StatusConflict, contracts.ErrCodeValidation,
			"Submitted fields need attention.", "Use a fresh request attempt.", in.CorrelationID, nil)
	}
	if reserveErr != nil {
		logAskEvent("ai_ask.quota.reserve_error", map[string]any{"correlationId": in.CorrelationID, "seam_type": "BOUNDARY_FAULT"})
		return newSyncFailure(http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
			"Database temporarily unavailable.", "Retry shortly or share ID.", in.CorrelationID, nil)
	}
	if !allowed {
		quotaCopy := res.Quota
		return newSyncFailure(http.StatusTooManyRequests, contracts.ErrCodeRateLimited,
			"Too many requests received.", "Wait a moment and submit again.", in.CorrelationID, &quotaCopy)
	}
	if res.Reused {
		return handleReusedStreamTurn(res.Turn, res.Quota, startStream)
	}

	turnIndex := res.Turn.TurnIndex
	started := time.Now()
	refundPreStream := func(status int, errCode, msg, action, reason string) *streamSyncFailure {
		cleanCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedCleanupTimeout)
		defer cancel()
		quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, errCode)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "deltaStatus": "refunded", "reason": reason,
			"correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return newSyncFailure(status, errCode, msg, action, in.CorrelationID, &quota)
	}

	emitter, stopStream, err := startStream()
	if err != nil {
		return refundPreStream(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
			"Upstream service unreachable.", "Retry shortly or go home.", "stream_init_error")
	}
	if stopStream != nil {
		defer stopStream()
	}

	stopRenewer := startLeaseRenewer(ctx, deps.store, attemptID, deps.leaseRenewInterval)
	defer stopRenewer()

	_ = emitter.EmitStatus("retrieving", "Searching portfolio records...")
	_ = emitter.EmitMeta(askStreamMeta{
		AttemptID:      attemptID,
		ConversationID: convID,
		TurnIndex:      turnIndex,
		CorrelationID:  in.CorrelationID,
		Mode:           mode,
		Provider:       deps.provider.Name(),
	})

	var preambleResult preambleOutcome
	refundStreamError := func(status int, errCode, msg, action, reason string) {
		stopRenewer()
		cleanCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedCleanupTimeout)
		defer cancel()
		quota, _ := deps.store.RefundTurnTx(cleanCtx, attemptID, errCode)
		_ = emitter.EmitError(contracts.PublicAppError{
			Code:          errCode,
			Status:        status,
			Message:       msg,
			Action:        action,
			CorrelationID: in.CorrelationID,
		}, &quota)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": in.SessionID, "role": role, "mode": mode,
			"provider": deps.provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "preambleTokens": preambleResult.tokensUsed, "deltaStatus": "refunded", "reason": reason,
			"correlationId": in.CorrelationID, "seam_type": "DELTA_AUDIT_GAP",
		})
	}

	if isConfidentialBoundaryProbe(queryText) {
		logAskEvent("ai_ask.preamble.boundary_suppressed", map[string]any{
			"seam_type":     "UNSOUND_CONDITION",
			"attemptId":     attemptID,
			"correlationId": in.CorrelationID,
		})
		logAskEvent("ai_ask.preamble.outcome", map[string]any{
			"seam_type":     "RULE_DIVERGENCE",
			"branch":        "suppressed_boundary",
			"attemptId":     attemptID,
			"correlationId": in.CorrelationID,
		})
		logAskEvent("ai_ask.grounding.tier_selected", map[string]any{
			"seam_type":     "RULE_DIVERGENCE",
			"branch":        contracts.GroundingTierBoundary,
			"mode":          mode,
			"topDenseScore": 0.0,
			"lexicalHits":   0,
			"historyTurns":  0,
			"correlationId": in.CorrelationID,
		})
		stopRenewer()
		streamAbstainedTurn(ctx, deps, emitter, attemptID, convID, turnIndex, in, role, mode, 0, 0, started)
		return nil
	}

	profileCore := resolvePinnedProfileCore(ctx, deps.store)
	ragCtx, ragCancel := context.WithCancel(ctx)
	defer ragCancel()

	stopPreamble := func() {}
	if emitter.SupportsPreamble() {
		var ragDone atomic.Bool
		preambleCtx, preambleCancel := context.WithTimeout(ctx, effectivePreambleTimeout(deps.preambleTimeout))
		preambleDone := make(chan struct{})
		go func() {
			defer close(preambleDone)
			preambleResult = runPreambleStream(ctx, preambleCtx, &ragDone, ragCancel, deps, emitter, profileCore, in, queryText)
		}()
		var stopPreambleOnce sync.Once
		stopPreamble = func() {
			stopPreambleOnce.Do(func() {
				ragDone.Store(true)
				preambleCancel()
				<-preambleDone
			})
		}
		defer stopPreamble()
	} else {
		logAskEvent("ai_ask.preamble.outcome", map[string]any{
			"seam_type":     "RULE_DIVERGENCE",
			"branch":        "skipped_unsupported",
			"attemptId":     attemptID,
			"correlationId": in.CorrelationID,
		})
	}

	history, _ := deps.store.ListConversationHistory(ragCtx, in.SessionID, convID, conversationRecallMax)
	retrievalQuery, rewriteTokens := rewriteFollowUpQuery(ragCtx, deps.provider, history, queryText)

	allowProfileFallback := isProfileOverviewIntent(queryText)
	hybrid, searchErr := executeHybridSearch(ragCtx, deps.provider, deps.vectorStore, deps.store, retrievalQuery, 6, in.CorrelationID, allowProfileFallback)
	stopPreamble()

	if emitter.SupportsPreamble() {
		logAskEvent("ai_ask.preamble.outcome", map[string]any{
			"seam_type":      "RULE_DIVERGENCE",
			"branch":         preambleResult.branch,
			"preambleTokens": preambleResult.tokensUsed,
			"attemptId":      attemptID,
			"correlationId":  in.CorrelationID,
		})
	}

	if preambleResult.privacyAborted {
		stopRenewer()
		finalizeStreamOutcome(
			ctx, deps, emitter, attemptID, convID, turnIndex, contracts.GroundingTierBoundary, rewriteTokens,
			preambleResult.tokensUsed, "preamble",
			in, role, mode, nil, "", llm.ChatStreamResult{}, privacy.ErrPrivacyAborted, started,
		)
		return nil
	}

	if searchErr != nil {
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(searchErr, context.Canceled) {
			refundStreamError(499, contracts.ErrCodeStreamAborted,
				"Request cancelled early.", "Retry if you still need this view.", "retrieval_canceled")
			return nil
		}
		if errors.Is(searchErr, context.DeadlineExceeded) {
			refundStreamError(http.StatusGatewayTimeout, contracts.ErrCodeStreamTimeout,
				"Section took too long to load.", "Retry loading or refresh.", "retrieval_timeout")
			return nil
		}
		refundStreamError(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
			"Upstream service unreachable.", "Retry shortly or go home.", "retrieval_error")
		return nil
	}

	tier := classifyGroundingTier(mode, queryText, hybrid)
	logAskEvent("ai_ask.grounding.tier_selected", map[string]any{
		"seam_type":     "RULE_DIVERGENCE",
		"branch":        tier,
		"mode":          mode,
		"topDenseScore": hybrid.TopDenseScore,
		"lexicalHits":   hybrid.LexicalHitCount,
		"historyTurns":  len(history),
		"correlationId": in.CorrelationID,
	})

	if tier == contracts.GroundingTierBoundary {
		stopRenewer()
		streamAbstainedTurn(ctx, deps, emitter, attemptID, convID, turnIndex, in, role, mode, hybrid.TopDenseScore, len(hybrid.Candidates), started)
		return nil
	}

	sources, evidenceCtx := buildStreamingPromptContext(tier, profileCore, hybrid)
	_ = emitter.EmitSources(sources)
	genStatusLabel := "Synthesizing grounded response..."
	if tier == contracts.GroundingTierGeneral {
		genStatusLabel = "Chatting with Andrew's AI..."
	}
	_ = emitter.EmitStatus("generating", genStatusLabel)

	guard := privacy.NewStreamGuard(deps.privacyCfg, in.CorrelationID)

	messages := buildStreamingMessages(tier, in.VisitorLens, profileCore, history, evidenceCtx, queryText)

	var postGuard strings.Builder
	streamResult, streamErr := llm.StreamChat(ctx, deps.provider, llm.ChatStreamRequest{
		Messages:        messages,
		MaxTokens:       1024,
		IncludeThoughts: false,
	}, func(chunk llm.ChatStreamChunk) error {
		if chunk.Delta == "" {
			return nil
		}
		safe, gErr := guard.Process(chunk.Delta)
		if gErr != nil {
			return gErr
		}
		if safe != "" {
			if emitErr := emitter.EmitDelta(safe); emitErr != nil {
				return fmt.Errorf("%w: %v", errClientDisconnected, emitErr)
			}
			postGuard.WriteString(safe)
		}
		return nil
	})
	stopRenewer()

	if streamErr == nil {
		tail, flushErr := guard.Flush()
		if flushErr != nil {
			streamErr = flushErr
		} else if tail != "" {
			if emitErr := emitter.EmitDelta(tail); emitErr != nil {
				streamErr = fmt.Errorf("%w: %v", errClientDisconnected, emitErr)
			} else {
				postGuard.WriteString(tail)
			}
		}
	}

	finalizeStreamOutcome(
		ctx, deps, emitter, attemptID, convID, turnIndex, tier, rewriteTokens,
		preambleResult.tokensUsed, "main",
		in, role, mode, sources, postGuard.String(), streamResult, streamErr, started,
	)
	return nil
}

func handleAskStreamPost(deps askStreamDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		w.Header().Set("X-Correlation-Id", corrID)
		claims, req, ok := authenticateAndDecodeAskRequest(w, r, corrID)
		if !ok {
			return
		}

		syncFail := executeStreamingTurn(r.Context(), deps, askStreamInput{
			Mode:           req.Mode,
			Question:       req.Question,
			AttemptID:      req.AttemptID,
			ConversationID: req.ConversationID,
			VisitorLens:    req.VisitorLens,
			SessionID:      claims.Sub,
			Role:           claims.Role,
			CorrelationID:  corrID,
		}, func() (streamEmitter, func(), error) {
			w.Header().Set("X-Correlation-Id", corrID)
			sw := httpkit.NewSSEWriter(w)
			stopHB := sw.StartHeartbeat(r.Context(), deps.heartbeatInterval)
			return &sseStreamEmitter{writer: sw}, stopHB, nil
		})
		if syncFail != nil {
			w.Header().Set("X-Correlation-Id", syncFail.Error.CorrelationID)
			if syncFail.HTTPStatus == http.StatusTooManyRequests && syncFail.Quota != nil {
				httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
					"code":          syncFail.Error.Code,
					"status":        syncFail.Error.Status,
					"message":       syncFail.Error.Message,
					"action":        syncFail.Error.Action,
					"correlationId": syncFail.Error.CorrelationID,
					"quota":         syncFail.Quota,
				})
				return
			}
			httpkit.WriteJSON(w, syncFail.HTTPStatus, syncFail.Error)
		}
	}
}
