package main

import (
	"context"
	"errors"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type askGRPCServer struct {
	ai_askv1.UnimplementedAskServiceServer
	deps askStreamDeps
}

func newAskGRPCServer(deps askStreamDeps) *askGRPCServer {
	return &askGRPCServer{deps: deps}
}

type grpcStreamEmitter struct {
	stream grpc.ServerStreamingServer[ai_askv1.AskStreamChunk]
}

func toProtoSources(sources []contracts.AskSource) []*ai_askv1.AskSource {
	out := make([]*ai_askv1.AskSource, 0, len(sources))
	for _, s := range sources {
		out = append(out, &ai_askv1.AskSource{
			Id:       s.ID,
			Title:    s.Title,
			Snippet:  s.Snippet,
			Score:    s.Score,
			Category: s.Category,
		})
	}
	return out
}

func toProtoQuota(q *contracts.QuotaStatus) *ai_askv1.QuotaStatus {
	if q == nil {
		return nil
	}
	return &ai_askv1.QuotaStatus{
		Role:       q.Role,
		TurnsUsed:  int32(q.TurnsUsed),
		MaxTurns:   int32(q.MaxTurns),
		TokensUsed: int32(q.TokensUsed),
		MaxTokens:  int32(q.MaxTokens),
	}
}

func toProtoError(e *contracts.PublicAppError) *ai_askv1.PublicAppError {
	if e == nil {
		return nil
	}
	return &ai_askv1.PublicAppError{
		Code:          e.Code,
		Status:        int32(e.Status),
		Message:       e.Message,
		Action:        e.Action,
		CorrelationId: e.CorrelationID,
	}
}

func (e *grpcStreamEmitter) EmitStatus(_, _ string) error {
	return nil
}

func (e *grpcStreamEmitter) EmitPreambleDelta(_ string) error {
	return nil
}

func (e *grpcStreamEmitter) EmitPreambleError(_ contracts.PublicAppError) error {
	return nil
}

func (e *grpcStreamEmitter) SupportsPreamble() bool {
	return false
}

func (e *grpcStreamEmitter) EmitMeta(meta askStreamMeta) error {
	return e.stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Meta{
			Meta: &ai_askv1.AskStreamMeta{
				AttemptId:     meta.AttemptID,
				CorrelationId: meta.CorrelationID,
				Mode:          meta.Mode,
				Provider:      meta.Provider,
				Model:         meta.Model,
			},
		},
	})
}

func (e *grpcStreamEmitter) EmitSources(sources []contracts.AskSource) error {
	return e.stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Sources{
			Sources: &ai_askv1.AskStreamSources{Sources: toProtoSources(sources)},
		},
	})
}

func (e *grpcStreamEmitter) EmitDelta(text string) error {
	return e.stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Delta{
			Delta: &ai_askv1.AskStreamDelta{Text: text},
		},
	})
}

func (e *grpcStreamEmitter) EmitDone(done askStreamDone) error {
	return e.stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Done{
			Done: &ai_askv1.AskStreamDone{
				AttemptId:      done.AttemptID,
				Grounded:       done.Grounded,
				Abstained:      done.Abstained,
				Answer:         done.Answer,
				Provider:       done.Provider,
				Model:          done.Model,
				TokensUsed:     int32(done.TokensUsed),
				UsageEstimated: done.UsageEstimated,
				LatencyMs:      int32(done.LatencyMs),
				Quota:          toProtoQuota(done.Quota),
				CorrelationId:  done.CorrelationID,
			},
		},
	})
}

func (e *grpcStreamEmitter) EmitError(pubErr contracts.PublicAppError, quota *contracts.QuotaStatus) error {
	return e.stream.Send(&ai_askv1.AskStreamChunk{
		Payload: &ai_askv1.AskStreamChunk_Error{
			Error: &ai_askv1.AskStreamError{
				Error: toProtoError(&pubErr),
				Quota: toProtoQuota(quota),
			},
		},
	})
}

func (s *askGRPCServer) StreamAsk(
	req *ai_askv1.StreamAskRequest,
	stream grpc.ServerStreamingServer[ai_askv1.AskStreamChunk],
) error {
	ctx := stream.Context()
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return status.Error(codes.Unauthenticated, "signed x-internal-auth metadata required")
	}
	corrID := grpckit.CorrelationIDFromContext(ctx)
	if corrID == "" {
		corrID = newUUIDv4()
	}

	syncFail := executeStreamingTurn(ctx, s.deps, askStreamInput{
		Mode:          req.GetMode(),
		Question:      req.GetQuestion(),
		AttemptID:     req.GetAttemptId(),
		SessionID:     claims.Sub,
		Role:          claims.Role,
		CorrelationID: corrID,
	}, func() (streamEmitter, func(), error) {
		return &grpcStreamEmitter{stream: stream}, nil, nil
	})
	if syncFail != nil {
		return status.Error(syncFail.GRPCCode, syncFail.Error.Message)
	}
	return nil
}

func (s *askGRPCServer) GetAskStatus(ctx context.Context, _ *ai_askv1.GetAskStatusRequest) (*ai_askv1.GetAskStatusResponse, error) {
	if _, ok := grpckit.ClaimsFromContext(ctx); !ok {
		return nil, status.Error(codes.Unauthenticated, "signed x-internal-auth metadata required")
	}
	if err := s.deps.store.Ping(ctx); err != nil {
		return nil, status.Error(codes.Unavailable, "database temporarily unavailable")
	}
	info, qErr := s.deps.vectorStore.CollectionInfo(ctx, portfolioCollection)
	if qErr != nil {
		return &ai_askv1.GetAskStatusResponse{
			Status:      "degraded",
			Provider:    s.deps.provider.Name(),
			PgConnected: s.deps.store.IsLivePG(),
			Collection: &ai_askv1.AskCollectionStatus{
				Name:        portfolioCollection,
				Status:      "unreachable",
				PointsCount: 0,
			},
		}, nil
	}
	return &ai_askv1.GetAskStatusResponse{
		Status:      "ready",
		Provider:    s.deps.provider.Name(),
		PgConnected: s.deps.store.IsLivePG(),
		Collection: &ai_askv1.AskCollectionStatus{
			Name:        portfolioCollection,
			Status:      info.Status,
			PointsCount: int32(info.PointsCount),
			VectorSize:  int32(info.VectorSize),
		},
	}, nil
}

func (s *askGRPCServer) GetTurn(ctx context.Context, req *ai_askv1.GetTurnRequest) (*ai_askv1.GetTurnResponse, error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, status.Error(codes.Unauthenticated, "signed x-internal-auth metadata required")
	}
	attemptID := strings.TrimSpace(req.GetAttemptId())
	if !contracts.ValidateUUID(attemptID) {
		return nil, status.Error(codes.InvalidArgument, "invalid attemptId")
	}
	rec, quota, err := s.deps.store.GetTurnByAttemptID(ctx, attemptID, claims.Sub)
	if errors.Is(err, pg.ErrTurnNotFound) {
		return nil, status.Error(codes.NotFound, "turn not found")
	}
	if err != nil {
		return nil, status.Error(codes.Unavailable, "database temporarily unavailable")
	}
	state := rec.ToState(&quota)
	resp := &ai_askv1.GetTurnResponse{
		AttemptId:      state.AttemptID,
		Status:         state.Status,
		Mode:           state.Mode,
		CorrelationId:  state.CorrelationID,
		LeaseExpiresAt: state.LeaseExpiresAt,
		ExpiresAt:      state.ExpiresAt,
		Quota:          toProtoQuota(state.Quota),
		Error:          toProtoError(state.Error),
	}
	if state.Response != nil {
		var matchScore *int32
		if state.Response.MatchScore != nil {
			v := int32(*state.Response.MatchScore)
			matchScore = &v
		}
		resp.Response = &ai_askv1.AskResponse{
			AttemptId:     state.Response.AttemptID,
			Grounded:      state.Response.Grounded,
			Abstained:     state.Response.Abstained,
			Mode:          state.Response.Mode,
			Answer:        state.Response.Answer,
			Sources:       toProtoSources(state.Response.Sources),
			MatchScore:    matchScore,
			Strengths:     state.Response.Strengths,
			Gaps:          state.Response.Gaps,
			Provider:      state.Response.Provider,
			Model:         state.Response.Model,
			TokensUsed:    int32(state.Response.TokensUsed),
			LatencyMs:     int32(state.Response.LatencyMs),
			CorrelationId: state.Response.CorrelationID,
			Quota:         toProtoQuota(state.Response.Quota),
		}
	}
	return resp, nil
}
