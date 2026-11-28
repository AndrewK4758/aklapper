package main

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	adminv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1"
	ai_askv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/ai_ask/v1/ai_askv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func fetchCloudRunIdentityToken(ctx context.Context, audience string) string {
	if strings.TrimSpace(os.Getenv("K_SERVICE")) == "" {
		return ""
	}
	endpoint := "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=" + url.QueryEscape(audience)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Metadata-Flavor", "Google")
	c := &http.Client{Timeout: 1500 * time.Millisecond}
	resp, err := c.Do(req)
	if err != nil || resp == nil {
		return ""
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
	return strings.TrimSpace(string(body))
}

func probeQdrantCollectionDirect(ctx context.Context, qdrantURL, apiKey, name string) *adminv1.QdrantCollectionHealth {
	client := &qdrant.Client{
		BaseURL:    strings.TrimRight(qdrantURL, "/"),
		APIKey:     apiKey,
		HTTPClient: &http.Client{Timeout: 2500 * time.Millisecond},
	}
	info, err := client.CollectionInfo(ctx, name)
	if err != nil {
		isAuth := strings.Contains(err.Error(), "status 401") || strings.Contains(err.Error(), "status 403")
		if isAuth || strings.Contains(err.Error(), "status 404") {
			logAdminSeam("BOUNDARY_FAULT", "admin.qdrant_probe.auth_or_collection", map[string]any{
				"collection": name,
				"reason":     err.Error(),
			})
		}
		st := "offline"
		if isAuth {
			st = "error"
		}
		return &adminv1.QdrantCollectionHealth{Name: name, Online: false, Status: st, PointsCount: 0}
	}
	st := info.Status
	if st == "" {
		st = "green"
	}
	if info.PointsCount == 0 {
		st = "degraded"
	}
	return &adminv1.QdrantCollectionHealth{Name: name, Online: true, Status: st, PointsCount: int32(info.PointsCount)}
}

func (s *adminOpsServiceServer) GetQdrantStatus(
	ctx context.Context,
	req *connect.Request[adminv1.GetQdrantStatusRequest],
) (*connect.Response[adminv1.GetQdrantStatusResponse], error) {
	corrID := resolveCorrID(ctx)
	if _, err := s.deps.requireAdminAuth(ctx, req.Header(), ""); err != nil {
		return nil, err
	}
	aiAskURL := strings.TrimRight(strings.TrimSpace(os.Getenv("AI_ASK_URL")), "/")
	qdrantURL := strings.TrimRight(strings.TrimSpace(os.Getenv("QDRANT_URL")), "/")
	qdrantKey := strings.TrimSpace(os.Getenv("QDRANT_API_KEY"))

	probeCtx, cancel := context.WithTimeout(ctx, 2500*time.Millisecond)
	defer cancel()

	if aiAskURL != "" {
		httpClient := grpckit.NewH2CClient()
		if strings.HasPrefix(aiAskURL, "https://") {
			httpClient = &http.Client{Timeout: 2500 * time.Millisecond}
		}
		askClient := ai_askv1connect.NewAskServiceClient(httpClient, aiAskURL, connect.WithGRPC())
		askReq := connect.NewRequest(&ai_askv1.GetAskStatusRequest{})
		askReq.Header().Set(grpckit.MetadataCorrelationID, corrID)
		if tok, err := internalauth.Sign(internalauth.RoleAdmin, "admin-console-status", 60*time.Second, ""); err == nil {
			askReq.Header().Set(grpckit.MetadataInternalAuth, tok)
		}
		if strings.HasPrefix(aiAskURL, "https://") {
			if u, pErr := url.Parse(aiAskURL); pErr == nil {
				if idTok := fetchCloudRunIdentityToken(probeCtx, u.Scheme+"://"+u.Host); idTok != "" {
					askReq.Header().Set("Authorization", "Bearer "+idTok)
				}
			}
		}
		if res, err := askClient.GetAskStatus(probeCtx, askReq); err == nil && res != nil {
			col := res.Msg.GetCollection()
			provider := strings.TrimSpace(res.Msg.GetProvider())
			if provider == "" {
				provider = "dual-provider"
			}
			rawStatus := res.Msg.GetStatus()
			colName := "portfolio_docs"
			pts := int32(0)
			if col != nil {
				if col.GetName() != "" {
					colName = col.GetName()
				}
				if col.GetStatus() != "" {
					rawStatus = col.GetStatus()
				}
				pts = col.GetPointsCount()
			}
			bad := rawStatus == "degraded" || rawStatus == "unreachable" || rawStatus == "offline" || rawStatus == "error" ||
				res.Msg.GetStatus() == "degraded" || res.Msg.GetStatus() == "unreachable" || res.Msg.GetStatus() == "offline" || res.Msg.GetStatus() == "error"
			online := !bad
			st := rawStatus
			if online && pts == 0 {
				st = "degraded"
			}
			portfolio := &adminv1.QdrantCollectionHealth{Name: colName, Online: online, Status: st, PointsCount: pts}
			collections := []*adminv1.QdrantCollectionHealth{portfolio}
			if qdrantURL != "" {
				collections = append(collections, probeQdrantCollectionDirect(probeCtx, qdrantURL, qdrantKey, "cadence_patterns"))
			}
			detail := fmt.Sprintf("Connected via ai-ask (%s).", provider)
			if !online {
				detail = fmt.Sprintf("ai-ask reported Qdrant %s (%s).", st, provider)
			} else if pts == 0 {
				detail = fmt.Sprintf("Connected via ai-ask (%s) with 0 indexed points.", provider)
			}
			return connect.NewResponse(&adminv1.GetQdrantStatusResponse{
				Online: online, Collection: portfolio.Name, Status: portfolio.Status, PointsCount: portfolio.PointsCount,
				Provider: provider, Detail: &detail, Collections: collections,
			}), nil
		}
	}

	if qdrantURL == "" {
		st := "unconfigured"
		detail := "AI_ASK_URL and QDRANT_URL not configured."
		if aiAskURL != "" {
			st = "offline"
			detail = "ai-ask status endpoint unreachable."
		}
		return connect.NewResponse(&adminv1.GetQdrantStatusResponse{
			Online: false, Collection: "portfolio_docs", Status: st, PointsCount: 0, Provider: "unconfigured", Detail: &detail,
		}), nil
	}

	portfolio := probeQdrantCollectionDirect(probeCtx, qdrantURL, qdrantKey, "portfolio_docs")
	cadence := probeQdrantCollectionDirect(probeCtx, qdrantURL, qdrantKey, "cadence_patterns")
	detail := "Direct Qdrant collection probe healthy."
	if !portfolio.Online {
		detail = "Qdrant collection probe unavailable."
		if portfolio.Status == "error" {
			detail = "Qdrant authentication failed."
		}
	} else if portfolio.PointsCount == 0 {
		detail = "Direct Qdrant collection online with 0 indexed points."
	}
	return connect.NewResponse(&adminv1.GetQdrantStatusResponse{
		Online: portfolio.Online, Collection: portfolio.Name, Status: portfolio.Status, PointsCount: portfolio.PointsCount,
		Provider: "qdrant-direct", Detail: &detail, Collections: []*adminv1.QdrantCollectionHealth{portfolio, cadence},
	}), nil
}
