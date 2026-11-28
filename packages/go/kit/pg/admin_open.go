package pg

import (
	"context"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DefaultAdminMaxConns    = 2
	DefaultAdminMaxConnIdle = 2 * time.Minute
)

var ErrAdminDatabaseURLMissing = errors.New("ADMIN_DATABASE_URL is required in production")

// Pool returns the underlying pgxpool handle (nil when running in-memory).
func (s *Store) Pool() *pgxpool.Pool {
	if s == nil {
		return nil
	}
	return s.pool
}

// OpenAdminServiceFromEnv opens a lazy MinConns=0 PostgreSQL 19 pool for admin-api using
// ADMIN_DATABASE_URL (bound to least-privilege role admin_app). Production fails closed if
// ADMIN_DATABASE_URL is unset; non-production may fall back to DATABASE_URL or in-memory test mode.
func OpenAdminServiceFromEnv(ctx context.Context) (*Store, error) {
	isProd := internalauth.IsProductionEnv()
	if !isProd && strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true") {
		return NewMemoryStore(), nil
	}

	dsn := strings.TrimSpace(os.Getenv("ADMIN_DATABASE_URL"))
	if dsn == "" {
		if isProd {
			return nil, ErrAdminDatabaseURLMissing
		}
		dsn = strings.TrimSpace(os.Getenv("DATABASE_URL"))
		if dsn == "" {
			return nil, ErrAdminDatabaseURLMissing
		}
	}

	maxConns, err := parsePositiveMaxConns(DefaultAdminMaxConns)
	if err != nil {
		return nil, err
	}
	return openLazyPoolWithIdle(ctx, dsn, maxConns, DefaultAdminMaxConnIdle, false)
}

func openLazyPoolWithIdle(
	ctx context.Context,
	dsn string,
	maxConns int,
	maxConnIdle time.Duration,
	verifyPing bool,
) (*Store, error) {
	if err := ValidateDSN(dsn); err != nil {
		return nil, err
	}
	poolCfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("PostgreSQL connection URI could not be parsed by pgxpool")
	}
	if maxConns <= 0 {
		maxConns = DefaultAdminMaxConns
	}
	poolCfg.MinConns = 0
	poolCfg.MaxConns = int32(maxConns)
	poolCfg.MaxConnIdleTime = maxConnIdle

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
