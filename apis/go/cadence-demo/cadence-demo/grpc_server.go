package main

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	cadencev1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/cadence/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type cadenceServiceDeps struct {
	provider    llm.Provider
	vectorStore *qdrant.Client
	store       *pg.Store
	privacyCfg  *privacy.Config
}

type cadenceGRPCServer struct {
	cadencev1.UnimplementedCadenceServiceServer
	deps cadenceServiceDeps
}

func newCadenceGRPCServer(deps cadenceServiceDeps) *cadenceGRPCServer {
	return &cadenceGRPCServer{deps: deps}
}

func (s *cadenceGRPCServer) StreamRun(
	req *cadencev1.StreamRunRequest,
	stream grpc.ServerStreamingServer[cadencev1.StreamRunResponse],
) error {
	ctx := stream.Context()
	claims, ok := grpckit.ClaimsFromContext(ctx)
	if !ok || claims == nil {
		return status.Error(codes.Unauthenticated, "signed x-internal-auth metadata required")
	}

	prompt := strings.TrimSpace(req.GetPrompt())
	if len(prompt) < 4 || len(prompt) > 1200 {
		return status.Error(codes.InvalidArgument, "prompt must be between 4 and 1200 characters")
	}
	presetSlug := nonEmptyOr(req.GetPresetSlug(), "custom")
	sessionID := strings.TrimSpace(claims.Sub)
	if sessionID == "" {
		sessionID = "anonymous"
	}
	role := contracts.RoleGuest
	if claims.Role == contracts.RoleAdmin {
		role = contracts.RoleAdmin
	}
	corrID := grpckit.CorrelationIDFromContext(ctx)
	mode := contracts.CadenceModeFast

	// 1. Pre-quota scoped prompt_hash cache check.
	cacheRes, cacheErr := resolveCacheLookupAndClone(ctx, s.deps.store, sessionID, "grpc-internal", presetSlug, mode, prompt)
	if cacheErr == nil && cacheRes.Hit && cacheRes.ClonedRun != nil {
		run := cacheRes.ClonedRun
		for _, turn := range run.Turns {
			if err := stream.Send(&cadencev1.StreamRunResponse{
				Payload: &cadencev1.StreamRunResponse_Phase{
					Phase: &cadencev1.CadencePhaseEvent{
						RunId:     run.RunID,
						Phase:     turn.Phase,
						AgentName: turn.AgentName,
						Status:    turn.Status,
						Summary:   turn.Summary,
						LatencyMs: int32(turn.LatencyMs),
					},
				},
			}); err != nil {
				return err
			}
		}
		return stream.Send(&cadencev1.StreamRunResponse{
			Payload: &cadencev1.StreamRunResponse_Done{
				Done: &cadencev1.CadenceDoneEvent{
					RunId:        run.RunID,
					Status:       run.Status,
					GateVerdict:  run.GateVerdict,
					TokensIn:     0,
					TokensOut:    0,
					ArtifactHtml: run.ArtifactHTML,
				},
			},
		})
	}

	// 2. Atomic pending run + quota reserve.
	pendingRun, _, allowed, initErr := s.deps.store.CreatePendingSandboxRunWithQuota(
		ctx,
		role,
		sessionID,
		1,
		800,
		pg.PendingSandboxRunInput{
			SessionID:  sessionID,
			IPHash:     "grpc-internal",
			PresetSlug: presetSlug,
			Prompt:     prompt,
			Mode:       mode,
			PromptHash: cacheRes.PromptHash,
		},
	)
	if initErr != nil {
		return status.Error(codes.Unavailable, "failed to initialize sandbox run")
	}
	if !allowed {
		return status.Error(codes.ResourceExhausted, "session or daily CADENCE quota exceeded")
	}

	if _, claimed, claimErr := s.deps.store.ClaimPendingSandboxRun(ctx, pendingRun.RunID, sessionID); claimErr != nil || !claimed {
		return status.Error(codes.Internal, "failed to claim pending sandbox run")
	}

	workCtx, workCancel := context.WithTimeout(ctx, 15*time.Second)
	defer workCancel()

	out, execErr := executeChordStepsWithOptions(workCtx, chordExecInput{
		Provider:    s.deps.provider,
		VectorStore: s.deps.vectorStore,
		Store:       s.deps.store,
		PrivacyCfg:  s.deps.privacyCfg,
		CorrID:      corrID,
		RunID:       pendingRun.RunID,
		Prompt:      prompt,
		PresetSlug:  presetSlug,
		Mode:        mode,
		OnPhase: func(turn contracts.CadenceTurn, _ string, _ int) {
			_ = stream.Send(&cadencev1.StreamRunResponse{
				Payload: &cadencev1.StreamRunResponse_Phase{
					Phase: &cadencev1.CadencePhaseEvent{
						RunId:     pendingRun.RunID,
						Phase:     turn.Phase,
						AgentName: turn.AgentName,
						Status:    turn.Status,
						Summary:   turn.Summary,
						LatencyMs: int32(turn.LatencyMs),
					},
				},
			})
		},
		OnLog: func(line string) {
			_ = stream.Send(&cadencev1.StreamRunResponse{
				Payload: &cadencev1.StreamRunResponse_Delta{
					Delta: &cadencev1.CadenceDeltaEvent{
						RunId: pendingRun.RunID,
						Phase: "build",
						Text:  line,
					},
				},
			})
		},
	})
	if execErr != nil {
		failCtx, failCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer failCancel()
		if errors.Is(execErr, context.Canceled) {
			_, _ = s.deps.store.RefundSandboxRunQuotaTx(failCtx, pendingRun.RunID)
			return status.Error(codes.Canceled, "stream cancelled")
		}
		_ = s.deps.store.FailSandboxRun(failCtx, pendingRun.RunID, "CHORD execution failed")
		if errors.Is(execErr, privacy.ErrPrivacyAborted) {
			return status.Error(codes.PermissionDenied, "output blocked by privacy boundary")
		}
		return status.Error(codes.Internal, "CHORD execution failed")
	}

	commitCtx, commitCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer commitCancel()
	completed, compErr := s.deps.store.CompleteSandboxRunWithArtifacts(commitCtx, pg.CompleteSandboxRunInput{
		RunID:         pendingRun.RunID,
		TokensIn:      out.TokensIn,
		TokensOut:     out.TokensOut,
		ArtifactHTML:  out.ArtifactHTML,
		ExecutionMode: out.ExecutionMode,
		SpecJSON:      out.Spec,
		GateAuditJSON: out.GateAudit,
		PromptHash:    cacheRes.PromptHash,
	})
	if compErr != nil {
		_ = s.deps.store.FailSandboxRun(commitCtx, pendingRun.RunID, "failed to commit completed run")
		return status.Error(codes.Internal, "failed to commit completed run")
	}

	return stream.Send(&cadencev1.StreamRunResponse{
		Payload: &cadencev1.StreamRunResponse_Done{
			Done: &cadencev1.CadenceDoneEvent{
				RunId:        completed.RunID,
				Status:       completed.Status,
				GateVerdict:  completed.GateVerdict,
				TokensIn:     int32(completed.TokensIn),
				TokensOut:    int32(completed.TokensOut),
				ArtifactHtml: completed.ArtifactHTML,
			},
		},
	})
}
