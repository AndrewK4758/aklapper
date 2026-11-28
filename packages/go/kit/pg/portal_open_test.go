package pg

import (
	"context"
	"errors"
	"testing"
)

func TestOpenPortalServiceFromEnvFailClosedInProductionAndLazyPool(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("PORTAL_DATABASE_URL", "")
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:5439/aklapper?sslmode=disable")

	if _, err := OpenPortalServiceFromEnv(context.Background()); !errors.Is(err, ErrPortalDatabaseURLMissing) {
		t.Fatalf("expected ErrPortalDatabaseURLMissing in production when PORTAL_DATABASE_URL unset, got %v", err)
	}

	t.Setenv("PORTAL_DATABASE_URL", "postgres://portal_app:pass@127.0.0.1:5439/aklapper?sslmode=disable")
	t.Setenv("PG_MAX_CONNS", "3")
	store, err := OpenPortalServiceFromEnv(context.Background())
	if err != nil {
		t.Fatalf("expected lazy pool open without eager ping to succeed, got %v", err)
	}
	defer store.Close()

	if !store.IsLivePG() {
		t.Fatal("expected live pgxpool configured on store")
	}
	cfg := store.pool.Config()
	if cfg.MinConns != 0 || cfg.MaxConns != 3 || cfg.MaxConnIdleTime != DefaultPortalMaxConnIdle {
		t.Fatalf("unexpected lazy pool config: MinConns=%d MaxConns=%d MaxConnIdleTime=%v",
			cfg.MinConns, cfg.MaxConns, cfg.MaxConnIdleTime)
	}
}
