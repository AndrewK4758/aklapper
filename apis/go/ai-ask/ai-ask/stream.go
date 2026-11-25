package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
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
		attemptID = newUUIDv4()
	} else if !contracts.ValidateUUID(attemptID) {
		return newSyncFailure(http.StatusBadRequest, contracts.ErrCodeValidation,
			"Invalid attempt identifier.", "Refresh and submit again.", in.CorrelationID, nil)
	}

	convID := strings.TrimSpace(in.ConversationID)
	if convID == "" {
		convID = newUUIDv4()
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

	history, _ := deps.store.ListConversationHistory(ctx, in.SessionID, convID, conversationRecallMax)
	retrievalQuery, rewriteTokens := rewriteFollowUpQuery(ctx, deps.provider, history, queryText)

	allowProfileFallback := isProfileOverviewIntent(queryText) && !isConfidentialBoundaryProbe(queryText)
	hybrid, searchErr := executeHybridSearch(ctx, deps.provider, deps.vectorStore, deps.store, retrievalQuery, 6, in.CorrelationID, allowProfileFallback)
	if searchErr != nil {
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(searchErr, context.Canceled) {
			return refundPreStream(499, contracts.ErrCodeStreamAborted,
				"Request cancelled early.", "Retry if you still need this view.", "retrieval_canceled")
		}
		if errors.Is(searchErr, context.DeadlineExceeded) {
			return refundPreStream(http.StatusGatewayTimeout, contracts.ErrCodeStreamTimeout,
				"Section took too long to load.", "Retry loading or refresh.", "retrieval_timeout")
		}
		return refundPreStream(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
			"Upstream service unreachable.", "Retry shortly or go home.", "retrieval_error")
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

	emitter, stopStream, err := startStream()
	if err != nil {
		return refundPreStream(http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
			"Upstream service unreachable.", "Retry shortly or go home.", "stream_init_error")
	}
	if stopStream != nil {
		defer stopStream()
	}

	_ = emitter.EmitStatus("retrieving", "Searching portfolio records...")
	_ = emitter.EmitMeta(askStreamMeta{
		AttemptID:      attemptID,
		ConversationID: convID,
		TurnIndex:      turnIndex,
		CorrelationID:  in.CorrelationID,
		Mode:           mode,
		Provider:       deps.provider.Name(),
	})

	if tier == contracts.GroundingTierBoundary {
		streamAbstainedTurn(ctx, deps, emitter, attemptID, convID, turnIndex, in, role, mode, hybrid.TopDenseScore, len(hybrid.Candidates), started)
		return nil
	}

	profileCore := resolvePinnedProfileCore(ctx, deps.store)
	sources, evidenceCtx := buildStreamingPromptContext(tier, profileCore, hybrid)
	_ = emitter.EmitSources(sources)
	_ = emitter.EmitStatus("generating", "Synthesizing grounded response...")

	stopRenewer := startLeaseRenewer(ctx, deps.store, attemptID, deps.leaseRenewInterval)
	defer stopRenewer()
	guard := privacy.NewStreamGuard(deps.privacyCfg, in.CorrelationID)

	messages := buildStreamingMessages(tier, in.VisitorLens, profileCore, history, evidenceCtx, queryText)

	var postGuard strings.Builder
	streamResult, streamErr := llm.StreamChat(ctx, deps.provider, llm.ChatStreamRequest{
		Messages:  messages,
		MaxTokens: 512,
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
		in, role, mode, sources, postGuard.String(), streamResult, streamErr, started,
	)
	return nil
}

func handleAskStreamPost(deps askStreamDeps) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		w.Header().Set("X-Correlation-Id", corrID)
		claims, authErr := internalauth.VerifyRequest(r)
		if authErr != nil {
			logAskEvent("ai_ask.auth.rejected", map[string]any{"correlationId": corrID, "seam_type": "BOUNDARY_FAULT"})
			writePublicError(w, http.StatusUnauthorized, contracts.ErrCodeUnauthorized,
				"Authentication is required.", "Retry through the portal.", corrID)
			return
		}

		var req askRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
				"Submitted fields need attention.", "Review highlighted fields and retry.", corrID)
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
