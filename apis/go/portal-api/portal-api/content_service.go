package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type contentServiceServer struct {
	deps portalServiceDeps
}

var _ portalv1connect.PortalContentServiceHandler = (*contentServiceServer)(nil)

func newContentServiceServer(deps portalServiceDeps) *contentServiceServer {
	return &contentServiceServer{deps: deps}
}

func extractContactFormJSON(contactContentJSON string) (string, error) {
	var envelope struct {
		Form json.RawMessage `json:"form"`
	}
	if err := json.Unmarshal([]byte(contactContentJSON), &envelope); err != nil {
		return "", err
	}
	if len(envelope.Form) == 0 {
		return "", pg.ErrSiteContentMissing
	}
	return string(envelope.Form), nil
}

func extractBrandContactEmail(chromeJSON string) *string {
	var chrome struct {
		BrandContactEmail string `json:"brandContactEmail"`
	}
	if err := json.Unmarshal([]byte(chromeJSON), &chrome); err != nil {
		return nil
	}
	trimmed := strings.TrimSpace(chrome.BrandContactEmail)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *contentServiceServer) loadHomeBundle(
	ctx context.Context,
	corrID string,
) (string, *portalv1.TerminalProfileData, string, error) {
	homeJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-home")
	if err != nil {
		return "", nil, "", mapStoreErrorToConnect(err, corrID)
	}
	terminal, err := s.deps.store.LoadTerminalProfile(ctx, pg.PortalHomeTerminalSlug)
	if err != nil {
		return "", nil, "", mapStoreErrorToConnect(err, corrID)
	}
	contactJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-contact")
	if err != nil {
		return "", nil, "", mapStoreErrorToConnect(err, corrID)
	}
	formJSON, err := extractContactFormJSON(contactJSON)
	if err != nil {
		return "", nil, "", mapStoreErrorToConnect(err, corrID)
	}
	return homeJSON, toProtoTerminalProfile(terminal), formJSON, nil
}

func (s *contentServiceServer) GetRootContent(
	ctx context.Context,
	_ *connect.Request[portalv1.GetRootContentRequest],
) (*connect.Response[portalv1.GetRootContentResponse], error) {
	corrID := resolveCorrID(ctx)
	chromeJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-chrome")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	homeJSON, terminal, formJSON, err := s.loadHomeBundle(ctx, corrID)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&portalv1.GetRootContentResponse{
		ChromeJson:      chromeJSON,
		HomeContentJson: homeJSON,
		Terminal:        terminal,
		ContactFormJson: formJSON,
	}), nil
}

func (s *contentServiceServer) GetHomeContent(
	ctx context.Context,
	_ *connect.Request[portalv1.GetHomeContentRequest],
) (*connect.Response[portalv1.GetHomeContentResponse], error) {
	corrID := resolveCorrID(ctx)
	homeJSON, terminal, formJSON, err := s.loadHomeBundle(ctx, corrID)
	if err != nil {
		return nil, err
	}
	return connect.NewResponse(&portalv1.GetHomeContentResponse{
		ContentJson:     homeJSON,
		Terminal:        terminal,
		ContactFormJson: formJSON,
	}), nil
}

func (s *contentServiceServer) GetAboutContent(
	ctx context.Context,
	_ *connect.Request[portalv1.GetAboutContentRequest],
) (*connect.Response[portalv1.GetAboutContentResponse], error) {
	corrID := resolveCorrID(ctx)
	aboutJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-about")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	dossiers, err := s.deps.store.ListPublishedPortalCareerDossiers(ctx)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	chromeJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-chrome")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}

	branch := "empty_dossiers_degraded"
	if len(dossiers) > 0 {
		branch = "postgres_live"
	}
	logPortalSeam("RULE_DIVERGENCE", "portal.about.loader_source_branch", map[string]any{
		"branch":        branch,
		"dossierCount":  len(dossiers),
		"correlationId": corrID,
	})

	protoDossiers := make([]*portalv1.CareerDossier, 0, len(dossiers))
	for _, d := range dossiers {
		protoDossiers = append(protoDossiers, toProtoCareerDossier(d))
	}
	return connect.NewResponse(&portalv1.GetAboutContentResponse{
		ContentJson:       aboutJSON,
		Dossiers:          protoDossiers,
		BrandContactEmail: extractBrandContactEmail(chromeJSON),
	}), nil
}

func (s *contentServiceServer) GetAskContent(
	ctx context.Context,
	req *connect.Request[portalv1.GetAskContentRequest],
) (*connect.Response[portalv1.GetAskContentResponse], error) {
	corrID := resolveCorrID(ctx)
	askJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-ask")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	sessionID := strings.TrimSpace(req.Msg.GetSessionId())
	if sessionID == "" {
		if claims, ok := grpckit.ClaimsFromContext(ctx); ok && claims != nil && claims.Role == internalauth.RoleGuest {
			sessionID = strings.TrimSpace(claims.Sub)
		}
	}
	quota, err := s.deps.store.GetPortalGuestQuota(ctx, sessionID)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	return connect.NewResponse(&portalv1.GetAskContentResponse{
		ContentJson: askJSON,
		Quota:       grpckit.ToProtoQuota(&quota),
	}), nil
}

func (s *contentServiceServer) GetCadenceContent(
	ctx context.Context,
	_ *connect.Request[portalv1.GetCadenceContentRequest],
) (*connect.Response[portalv1.GetCadenceContentResponse], error) {
	corrID := resolveCorrID(ctx)
	cadenceJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-cadence")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	presets, err := s.deps.store.ListPortalCadencePresets(ctx)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	if len(presets) == 0 {
		return nil, newPortalError(
			connect.CodeFailedPrecondition,
			contracts.ErrCodeInternal,
			http.StatusInternalServerError,
			"Unexpected server error.",
			"Retry or share the reference ID.",
			corrID,
			nil,
			nil,
		)
	}
	protoPresets := make([]*portalv1.CadencePreset, 0, len(presets))
	for _, p := range presets {
		protoPresets = append(protoPresets, toProtoCadencePreset(p))
	}
	return connect.NewResponse(&portalv1.GetCadenceContentResponse{
		ContentJson: cadenceJSON,
		Presets:     protoPresets,
	}), nil
}

func (s *contentServiceServer) GetContactContent(
	ctx context.Context,
	_ *connect.Request[portalv1.GetContactContentRequest],
) (*connect.Response[portalv1.GetContactContentResponse], error) {
	corrID := resolveCorrID(ctx)
	contactJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-contact")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	return connect.NewResponse(&portalv1.GetContactContentResponse{
		ContentJson: contactJSON,
	}), nil
}
