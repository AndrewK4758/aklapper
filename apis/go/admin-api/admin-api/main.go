package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/admin/v1/adminv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/grpckit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

const adminGRPCMaxReadBytes = 8 * 1024 * 1024

type adminServiceDeps struct {
	store            *pg.Store
	adminSecret      string
	totpKey          string
	dailySalt        string
	argon2           *Argon2Verifier
	agensiHTTPClient *http.Client
	nowFn            func() time.Time
}

func (d adminServiceDeps) now() time.Time {
	if d.nowFn != nil {
		return d.nowFn().UTC()
	}
	return time.Now().UTC()
}

// validateProductionAdminStartupConfig fails closed before binding sockets whenever a required
// production secret or database connection string is missing.
func validateProductionAdminStartupConfig() error {
	if !internalauth.IsProductionEnv() {
		return nil
	}
	required := []string{
		"ADMIN_DATABASE_URL",
		"ADMIN_INTERNAL_AUTH_SECRET",
		"TOTP_ENCRYPTION_KEY",
		"ANALYTICS_DAILY_SALT",
	}
	missing := make([]string, 0, len(required))
	for _, envKey := range required {
		if strings.TrimSpace(os.Getenv(envKey)) == "" {
			missing = append(missing, envKey)
		}
	}
	if len(missing) > 0 {
		logAdminSeam("UNSOUND_CONDITION", "admin_api.startup.secret_missing", map[string]any{
			"missingEnv": missing,
			"reason":     "required production configuration missing",
		})
		return fmt.Errorf("missing required production admin-api environment variables: %s", strings.Join(missing, ", "))
	}
	return nil
}

func buildAdminMux(deps adminServiceDeps) *http.ServeMux {
	if deps.argon2 == nil {
		deps.argon2 = NewArgon2Verifier(maxConcurrentArgon2)
	}
	mux := http.NewServeMux()
	writeHealth := func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ok":          true,
			"status":      "ok",
			"service":     "admin-api",
			"time":        time.Now().UTC().Format(time.RFC3339),
			"pgConnected": deps.store != nil && deps.store.Pool() != nil,
		})
	}
	mux.HandleFunc("/health", writeHealth)
	mux.HandleFunc("/healthz", writeHealth)

	healthPath, healthHandler := grpckit.NewHealthHandlerWithSecret(
		deps.adminSecret,
		adminv1connect.AdminAuthServiceName,
		adminv1connect.AdminCmsServiceName,
		adminv1connect.AdminInboxServiceName,
		adminv1connect.AdminAnalyticsServiceName,
		adminv1connect.AdminQuotasServiceName,
		adminv1connect.AdminOpsServiceName,
	)
	mux.Handle(healthPath, healthHandler)

	opts := append(grpckit.NewHandlerOptions(deps.adminSecret), connect.WithReadMaxBytes(adminGRPCMaxReadBytes))

	authPath, authHandler := adminv1connect.NewAdminAuthServiceHandler(newAdminAuthServiceServer(deps), opts...)
	mux.Handle(authPath, grpckit.NewGRPCOnlyMiddleware(authHandler))

	cmsPath, cmsHandler := adminv1connect.NewAdminCmsServiceHandler(newAdminCmsServiceServer(deps), opts...)
	mux.Handle(cmsPath, grpckit.NewGRPCOnlyMiddleware(cmsHandler))

	inboxPath, inboxHandler := adminv1connect.NewAdminInboxServiceHandler(newAdminInboxServiceServer(deps), opts...)
	mux.Handle(inboxPath, grpckit.NewGRPCOnlyMiddleware(inboxHandler))

	analyticsPath, analyticsHandler := adminv1connect.NewAdminAnalyticsServiceHandler(newAdminAnalyticsServiceServer(deps), opts...)
	mux.Handle(analyticsPath, grpckit.NewGRPCOnlyMiddleware(analyticsHandler))

	quotasPath, quotasHandler := adminv1connect.NewAdminQuotasServiceHandler(newAdminQuotasServiceServer(deps), opts...)
	mux.Handle(quotasPath, grpckit.NewGRPCOnlyMiddleware(quotasHandler))

	opsPath, opsHandler := adminv1connect.NewAdminOpsServiceHandler(newAdminOpsServiceServer(deps), opts...)
	mux.Handle(opsPath, grpckit.NewGRPCOnlyMiddleware(opsHandler))

	return mux
}

func main() {
	if err := validateProductionAdminStartupConfig(); err != nil {
		log.Fatalf("[admin-api] startup failed: %v", err)
	}
	adminSecret, err := internalauth.ResolveAdminSecret("")
	if err != nil {
		log.Fatalf("[admin-api] ADMIN_INTERNAL_AUTH_SECRET resolution failed: %v", err)
	}
	if _, err := ResolveTotpEncryptionKey(""); err != nil {
		log.Fatalf("[admin-api] TOTP_ENCRYPTION_KEY resolution failed: %v", err)
	}
	dailySalt, err := analytics.ResolveDailySaltSecret("")
	if err != nil {
		log.Fatalf("[admin-api] ANALYTICS_DAILY_SALT resolution failed: %v", err)
	}

	rootCtx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	store, err := pg.OpenAdminServiceFromEnv(rootCtx)
	if err != nil {
		log.Fatalf("[admin-api] database initialization failed: %v", err)
	}
	defer store.Close()

	deps := adminServiceDeps{
		store:       store,
		adminSecret: adminSecret,
		totpKey:     strings.TrimSpace(os.Getenv("TOTP_ENCRYPTION_KEY")),
		dailySalt:   dailySalt,
		argon2:      NewArgon2Verifier(maxConcurrentArgon2),
	}

	port := strings.TrimSpace(os.Getenv("PORT"))
	if port == "" {
		port = "8085"
	}
	srv := httpkit.NewH2CServer(":"+port, buildAdminMux(deps), rootCtx)
	log.Printf("[admin-api] listening on :%s (h2c gRPC)", port)

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.ListenAndServe()
	}()

	select {
	case <-rootCtx.Done():
		shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutCtx)
	case serveErr := <-errCh:
		if serveErr != nil && !errors.Is(serveErr, http.ErrServerClosed) {
			log.Fatalf("[admin-api] server exited: %v", serveErr)
		}
	}
}
