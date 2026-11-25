package main

import (
	"context"
	"errors"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type scriptedEmitter struct {
	failOnDelta  int
	deltaCalls   int
	sourcesCalls int
	emitted      strings.Builder
	doneCount    int
	errorCodes   []string
}

func (e *scriptedEmitter) EmitStatus(_, _ string) error { return nil }
func (e *scriptedEmitter) EmitMeta(askStreamMeta) error { return nil }
func (e *scriptedEmitter) EmitSources([]contracts.AskSource) error {
	e.sourcesCalls++
	return nil
}
func (e *scriptedEmitter) EmitDone(askStreamDone) error { e.doneCount++; return nil }
func (e *scriptedEmitter) EmitError(p contracts.PublicAppError, _ *contracts.QuotaStatus) error {
	e.errorCodes = append(e.errorCodes, p.Code)
	return nil
}
func (e *scriptedEmitter) EmitDelta(text string) error {
	e.deltaCalls++
	if e.failOnDelta > 0 && e.deltaCalls == e.failOnDelta {
		return errors.New("write: broken pipe")
	}
	e.emitted.WriteString(text)
	return nil
}

type hookStreamLLM struct {
	*streamStubLLM
	onStart func()
}

func (h *hookStreamLLM) ChatStream(ctx context.Context, req llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	if h.onStart != nil {
		h.onStart()
	}
	return h.streamStubLLM.ChatStream(ctx, req, onChunk)
}

func TestStreamEmitDisconnectOrderingAndTurnAuditLogs(t *testing.T) {
	qdrantSrv := newTestQdrantServer(t, 0.92)
	defer qdrantSrv.Close()
	lowScoreQdrant := newTestQdrantServer(t, 0.20)
	defer lowScoreQdrant.Close()

	privCfg, err := privacy.LoadConfig(privacy.ConfigInput{})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	t.Run("chunk-1 EmitDelta write error refunds 499 without charging partial turn", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		store := pg.NewMemoryStore()
		em := &scriptedEmitter{failOnDelta: 1}
		deps := askStreamDeps{
			provider: &streamStubLLM{
				chunks: []string{"First chunk long enough to flush past 16-rune holdback window immediately."},
			},
			vectorStore: &qdrant.Client{BaseURL: qdrantSrv.URL},
			store:       store,
			privacyCfg:  privCfg,
		}
		attemptID := "aaaa1111-1111-4111-8111-111111111111"
		syncFail := executeStreamingTurn(context.Background(), deps, askStreamInput{
			Mode: "qa", Question: "Describe Go streaming architecture?", AttemptID: attemptID,
			SessionID: "sess-chunk1-fail", Role: contracts.RoleGuest, CorrelationID: "corr-chunk1-fail",
		}, func() (streamEmitter, func(), error) { return em, nil, nil })
		if syncFail != nil {
			t.Fatalf("unexpected syncFail: %+v", syncFail)
		}

		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "sess-chunk1-fail")
		if err != nil {
			t.Fatalf("GetTurnByAttemptID failed: %v", err)
		}
		if turn.Status != contracts.TurnStatusFailed || turn.ErrorCode != contracts.ErrCodeStreamAborted {
			t.Fatalf("expected failed ERR_STREAM_ABORTED refund, got status=%s code=%s", turn.Status, turn.ErrorCode)
		}
		quota, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-chunk1-fail")
		if quota.TurnsUsed != 0 {
			t.Fatalf("expected 0 turns charged on chunk-1 emit failure, got %d", quota.TurnsUsed)
		}
		logText := logs.String()
		if !strings.Contains(logText, `"seam_type":"DELTA_AUDIT_GAP"`) ||
			!strings.Contains(logText, `"event":"ai_ask.turn.audit"`) ||
			!strings.Contains(logText, `"deltaStatus":"refunded"`) ||
			!strings.Contains(logText, `"reason":"client_aborted_zero_runes"`) {
			t.Fatalf("expected refunded turn audit log, got %s", logText)
		}
	})

	t.Run("chunk-2 EPIPE write error without ctx.Canceled reconciles aborted_partial instead of refunding", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		store := pg.NewMemoryStore()
		em := &scriptedEmitter{failOnDelta: 2}
		deps := askStreamDeps{
			provider: &streamStubLLM{
				chunks: []string{
					"Delivered prefix text long enough to flush cleanly before disconnect. ",
					"Second chunk fails write and must NOT be persisted in partial result.",
				},
			},
			vectorStore: &qdrant.Client{BaseURL: qdrantSrv.URL},
			store:       store,
			privacyCfg:  privCfg,
		}
		attemptID := "aaaa2222-2222-4222-8222-222222222222"
		syncFail := executeStreamingTurn(context.Background(), deps, askStreamInput{
			Mode: "qa", Question: "Describe Go streaming architecture?", AttemptID: attemptID,
			SessionID: "sess-chunk2-epipe", Role: contracts.RoleGuest, CorrelationID: "corr-chunk2-epipe",
		}, func() (streamEmitter, func(), error) { return em, nil, nil })
		if syncFail != nil {
			t.Fatalf("unexpected syncFail: %+v", syncFail)
		}

		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "sess-chunk2-epipe")
		if err != nil {
			t.Fatalf("GetTurnByAttemptID failed: %v", err)
		}
		if turn.Status != contracts.TurnStatusFailed || turn.ErrorCode != contracts.ErrCodeStreamAborted || turn.TokensUsed < 1 {
			t.Fatalf("expected failed partial-abort turn with consumed tokens charged, got status=%s code=%s tokens=%d", turn.Status, turn.ErrorCode, turn.TokensUsed)
		}
		if turn.Result != nil {
			t.Fatalf("expected nil result on partial-aborted failed turn (excluded from recall), got %+v", turn.Result)
		}
		quota, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "sess-chunk2-epipe")
		if quota.TurnsUsed != 1 {
			t.Fatalf("expected 1 turn charged on partial disconnect, got %d", quota.TurnsUsed)
		}
		logText := logs.String()
		if !strings.Contains(logText, `"seam_type":"DELTA_AUDIT_GAP"`) ||
			!strings.Contains(logText, `"event":"ai_ask.turn.audit"`) ||
			!strings.Contains(logText, `"deltaStatus":"aborted_partial"`) {
			t.Fatalf("expected aborted_partial turn audit log, got %s", logText)
		}
	})

	t.Run("reconciled, abstained, and expired-lease reconcile_failed emit DELTA_AUDIT_GAP ai_ask.turn.audit", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		store := pg.NewMemoryStore()
		deps := askStreamDeps{
			provider:    &streamStubLLM{chunks: []string{"Grounded answer text."}, tokensUsed: 42},
			vectorStore: &qdrant.Client{BaseURL: qdrantSrv.URL},
			store:       store,
			privacyCfg:  privCfg,
		}
		_ = executeStreamingTurn(context.Background(), deps, askStreamInput{
			Mode: "qa", Question: "Describe Go streaming architecture?", AttemptID: "aaaa3333-3333-4333-8333-333333333333",
			SessionID: "sess-audit", Role: contracts.RoleGuest, CorrelationID: "corr-audit-ok",
		}, func() (streamEmitter, func(), error) { return &scriptedEmitter{}, nil, nil })

		depsAbstain := askStreamDeps{
			provider:    &streamStubLLM{chunks: []string{"unused"}},
			vectorStore: &qdrant.Client{BaseURL: lowScoreQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}
		_ = executeStreamingTurn(context.Background(), depsAbstain, askStreamInput{
			Mode: "qa", Question: "Can you share confidential NDA client names?", AttemptID: "aaaa4444-4444-4444-8444-444444444444",
			SessionID: "sess-audit", Role: contracts.RoleGuest, CorrelationID: "corr-audit-abstain",
		}, func() (streamEmitter, func(), error) { return &scriptedEmitter{}, nil, nil })

		attemptExp := "aaaa5555-5555-4555-8555-555555555555"
		depsExpired := askStreamDeps{
			provider: &hookStreamLLM{
				streamStubLLM: &streamStubLLM{chunks: []string{"Text before lease expires"}},
				onStart: func() {
					store.ExpireLeaseForTest(attemptExp, time.Now().UTC().Add(-time.Second))
				},
			},
			vectorStore: &qdrant.Client{BaseURL: qdrantSrv.URL},
			store:       store,
			privacyCfg:  privCfg,
		}
		_ = executeStreamingTurn(context.Background(), depsExpired, askStreamInput{
			Mode: "qa", Question: "Describe Go streaming architecture?", AttemptID: attemptExp,
			SessionID: "sess-audit", Role: contracts.RoleGuest, CorrelationID: "corr-audit-exp",
		}, func() (streamEmitter, func(), error) { return &scriptedEmitter{}, nil, nil })

		logText := logs.String()
		for _, want := range []string{
			`"seam_type":"DELTA_AUDIT_GAP"`,
			`"event":"ai_ask.turn.audit"`,
			`"deltaStatus":"reconciled"`,
			`"tokensUsed":42`,
			`"deltaStatus":"abstained"`,
			`"reason":"reconcile_failed"`,
		} {
			if !strings.Contains(logText, want) {
				t.Fatalf("expected audit log to contain %s, got:\n%s", want, logText)
			}
		}
	})
}
