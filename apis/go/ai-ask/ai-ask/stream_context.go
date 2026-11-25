package main

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
	"google.golang.org/grpc/codes"
)

const (
	detachedCleanupTimeout = 5 * time.Second
	conversationRecallMax  = 6
)

type askStreamDeps struct {
	provider           llm.Provider
	vectorStore        *qdrant.Client
	store              *pg.Store
	privacyCfg         *privacy.Config
	heartbeatInterval  time.Duration
	leaseRenewInterval time.Duration
}

type askStreamInput struct {
	Mode           string
	Question       string
	AttemptID      string
	ConversationID string
	VisitorLens    string
	SessionID      string
	Role           string
	CorrelationID  string
}

type askStreamMeta struct {
	AttemptID      string `json:"attemptId"`
	ConversationID string `json:"conversationId,omitempty"`
	TurnIndex      int    `json:"turnIndex,omitempty"`
	CorrelationID  string `json:"correlationId"`
	Mode           string `json:"mode"`
	Provider       string `json:"provider"`
	Model          string `json:"model,omitempty"`
}

type askStreamDone struct {
	AttemptID         string                       `json:"attemptId"`
	ConversationID    string                       `json:"conversationId,omitempty"`
	TurnIndex         int                          `json:"turnIndex,omitempty"`
	Grounded          bool                         `json:"grounded"`
	Abstained         bool                         `json:"abstained"`
	GroundingTier     string                       `json:"groundingTier,omitempty"`
	Answer            string                       `json:"answer"`
	SuggestedLinks    []contracts.AskSuggestedLink `json:"suggestedLinks,omitempty"`
	FollowUpQuestions []string                     `json:"followUpQuestions,omitempty"`
	Provider          string                       `json:"provider"`
	Model             string                       `json:"model,omitempty"`
	TokensUsed        int                          `json:"tokensUsed"`
	UsageEstimated    bool                         `json:"usageEstimated"`
	LatencyMs         int                          `json:"latencyMs"`
	CorrelationID     string                       `json:"correlationId"`
	Quota             *contracts.QuotaStatus       `json:"quota,omitempty"`
}

type streamEmitter interface {
	EmitStatus(stage, label string) error
	EmitMeta(meta askStreamMeta) error
	EmitSources(sources []contracts.AskSource) error
	EmitDelta(text string) error
	EmitDone(done askStreamDone) error
	EmitError(pubErr contracts.PublicAppError, quota *contracts.QuotaStatus) error
}

type streamSyncFailure struct {
	HTTPStatus int
	GRPCCode   codes.Code
	Error      contracts.PublicAppError
	Quota      *contracts.QuotaStatus
}

type sseStreamEmitter struct {
	writer *httpkit.SSEWriter
}

func (e *sseStreamEmitter) EmitStatus(stage, label string) error {
	return e.writer.WriteEvent("status", map[string]string{
		"stage": stage,
		"label": label,
	})
}

func (e *sseStreamEmitter) EmitMeta(meta askStreamMeta) error {
	return e.writer.WriteEvent("meta", meta)
}

func (e *sseStreamEmitter) EmitSources(sources []contracts.AskSource) error {
	return e.writer.WriteEvent("sources", map[string]any{"sources": sources})
}

func (e *sseStreamEmitter) EmitDelta(text string) error {
	return e.writer.WriteEvent("delta", map[string]string{"text": text})
}

func (e *sseStreamEmitter) EmitDone(done askStreamDone) error {
	return e.writer.WriteEvent("done", done)
}

func (e *sseStreamEmitter) EmitError(pubErr contracts.PublicAppError, quota *contracts.QuotaStatus) error {
	payload := map[string]any{
		"code":          pubErr.Code,
		"status":        pubErr.Status,
		"message":       pubErr.Message,
		"action":        pubErr.Action,
		"correlationId": pubErr.CorrelationID,
	}
	if quota != nil {
		payload["quota"] = quota
	}
	return e.writer.WriteEvent("error", payload)
}

func httpStatusToGRPCCode(status int) codes.Code {
	switch status {
	case http.StatusBadRequest:
		return codes.InvalidArgument
	case http.StatusUnauthorized:
		return codes.Unauthenticated
	case http.StatusForbidden:
		return codes.PermissionDenied
	case http.StatusNotFound:
		return codes.NotFound
	case http.StatusConflict:
		return codes.AlreadyExists
	case http.StatusTooManyRequests:
		return codes.ResourceExhausted
	case 499:
		return codes.Canceled
	case http.StatusGatewayTimeout:
		return codes.DeadlineExceeded
	default:
		return codes.Unavailable
	}
}

func newSyncFailure(status int, code, msg, action, corrID string, quota *contracts.QuotaStatus) *streamSyncFailure {
	return &streamSyncFailure{
		HTTPStatus: status,
		GRPCCode:   httpStatusToGRPCCode(status),
		Error: contracts.PublicAppError{
			Code:          code,
			Status:        status,
			Message:       msg,
			Action:        action,
			CorrelationID: corrID,
		},
		Quota: quota,
	}
}

func startLeaseRenewer(ctx context.Context, store *pg.Store, attemptID string, interval time.Duration) func() {
	if interval <= 0 {
		interval = pg.StreamLeaseRenewInterval
	}
	doneCh := make(chan struct{})
	var once sync.Once
	var wg sync.WaitGroup
	wg.Add(1)
	go func() {
		defer wg.Done()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-doneCh:
				return
			case <-ticker.C:
				renewCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), detachedCleanupTimeout)
				_, err := store.ExtendTurnLeaseTx(renewCtx, attemptID, pg.AskTurnLeaseDuration)
				cancel()
				if err != nil {
					return
				}
			}
		}
	}()
	return func() {
		once.Do(func() { close(doneCh) })
		wg.Wait()
	}
}

func buildStreamingPromptContext(
	tier string,
	profileCore pg.CorpusDocument,
	hybrid hybridSearchResult,
) ([]contracts.AskSource, string) {
	if tier == contracts.GroundingTierProfile {
		sources := []contracts.AskSource{{
			ID:             profileCore.ID,
			DocKey:         profileCore.ID,
			Title:          profileCore.Title,
			SectionHeading: profileCore.SectionHeading,
			Snippet:        profileCore.Snippet,
			Score:          1.0,
			Category:       profileCore.Category,
		}}
		var b strings.Builder
		fmt.Fprintf(&b, "[1] %s (%s): %s\n", profileCore.Title, profileCore.Category, profileCore.Snippet)
		for _, cand := range candidatesToAskSources(hybrid.Candidates) {
			if cand.DocKey == profileCore.ID || len(sources) >= 4 {
				continue
			}
			sources = append(sources, cand)
			fmt.Fprintf(&b, "[%d] %s (%s, score=%.2f): %s\n", len(sources), cand.Title, cand.Category, cand.Score, cand.Snippet)
		}
		return sources, b.String()
	}

	sources := candidatesToAskSources(hybrid.Candidates)
	var b strings.Builder
	for i, src := range sources {
		fmt.Fprintf(&b, "[%d] %s (%s, score=%.2f): %s\n", i+1, src.Title, src.Category, src.Score, src.Snippet)
	}
	return sources, b.String()
}

func buildStreamingMessages(
	tier string,
	visitorLens string,
	profileCore pg.CorpusDocument,
	history []pg.ConversationHistoryTurn,
	evidenceCtx string,
	queryText string,
) []llm.ChatMessage {
	systemPrompt := buildThirdPersonSystemPrompt(tier, profileCore)
	if lens := strings.TrimSpace(visitorLens); lens != "" && len(lens) <= 64 {
		systemPrompt += fmt.Sprintf(" Tailor emphasis clearly for visitor lens: %s.", lens)
	}

	messages := make([]llm.ChatMessage, 0, 2+len(history)*2)
	messages = append(messages, llm.ChatMessage{Role: "system", Content: systemPrompt})
	for _, turn := range history {
		if p := strings.TrimSpace(turn.PromptText); p != "" {
			messages = append(messages, llm.ChatMessage{Role: "user", Content: p})
		}
		if a := strings.TrimSpace(turn.AnswerText); a != "" {
			messages = append(messages, llm.ChatMessage{Role: "assistant", Content: a})
		}
	}
	userPrompt := fmt.Sprintf("Evidence:\n%s\n<untrusted_question>\n%s\n</untrusted_question>", evidenceCtx, queryText)
	messages = append(messages, llm.ChatMessage{Role: "user", Content: userPrompt})
	return messages
}
