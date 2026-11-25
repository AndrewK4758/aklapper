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
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const defaultSyncWaitWindow = 20 * time.Second

type workerOutcome struct {
	httpStatus int
	response   *contracts.AskResponse
	errEnv     *contracts.PublicAppError
}

func handleAskPost(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store, privacyCfg *privacy.Config, syncWait time.Duration) http.HandlerFunc {
	if syncWait <= 0 {
		syncWait = defaultSyncWaitWindow
	}
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
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

		mode := strings.TrimSpace(req.Mode)
		if mode == "" {
			mode = "qa"
		}
		if mode != "qa" && mode != "jd_match" {
			writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
				"Mode must be qa or jd_match.", "Select Ask Portfolio or JD Match and retry.", corrID)
			return
		}

		var queryText string
		if mode == "qa" {
			queryText = strings.TrimSpace(req.Question)
			qRunes := utf8.RuneCountInString(queryText)
			if qRunes < 4 || qRunes > 800 {
				writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
					"Question must be between 4 and 800 characters.", "Adjust your question and retry.", corrID)
				return
			}
		} else {
			queryText = strings.TrimSpace(req.JobDescription)
			if queryText == "" {
				queryText = strings.TrimSpace(req.Question)
			}
			jdRunes := utf8.RuneCountInString(queryText)
			if jdRunes < 20 || jdRunes > 8000 {
				writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
					"Job description must be between 20 and 8000 characters.", "Adjust job description length and retry.", corrID)
				return
			}
		}

		attemptID := strings.TrimSpace(req.AttemptID)
		if attemptID == "" {
			attemptID = newUUIDv4()
		} else if !contracts.ValidateUUID(attemptID) {
			writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
				"Invalid attempt identifier.", "Refresh and submit again.", corrID)
			return
		}

		role := contracts.RoleGuest
		if claims.Role == contracts.RoleAdmin {
			role = contracts.RoleAdmin
		}
		sessionID := claims.Sub
		promptHash := hashPrompt(mode, queryText)

		convID := strings.TrimSpace(req.ConversationID)
		if convID != "" && !contracts.ValidateUUID(convID) {
			writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
				"Invalid conversation identifier.", "Start a new conversation and retry.", corrID)
			return
		}
		storedPrompt := ""
		if mode == "qa" {
			storedPrompt = privacy.RedactTextForStorage(privacyCfg, queryText, pg.MaxPromptTextRunes)
		}

		res, allowed, reserveErr := store.ReserveTurnTx(r.Context(), pg.ReserveTurnInput{
			AttemptID: attemptID, SessionID: sessionID, Role: role, Mode: mode,
			PromptHash: promptHash, ConversationID: convID, PromptText: storedPrompt,
			CorrelationID: corrID, ReserveTokens: pg.DefaultAskTurnReserveTokens,
		})
		if errors.Is(reserveErr, pg.ErrTurnConflict) {
			writePublicError(w, http.StatusConflict, contracts.ErrCodeValidation,
				"Submitted fields need attention.", "Use a fresh request attempt.", corrID)
			return
		}
		if reserveErr != nil {
			logAskEvent("ai_ask.quota.reserve_error", map[string]any{"correlationId": corrID, "seam_type": "BOUNDARY_FAULT"})
			writePublicError(w, http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
				"Database temporarily unavailable.", "Retry shortly or share ID.", corrID)
			return
		}
		if !allowed {
			w.Header().Set("X-Correlation-Id", corrID)
			httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
				"error":         "Session or daily quota exceeded. Try again later.",
				"code":          contracts.ErrCodeRateLimited,
				"action":        "Wait a moment and submit again.",
				"correlationId": corrID,
				"quota":         res.Quota,
			})
			return
		}
		if res.Reused {
			writeReusedTurn(w, res.Turn, res.Quota)
			return
		}

		workerCtx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), pg.AskTurnLeaseDuration)
		doneCh := make(chan workerOutcome, 1)
		go func() {
			defer cancel()
			doneCh <- executeTurnWorker(workerCtx, provider, vectorStore, store, privacyCfg, attemptID, sessionID, role, mode, queryText, corrID)
		}()

		timer := time.NewTimer(syncWait)
		defer timer.Stop()

		select {
		case out := <-doneCh:
			w.Header().Set("X-Correlation-Id", corrID)
			if out.response != nil {
				httpkit.WriteJSON(w, out.httpStatus, out.response)
				return
			}
			httpkit.WriteJSON(w, out.httpStatus, out.errEnv)
		case <-timer.C:
			w.Header().Set("X-Correlation-Id", corrID)
			httpkit.WriteJSON(w, http.StatusAccepted, res.Turn.ToState(&res.Quota))
		case <-r.Context().Done():
			return
		}
	}
}

func executeTurnWorker(
	ctx context.Context,
	provider llm.Provider,
	vectorStore *qdrant.Client,
	store *pg.Store,
	privacyCfg *privacy.Config,
	attemptID, sessionID, role, mode, queryText, corrID string,
) workerOutcome {
	started := time.Now()
	failWithRefund := func(status int, errCode, msg, action, reason string) workerOutcome {
		_, _ = store.RefundTurnTx(context.Background(), attemptID, errCode)
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": sessionID, "role": role, "mode": mode,
			"provider": provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "deltaStatus": "refunded", "reason": reason,
			"correlationId": corrID, "seam_type": "BOUNDARY_FAULT",
		})
		return workerOutcome{
			httpStatus: status,
			errEnv: &contracts.PublicAppError{
				Code: errCode, Status: status, Message: msg, Action: action, CorrelationID: corrID,
			},
		}
	}

	maxCandidates := 6
	if mode == "jd_match" {
		maxCandidates = jdMaxEvidenceChunks
	}
	allowProfileFallback := mode == "qa" && isProfileOverviewIntent(queryText) && !isConfidentialBoundaryProbe(queryText)
	hybrid, searchErr := executeHybridSearch(ctx, provider, vectorStore, store, queryText, maxCandidates, corrID, allowProfileFallback)
	if searchErr != nil {
		status := http.StatusBadGateway
		errCode := contracts.ErrCodeUpstreamUnavailable
		if errors.Is(searchErr, context.DeadlineExceeded) {
			status = http.StatusGatewayTimeout
			errCode = contracts.ErrCodeStreamTimeout
		}
		return failWithRefund(status, errCode, "Upstream service unreachable.", "Retry shortly or go home.", "retrieval_error")
	}

	tier := classifyGroundingTier(mode, queryText, hybrid)
	logAskEvent("ai_ask.grounding.tier_selected", map[string]any{
		"seam_type":     "RULE_DIVERGENCE",
		"branch":        tier,
		"mode":          mode,
		"topDenseScore": hybrid.TopDenseScore,
		"lexicalHits":   hybrid.LexicalHitCount,
		"correlationId": corrID,
	})

	if tier == contracts.GroundingTierBoundary {
		reason := fmt.Sprintf("Abstaining: top corpus evidence score (%.2f) fell below strict grounding threshold (%.2f).", hybrid.TopDenseScore, minGroundScore)
		if hybrid.TopDenseScore == 0 && hybrid.LexicalHitCount == 0 {
			reason = "Abstaining: no grounded portfolio evidence matched your request above threshold."
		}
		latency := int(time.Since(started).Milliseconds())
		var abstainedResp contracts.AskResponse
		if mode == "jd_match" {
			abstainedResp = buildJDAbsention(provider.Name(), "", reason, 0, latency, corrID, attemptID, nil)
		} else {
			abstainedResp = contracts.AskResponse{
				AttemptID:         attemptID,
				Grounded:          false,
				Abstained:         true,
				GroundingTier:     contracts.GroundingTierBoundary,
				Mode:              mode,
				Answer:            reason,
				Sources:           []contracts.AskSource{},
				SuggestedLinks:    defaultSuggestedLinksForTier(tier, nil, corrID),
				FollowUpQuestions: defaultFollowUpQuestionsForTier(tier),
				Provider:          provider.Name(),
				TokensUsed:        0,
				LatencyMs:         latency,
				CorrelationID:     corrID,
			}
		}
		quota, recErr := store.ReconcileTurnTx(context.Background(), attemptID, abstainedResp)
		if recErr != nil {
			return failWithRefund(http.StatusGatewayTimeout, contracts.ErrCodeStreamTimeout, "Section took too long to load.", "Retry loading or refresh.", "lease_expired")
		}
		abstainedResp.Quota = &quota
		logAskEvent("ai_ask.turn.audit", map[string]any{
			"attemptId": attemptID, "sessionId": sessionID, "role": role, "mode": mode,
			"groundingTier": tier, "provider": provider.Name(), "tokensReserved": pg.DefaultAskTurnReserveTokens,
			"tokensUsed": 0, "deltaStatus": "abstained", "correlationId": corrID, "seam_type": "DELTA_AUDIT_GAP",
		})
		return workerOutcome{httpStatus: http.StatusOK, response: &abstainedResp}
	}

	profileCore := resolvePinnedProfileCore(ctx, store)
	var (
		evidenceCtx string
		sources     []contracts.AskSource
	)
	if mode == "jd_match" {
		evidenceCtx, sources = buildBoundedJDEvidence(profileCore, hybrid.Candidates)
	} else if tier == contracts.GroundingTierProfile {
		sources = []contracts.AskSource{{
			ID:             profileCore.ID,
			DocKey:         profileCore.ID,
			Title:          profileCore.Title,
			SectionHeading: profileCore.SectionHeading,
			Snippet:        profileCore.Snippet,
			Score:          1.0,
			Category:       profileCore.Category,
		}}
		evidenceCtx = fmt.Sprintf("[1] %s (%s): %s\n", profileCore.Title, profileCore.Category, profileCore.Snippet)
	} else {
		var ctxBuilder strings.Builder
		sources = candidatesToAskSources(hybrid.Candidates)
		for i, src := range sources {
			fmt.Fprintf(&ctxBuilder, "[%d] %s (%s, score=%.2f): %s\n", i+1, src.Title, src.Category, src.Score, src.Snippet)
		}
		evidenceCtx = ctxBuilder.String()
	}

	var resp contracts.AskResponse
	if mode == "jd_match" {
		eval, comp, jdErr := evaluateJDWithLLM(ctx, provider, evidenceCtx, queryText)
		if jdErr != nil {
			status := http.StatusBadGateway
			errCode := contracts.ErrCodeUpstreamUnavailable
			if errors.Is(jdErr, context.DeadlineExceeded) {
				status = http.StatusGatewayTimeout
				errCode = contracts.ErrCodeStreamTimeout
			}
			return failWithRefund(status, errCode, "Upstream service unreachable.", "Retry shortly or go home.", "jd_chat_error")
		}
		if privErr := guardJDEvaluationOutput(privacyCfg, corrID, &eval); privErr != nil {
			logAskEvent("ai_ask.stream.privacy_guard_triggered", map[string]any{
				"seam_type": "BOUNDARY_FAULT", "severity": "CRITICAL", "attemptId": attemptID,
				"mode": mode, "action": "aborted", "correlationId": corrID,
			})
			return failWithRefund(http.StatusForbidden, contracts.ErrCodeForbidden,
				"Permission denied for action.", "Return home or sign in again.", "privacy_abort")
		}
		score := eval.MatchScore
		resp = contracts.AskResponse{
			AttemptID: attemptID, Grounded: true, Abstained: false, GroundingTier: tier, Mode: mode,
			Answer: eval.Answer, Sources: sources, MatchScore: &score,
			Strengths: eval.Strengths, Gaps: eval.Gaps, Provider: provider.Name(),
			Model: comp.Model, TokensUsed: comp.TokensUsed, LatencyMs: int(time.Since(started).Milliseconds()), CorrelationID: corrID,
		}
	} else {
		systemPrompt := buildThirdPersonSystemPrompt(tier, profileCore)
		userPrompt := fmt.Sprintf("Evidence:\n%s\n<untrusted_question>\n%s\n</untrusted_question>", evidenceCtx, sanitizeUntrustedQuestionText(queryText))
		comp, chatErr := provider.Chat(ctx, []llm.ChatMessage{
			{Role: "system", Content: systemPrompt}, {Role: "user", Content: userPrompt},
		}, 512)
		if chatErr != nil {
			status := http.StatusBadGateway
			errCode := contracts.ErrCodeUpstreamUnavailable
			if errors.Is(chatErr, context.DeadlineExceeded) {
				status = http.StatusGatewayTimeout
				errCode = contracts.ErrCodeStreamTimeout
			}
			return failWithRefund(status, errCode, "Upstream service unreachable.", "Retry shortly or go home.", "qa_chat_error")
		}
		safeAnswer, privErr := guardUnaryOutputText(privacyCfg, corrID, comp.Text)
		if privErr != nil {
			logAskEvent("ai_ask.stream.privacy_guard_triggered", map[string]any{
				"seam_type": "BOUNDARY_FAULT", "severity": "CRITICAL", "attemptId": attemptID,
				"mode": mode, "action": "aborted", "correlationId": corrID,
			})
			return failWithRefund(http.StatusForbidden, contracts.ErrCodeForbidden,
				"Permission denied for action.", "Return home or sign in again.", "privacy_abort")
		}
		resp = contracts.AskResponse{
			AttemptID:         attemptID,
			Grounded:          true,
			Abstained:         false,
			GroundingTier:     tier,
			Mode:              mode,
			Answer:            safeAnswer,
			Sources:           sources,
			SuggestedLinks:    defaultSuggestedLinksForTier(tier, sources, corrID),
			FollowUpQuestions: defaultFollowUpQuestionsForTier(tier),
			Provider:          provider.Name(),
			Model:             comp.Model,
			TokensUsed:        comp.TokensUsed,
			LatencyMs:         int(time.Since(started).Milliseconds()),
			CorrelationID:     corrID,
		}
	}

	quota, recErr := store.ReconcileTurnTx(context.Background(), attemptID, resp)
	if errors.Is(recErr, pg.ErrTurnLeaseExpired) {
		return workerOutcome{
			httpStatus: http.StatusGatewayTimeout,
			errEnv: &contracts.PublicAppError{
				Code: contracts.ErrCodeStreamTimeout, Status: http.StatusGatewayTimeout,
				Message: "Section took too long to load.", Action: "Retry loading or refresh.", CorrelationID: corrID,
			},
		}
	}
	if recErr != nil {
		return failWithRefund(http.StatusGatewayTimeout, contracts.ErrCodeStreamTimeout, "Section took too long to load.", "Retry loading or refresh.", "lease_expired")
	}
	resp.Quota = &quota
	logAskEvent("ai_ask.turn.audit", map[string]any{
		"attemptId": attemptID, "sessionId": sessionID, "role": role, "mode": mode,
		"provider": provider.Name(), "model": resp.Model, "tokensReserved": pg.DefaultAskTurnReserveTokens,
		"tokensUsed": resp.TokensUsed, "deltaStatus": "reconciled", "correlationId": corrID, "seam_type": "DELTA_AUDIT_GAP",
	})
	return workerOutcome{httpStatus: http.StatusOK, response: &resp}
}
