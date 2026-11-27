package pg

import (
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DefaultPortalMaxConns      = 2
	DefaultPortalMaxConnIdle   = 30 * time.Second
	DefaultServiceLazyMaxConns = 2
)

var (
	ErrPortalDatabaseURLMissing = errors.New("PORTAL_DATABASE_URL is required in production")
)

func parsePositiveMaxConns(defaultMax int) (int, error) {
	if defaultMax <= 0 {
		defaultMax = DefaultPortalMaxConns
	}
	raw := strings.TrimSpace(os.Getenv("PG_MAX_CONNS"))
	if raw == "" {
		return defaultMax, nil
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed <= 0 {
		return 0, errors.New("PG_MAX_CONNS must be a positive integer")
	}
	return parsed, nil
}

func pingPoolOnce(ctx context.Context, pool *pgxpool.Pool) error {
	pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	return pool.Ping(pingCtx)
}

func pingPoolWithBackoff(ctx context.Context, pool *pgxpool.Pool, cfg Config) error {
	maxAttempts, baseInterval := resolveStartupRetryBudget(cfg)
	var err error
	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if err = pingPoolOnce(ctx, pool); err == nil {
			return nil
		}
		if attempt == maxAttempts {
			return err
		}
		delay := min(time.Duration(attempt)*baseInterval, 2*time.Second)
		if waitErr := waitWithContext(ctx, delay); waitErr != nil {
			return waitErr
		}
	}
	return err
}

func waitWithContext(ctx context.Context, d time.Duration) error {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

// OpenLazyPool creates a pgxpool-backed Store with MinConns=0 and MaxConnIdleTime=30s
// so scale-to-zero Cloud Run services hold zero idle PG19 sockets during cutover and idle periods.
func OpenLazyPool(ctx context.Context, dsn string, maxConns int, verifyPing bool) (*Store, error) {
	if err := ValidateDSN(dsn); err != nil {
		return nil, err
	}
	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("PostgreSQL connection URI could not be parsed by pgxpool")
	}
	if maxConns <= 0 {
		maxConns = DefaultPortalMaxConns
	}
	poolCfg.MinConns = 0
	poolCfg.MaxConns = int32(maxConns)
	poolCfg.MaxConnIdleTime = DefaultPortalMaxConnIdle

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, err
	}

	if verifyPing {
		if err := pingPoolWithBackoff(ctx, pool, Config{DatabaseURL: dsn, MaxConns: maxConns}); err != nil {
			pool.Close()
			return nil, err
		}
	}

	return &Store{
		pool:                pool,
		AgensiCreatorHandle: ResolveAgensiCreatorHandle(),
		policies:            defaultPolicies(),
		buckets:             make(map[string]*memBucket),
		turns:               make(map[string]*TurnRecord),
		dossiers:            make(map[string]CareerDossierRecord),
		runsByID:            make(map[string]*SandboxRun),
	}, nil
}

// OpenPortalServiceFromEnv opens a lazy MinConns=0 PostgreSQL 19 pool for portal-api using
// PORTAL_DATABASE_URL (bound to least-privilege role portal_app). Production fails closed if
// PORTAL_DATABASE_URL is unset; non-production may fall back to DATABASE_URL or in-memory test mode.
func OpenPortalServiceFromEnv(ctx context.Context) (*Store, error) {
	isProd := internalauth.IsProductionEnv()
	if !isProd && strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true") {
		return NewMemoryStore(), nil
	}

	dsn := strings.TrimSpace(os.Getenv("PORTAL_DATABASE_URL"))
	if dsn == "" {
		if isProd {
			return nil, ErrPortalDatabaseURLMissing
		}
		dsn = strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dsn == "" {
			return nil, ErrPortalDatabaseURLMissing
		}
	}

	maxConns, err := parsePositiveMaxConns(DefaultPortalMaxConns)
	if err != nil {
		return nil, err
	}
	// Do not eagerly open a live connection on startup so MinConns=0 holds zero idle sockets
	// during Wave 1 deployment before Wave 2 portal traffic cuts over.
	return OpenLazyPool(ctx, dsn, maxConns, false)
}

// OpenServiceFromEnvCapped opens a live or best-effort PostgreSQL pool capped at defaultMaxConns
// (unless PG_MAX_CONNS overrides it), with MinConns=0 and MaxConnIdleTime=30s to keep cluster
// connection ceilings within e2-micro PG19 max_connections=30.
func OpenServiceFromEnvCapped(ctx context.Context, defaultMaxConns int, strict bool) (*Store, error) {
	isProd := internalauth.IsProductionEnv()
	if !strict && !isProd && strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true") {
		return NewMemoryStore(), nil
	}
	dsn := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if dsn == "" {
		if strict || isProd {
			return nil, errors.New("DATABASE_URL is required (strict mode refuses default or in-memory fallback)")
		}
		dsn = DefaultDatabaseURL
	}
	maxConns, err := parsePositiveMaxConns(defaultMaxConns)
	if err != nil {
		return nil, err
	}
	store, err := OpenLazyPool(ctx, dsn, maxConns, true)
	if err != nil {
		if strict || isProd {
			return nil, err
		}
		mem := NewMemoryStore()
		mem.openErr = err
		return mem, nil
	}
	return store, nil
}
