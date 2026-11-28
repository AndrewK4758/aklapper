package main

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1/ai_askv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type askConnectServer struct {
	deps     askStreamDeps
	syncWait time.Duration
}

var _ ai_askv1connect.AskServiceHandler = (*askConnectServer)(nil)

func newAskConnectServer(deps askStreamDeps, syncWait time.Duration) *askConnectServer {
	if syncWait <= 0 {
		syncWait = defaultSyncWaitWindow
	}
	return &askConnectServer{deps: deps, syncWait: syncWait}
}

func resolveConnectCorrelationID(ctx context.Context) string {
	if corrID := grpckit.CorrelationIDFromContext(ctx); corrID != "" {
		return corrID
	}
	return contracts.NewUUIDv4()
}

func (s *askConnectServer) StreamAsk(
	ctx context.Context,
	req *connect.Request[ai_askv1.StreamAskRequest],
	stream *connect.ServerStream[ai_askv1.AskStreamChunk],
) error {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveConnectCorrelationID(ctx)

	syncFail := executeStreamingTurn(ctx, s.deps, askStreamInput{
		Mode:           req.Msg.GetMode(),
		Question:       req.Msg.GetQuestion(),
		AttemptID:      req.Msg.GetAttemptId(),
		ConversationID: req.Msg.GetConversationId(),
		VisitorLens:    req.Msg.GetVisitorLens(),
		SessionID:      claims.Sub,
		Role:           claims.Role,
		CorrelationID:  corrID,
	}, func() (streamEmitter, func(), error) {
		return &connectStreamEmitter{stream: stream}, nil, nil
	})
	if syncFail != nil {
		return grpckit.NewDetailedConnectError(
			syncFail.GRPCCode,
			grpckit.ToProtoPublicError(&syncFail.Error),
			grpckit.ToProtoQuota(syncFail.Quota),
		)
	}
	return nil
}

func (s *askConnectServer) Ask(
	ctx context.Context,
	req *connect.Request[ai_askv1.AskRequest],
) (*connect.Response[ai_askv1.AskUnaryResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveConnectCorrelationID(ctx)

	out := executeUnaryAsk(ctx, unaryTurnDeps{
		provider:    s.deps.provider,
		vectorStore: s.deps.vectorStore,
		store:       s.deps.store,
		privacyCfg:  s.deps.privacyCfg,
		syncWait:    s.syncWait,
	}, unaryAskInput{
		Mode:           req.Msg.GetMode(),
		Question:       req.Msg.GetQuestion(),
		JobDescription: req.Msg.GetJobDescription(),
		AttemptID:      req.Msg.GetAttemptId(),
		ConversationID: req.Msg.GetConversationId(),
		VisitorLens:    req.Msg.GetVisitorLens(),
		SessionID:      claims.Sub,
		Role:           claims.Role,
		CorrelationID:  corrID,
	})
	if out.Err != nil {
		return nil, grpckit.NewDetailedConnectError(
			out.ConnectCode,
			grpckit.ToProtoPublicError(out.Err),
			grpckit.ToProtoQuota(out.Quota),
		)
	}
	if out.Response != nil {
		return connect.NewResponse(&ai_askv1.AskUnaryResponse{
			Outcome: &ai_askv1.AskUnaryResponse_Completed{
				Completed: toProtoAskResponse(out.Response),
			},
		}), nil
	}
	if out.Pending != nil {
		return connect.NewResponse(&ai_askv1.AskUnaryResponse{
			Outcome: &ai_askv1.AskUnaryResponse_Pending{
				Pending: toProtoAskTurnState(*out.Pending),
			},
		}), nil
	}
	return nil, grpckit.NewDetailedConnectError(
		connect.CodeCanceled,
		grpckit.ToProtoPublicError(&contracts.PublicAppError{
			Code:          contracts.ErrCodeStreamAborted,
			Status:        499,
			Message:       "Request cancelled early.",
			Action:        "Retry if you still need this view.",
			CorrelationID: corrID,
		}),
		nil,
	)
}

func (s *askConnectServer) GetAskStatus(
	ctx context.Context,
	_ *connect.Request[ai_askv1.GetAskStatusRequest],
) (*connect.Response[ai_askv1.GetAskStatusResponse], error) {
	if _, ok := grpckit.ClaimsFromContext(ctx); !ok {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveConnectCorrelationID(ctx)
	if err := s.deps.store.Ping(ctx); err != nil {
		logAskEvent("ai_ask.status.pg_unavailable", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
		return nil, grpckit.NewDetailedConnectError(
			connect.CodeUnavailable,
			grpckit.ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeDbUnavailable,
				Status:        http.StatusServiceUnavailable,
				Message:       "Database temporarily unavailable.",
				Action:        "Retry shortly or share ID.",
				CorrelationID: corrID,
			}),
			nil,
		)
	}
	info, qErr := s.deps.vectorStore.CollectionInfo(ctx, portfolioCollection)
	if qErr != nil {
		logAskEvent("ai_ask.status.qdrant_unavailable", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
		return connect.NewResponse(&ai_askv1.GetAskStatusResponse{
			Status:      "degraded",
			Provider:    s.deps.provider.Name(),
			PgConnected: s.deps.store.IsLivePG(),
			Collection: &ai_askv1.AskCollectionStatus{
				Name:        portfolioCollection,
				Status:      "unreachable",
				PointsCount: 0,
			},
		}), nil
	}
	return connect.NewResponse(&ai_askv1.GetAskStatusResponse{
		Status:      "ready",
		Provider:    s.deps.provider.Name(),
		PgConnected: s.deps.store.IsLivePG(),
		Collection: &ai_askv1.AskCollectionStatus{
			Name:        portfolioCollection,
			Status:      info.Status,
			PointsCount: int32(info.PointsCount),
			VectorSize:  int32(info.VectorSize),
		},
	}), nil
}

func (s *askConnectServer) GetTurn(
	ctx context.Context,
	req *connect.Request[ai_askv1.GetTurnRequest],
) (*connect.Response[ai_askv1.GetTurnResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveConnectCorrelationID(ctx)
	attemptID := strings.TrimSpace(req.Msg.GetAttemptId())
	if !contracts.ValidateUUID(attemptID) {
		return nil, grpckit.NewDetailedConnectError(
			connect.CodeInvalidArgument,
			grpckit.ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeValidation,
				Status:        http.StatusBadRequest,
				Message:       "Invalid attempt identifier.",
				Action:        "Refresh and submit again.",
				CorrelationID: corrID,
			}),
			nil,
		)
	}
	rec, quota, err := s.deps.store.GetTurnByAttemptID(ctx, attemptID, claims.Sub)
	if errors.Is(err, pg.ErrTurnNotFound) {
		return nil, grpckit.NewDetailedConnectError(
			connect.CodeNotFound,
			grpckit.ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeNotFound,
				Status:        http.StatusNotFound,
				Message:       "Resource could not be found.",
				Action:        "Verify the URL or return home.",
				CorrelationID: corrID,
			}),
			nil,
		)
	}
	if err != nil {
		return nil, grpckit.NewDetailedConnectError(
			connect.CodeUnavailable,
			grpckit.ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeDbUnavailable,
				Status:        http.StatusServiceUnavailable,
				Message:       "Database temporarily unavailable.",
				Action:        "Retry shortly or share ID.",
				CorrelationID: corrID,
			}),
			nil,
		)
	}
	return connect.NewResponse(toProtoGetTurnResponse(rec.ToState(&quota))), nil
}

func (s *askConnectServer) Reindex(
	ctx context.Context,
	_ *connect.Request[ai_askv1.ReindexRequest],
) (*connect.Response[ai_askv1.ReindexResponse], error) {
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("signed x-internal-auth metadata required"))
	}
	corrID := resolveConnectCorrelationID(ctx)
	if claims.Role != internalauth.RoleAdmin {
		logAskEvent("ai_ask.reindex.unauthorized_role", map[string]any{
			"seam_type":     "UNSOUND_CONDITION",
			"role":          claims.Role,
			"correlationId": corrID,
		})
		return nil, grpckit.NewDetailedConnectError(
			connect.CodePermissionDenied,
			grpckit.ToProtoPublicError(&contracts.PublicAppError{
				Code:          contracts.ErrCodeForbidden,
				Status:        http.StatusForbidden,
				Message:       "Permission denied for action.",
				Action:        "Return home or sign in again.",
				CorrelationID: corrID,
			}),
			nil,
		)
	}

	res, fail := executeReindex(ctx, s.deps.provider, s.deps.vectorStore, s.deps.store, corrID)
	if fail != nil {
		return nil, grpckit.NewDetailedConnectError(
			fail.ConnectCode,
			grpckit.ToProtoPublicError(&fail.Error),
			nil,
		)
	}
	return connect.NewResponse(&ai_askv1.ReindexResponse{
		Indexed:       int32(res.Indexed),
		Pruned:        int32(res.Pruned),
		Collection:    res.Collection,
		VectorSize:    int32(res.VectorSize),
		Provider:      res.Provider,
		CorrelationId: res.CorrelationID,
	}), nil
}
