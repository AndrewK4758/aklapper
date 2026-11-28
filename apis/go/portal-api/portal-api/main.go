package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/geoip"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const (
	analyticsMaxReadBytes = 256 * 1024
	contactMaxReadBytes   = 8 * 1024 * 1024
)

type portalServiceDeps struct {
	store             *pg.Store
	geoReader         *geoip.Reader
	explicitSecret    string
	explicitDailySalt string
	agensiHTTPClient  *http.Client
	nowFn             func() time.Time
}

func (d portalServiceDeps) now() time.Time {
	if d.nowFn != nil {
		return d.nowFn().UTC()
	}
	return time.Now().UTC()
}

func newHandler(deps portalServiceDeps) http.Handler {
	if deps.store == nil {
		deps.store = pg.NewMemoryStore()
	}
	if deps.geoReader == nil {
		deps.geoReader = geoip.NewReader("", nil)
	}

	mux := http.NewServeMux()
	healthHandler := httpkit.NewHealthHandler("portal-api")
	mux.HandleFunc("GET /health", healthHandler)
	mux.HandleFunc("GET /healthz", healthHandler)

	grpcHealthPath, grpcHealthHandler := grpckit.NewHealthHandler(
		"portal.v1.PortalContentService",
		"portal.v1.AgensiService",
		"portal.v1.AnalyticsService",
		"portal.v1.ContactService",
	)
	mux.Handle(grpcHealthPath, grpcHealthHandler)

	baseOpts := grpckit.NewHandlerOptions(deps.explicitSecret)

	contentPath, contentHandler := portalv1connect.NewPortalContentServiceHandler(
		newContentServiceServer(deps),
		baseOpts...,
	)
	mux.Handle(contentPath, grpckit.NewGRPCOnlyMiddleware(contentHandler))

	agensiPath, agensiHandler := portalv1connect.NewAgensiServiceHandler(
		newAgensiServiceServer(deps),
		baseOpts...,
	)
	mux.Handle(agensiPath, grpckit.NewGRPCOnlyMiddleware(agensiHandler))

	analyticsOpts := append(append([]connect.HandlerOption(nil), baseOpts...), connect.WithReadMaxBytes(analyticsMaxReadBytes))
	analyticsPath, analyticsHandler := portalv1connect.NewAnalyticsServiceHandler(
		newAnalyticsServiceServer(deps),
		analyticsOpts...,
	)
	mux.Handle(analyticsPath, grpckit.NewGRPCOnlyMiddleware(analyticsHandler))

	contactOpts := append(append([]connect.HandlerOption(nil), baseOpts...), connect.WithReadMaxBytes(contactMaxReadBytes))
	contactPath, contactHandler := portalv1connect.NewContactServiceHandler(
		newContactServiceServer(deps),
		contactOpts...,
	)
	mux.Handle(contactPath, grpckit.NewGRPCOnlyMiddleware(contactHandler))

	return mux
}

func validateStartupConfig() (string, error) {
	missing := make([]string, 0, 3)
	if _, err := internalauth.ResolveSecret(""); err != nil {
		missing = append(missing, "INTERNAL_AUTH_SECRET")
	}
	dailySalt, saltErr := analytics.ResolveDailySaltSecret("")
	if saltErr != nil {
		missing = append(missing, "ANALYTICS_DAILY_SALT")
	}
	if internalauth.IsProductionEnv() && strings.TrimSpace(os.Getenv("PORTAL_DATABASE_URL")) == "" {
		missing = append(missing, "PORTAL_DATABASE_URL")
	}
	if len(missing) > 0 {
		logPortalSeam("UNSOUND_CONDITION", "portal_api.startup.config_missing", map[string]any{
			"service": "portal-api",
			"missing": missing,
		})
		return "", pg.ErrPortalDatabaseURLMissing
	}
	return dailySalt, nil
}

func main() {
	dailySalt, err := validateStartupConfig()
	if err != nil {
		log.Fatalf("portal-api startup config validation failed: %v", err)
	}

	store, err := pg.OpenPortalServiceFromEnv(context.Background())
	if err != nil {
		logPortalSeam("UNSOUND_CONDITION", "portal_api.startup.config_missing", map[string]any{
			"service": "portal-api",
			"reason":  "database_pool_init_failed",
		})
		log.Fatalf("portal-api failed to initialize PostgreSQL pool: %v", err)
	}
	defer store.Close()

	geoReader := geoip.NewReader("", nil)
	defer func() { _ = geoReader.Close() }()

	handler := newHandler(portalServiceDeps{
		store:             store,
		geoReader:         geoReader,
		explicitDailySalt: dailySalt,
	})

	addr := httpkit.ListenAddr("8084")
	log.Printf("portal-api listening on single-port h2c=%s (pgLive=%v)", addr, store.IsLivePG())

	if err := httpkit.ListenAndServeH2CGracefulSignals(addr, handler, 10*time.Second); err != nil {
		log.Fatal(err)
	}
}
