package main

import (
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
)

func optionalPositiveInt32(v int) *int32 {
	if v <= 0 {
		return nil
	}
	out := int32(v)
	return &out
}

func optionalInt32Ptr(v *int) *int32 {
	if v == nil {
		return nil
	}
	out := int32(*v)
	return &out
}

func optionalNonNegInt32(v int) *int32 {
	if v < 0 {
		return nil
	}
	out := int32(v)
	return &out
}

func toProtoSources(sources []contracts.AskSource) []*ai_askv1.AskSource {
	out := make([]*ai_askv1.AskSource, 0, len(sources))
	for _, s := range sources {
		out = append(out, &ai_askv1.AskSource{
			Id:             s.ID,
			Title:          s.Title,
			Snippet:        s.Snippet,
			Score:          s.Score,
			Category:       s.Category,
			SectionHeading: s.SectionHeading,
			DocKey:         s.DocKey,
		})
	}
	return out
}

func toProtoSuggestedLinks(links []contracts.AskSuggestedLink) []*ai_askv1.AskSuggestedLink {
	if len(links) == 0 {
		return nil
	}
	out := make([]*ai_askv1.AskSuggestedLink, 0, len(links))
	for _, l := range links {
		out = append(out, &ai_askv1.AskSuggestedLink{
			Route:  l.Route,
			Label:  l.Label,
			Reason: l.Reason,
		})
	}
	return out
}

func toProtoAskResponse(r *contracts.AskResponse) *ai_askv1.AskResponse {
	if r == nil {
		return nil
	}
	return &ai_askv1.AskResponse{
		AttemptId:         r.AttemptID,
		Grounded:          r.Grounded,
		Abstained:         r.Abstained,
		Mode:              r.Mode,
		Answer:            r.Answer,
		Sources:           toProtoSources(r.Sources),
		MatchScore:        optionalInt32Ptr(r.MatchScore),
		Strengths:         r.Strengths,
		Gaps:              r.Gaps,
		Provider:          r.Provider,
		Model:             r.Model,
		TokensUsed:        int32(r.TokensUsed),
		LatencyMs:         optionalNonNegInt32(r.LatencyMs),
		CorrelationId:     r.CorrelationID,
		Quota:             grpckit.ToProtoQuota(r.Quota),
		ConversationId:    r.ConversationID,
		TurnIndex:         optionalPositiveInt32(r.TurnIndex),
		GroundingTier:     r.GroundingTier,
		SuggestedLinks:    toProtoSuggestedLinks(r.SuggestedLinks),
		FollowUpQuestions: r.FollowUpQuestions,
	}
}

func toProtoAskTurnState(state contracts.AskTurnState) *ai_askv1.AskTurnState {
	return &ai_askv1.AskTurnState{
		AttemptId:      state.AttemptID,
		Status:         state.Status,
		Mode:           state.Mode,
		CorrelationId:  state.CorrelationID,
		LeaseExpiresAt: state.LeaseExpiresAt,
		ExpiresAt:      state.ExpiresAt,
		Quota:          grpckit.ToProtoQuota(state.Quota),
		Response:       toProtoAskResponse(state.Response),
		Error:          grpckit.ToProtoPublicError(state.Error),
		ConversationId: state.ConversationID,
		TurnIndex:      optionalPositiveInt32(state.TurnIndex),
	}
}

func toProtoGetTurnResponse(state contracts.AskTurnState) *ai_askv1.GetTurnResponse {
	return &ai_askv1.GetTurnResponse{
		AttemptId:      state.AttemptID,
		Status:         state.Status,
		Mode:           state.Mode,
		CorrelationId:  state.CorrelationID,
		LeaseExpiresAt: state.LeaseExpiresAt,
		ExpiresAt:      state.ExpiresAt,
		Quota:          grpckit.ToProtoQuota(state.Quota),
		Response:       toProtoAskResponse(state.Response),
		Error:          grpckit.ToProtoPublicError(state.Error),
		ConversationId: state.ConversationID,
		TurnIndex:      optionalPositiveInt32(state.TurnIndex),
	}
}
