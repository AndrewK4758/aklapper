package main

import (
	"sync"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
)

type connectStreamEmitter struct {
	mu     sync.Mutex
	stream *connect.ServerStream[ai_askv1.AskStreamChunk]
}

func (e *connectStreamEmitter) send(chunk *ai_askv1.AskStreamChunk) error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.stream.Send(chunk)
}

func (e *connectStreamEmitter) EmitStatus(stage, label string) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Status{
			Status: &ai_askv1.AskStreamStatus{
				Stage: stage,
				Label: label,
			},
		},
	})
}

func (e *connectStreamEmitter) EmitMeta(meta askStreamMeta) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Meta{
			Meta: &ai_askv1.AskStreamMeta{
				AttemptId:      meta.AttemptID,
				CorrelationId:  meta.CorrelationID,
				Mode:           meta.Mode,
				Provider:       meta.Provider,
				Model:          meta.Model,
				ConversationId: meta.ConversationID,
				TurnIndex:      optionalPositiveInt32(meta.TurnIndex),
			},
		},
	})
}

func (e *connectStreamEmitter) EmitPreambleDelta(text string) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Preamble{
			Preamble: &ai_askv1.AskStreamPreamble{Text: text},
		},
	})
}

func (e *connectStreamEmitter) EmitPreambleError(pubErr contracts.PublicAppError) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_PreambleError{
			PreambleError: &ai_askv1.AskStreamPreambleError{
				Code:          pubErr.Code,
				Message:       pubErr.Message,
				Action:        pubErr.Action,
				CorrelationId: pubErr.CorrelationID,
			},
		},
	})
}

func (e *connectStreamEmitter) SupportsPreamble() bool {
	return true
}

func (e *connectStreamEmitter) EmitSources(sources []contracts.AskSource) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Sources{
			Sources: &ai_askv1.AskStreamSources{Sources: toProtoSources(sources)},
		},
	})
}

func (e *connectStreamEmitter) EmitDelta(text string) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Delta{
			Delta: &ai_askv1.AskStreamDelta{Text: text},
		},
	})
}

func (e *connectStreamEmitter) EmitDone(done askStreamDone) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Done{
			Done: &ai_askv1.AskStreamDone{
				AttemptId:         done.AttemptID,
				Grounded:          done.Grounded,
				Abstained:         done.Abstained,
				Answer:            done.Answer,
				Provider:          done.Provider,
				Model:             done.Model,
				TokensUsed:        int32(done.TokensUsed),
				UsageEstimated:    done.UsageEstimated,
				LatencyMs:         optionalNonNegInt32(done.LatencyMs),
				Quota:             grpckit.ToProtoQuota(done.Quota),
				CorrelationId:     done.CorrelationID,
				ConversationId:    done.ConversationID,
				TurnIndex:         optionalPositiveInt32(done.TurnIndex),
				GroundingTier:     done.GroundingTier,
				SuggestedLinks:    toProtoSuggestedLinks(done.SuggestedLinks),
				FollowUpQuestions: done.FollowUpQuestions,
			},
		},
	})
}

func (e *connectStreamEmitter) EmitError(pubErr contracts.PublicAppError, quota *contracts.QuotaStatus) error {
	return e.send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Error{
			Error: &ai_askv1.AskStreamError{
				Error: grpckit.ToProtoPublicError(&pubErr),
				Quota: grpckit.ToProtoQuota(quota),
			},
		},
	})
}
