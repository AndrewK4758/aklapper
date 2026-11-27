package portalapi_e2e_test

import (
	"context"
	"errors"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func assertPGDenied(t *testing.T, err error, desc string) {
	t.Helper()
	if err == nil {
		t.Fatalf("expected PostgreSQL permission/RLS denial (SQLSTATE 42501) for %s, but query succeeded", desc)
	}
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != "42501" {
		t.Fatalf("expected SQLSTATE 42501 for %s, got: %v", desc, err)
	}
}

func TestPortalAppPostgreSQLPrivilegeAndRLSBoundaries(t *testing.T) {
	portalDSN := requirePortalDatabaseURL(t)
	ctx := context.Background()

	conn, err := pgx.Connect(ctx, portalDSN)
	if err != nil {
		t.Fatalf("connect as portal_app: %v", err)
	}
	defer conn.Close(ctx)

	var currentUser string
	if err := conn.QueryRow(ctx, `SELECT current_user`).Scan(&currentUser); err != nil {
		t.Fatalf("select current_user: %v", err)
	}
	if currentUser != "portal_app" {
		t.Fatalf("expected PORTAL_DATABASE_URL to authenticate as portal_app, got %q", currentUser)
	}

	// 1. Restricted tables must deny SELECT with SQLSTATE 42501.
	deniedSelects := []string{
		"users",
		"webauthn_credentials",
		"totp_secrets",
		"auth_sessions",
		"webauthn_challenges",
		"sandbox_runs",
		"sandbox_turns",
		"ask_turns",
		"menu_items",
		"roadmap_milestones",
		"contact_submissions",
		"drizzle.__drizzle_migrations",
	}
	for _, tbl := range deniedSelects {
		t.Run("SELECT denied on "+tbl, func(t *testing.T) {
			var dummy int
			err := conn.QueryRow(ctx, "SELECT 1 FROM "+tbl+" LIMIT 1").Scan(&dummy)
			assertPGDenied(t, err, "SELECT on "+tbl)
		})
	}

	// 2. contact_submissions allows plain INSERT (no RETURNING) and denies RETURNING / UPDATE / DELETE.
	t.Run("contact_submissions INSERT-only without RETURNING", func(t *testing.T) {
		newID := contracts.NewUUIDv4()
		_, err := conn.Exec(
			ctx,
			`INSERT INTO contact_submissions (id, name, email, message) VALUES ($1::uuid, 'Grace Hopper', 'grace@navy.mil', 'Plain insert with zero RETURNING clause.')`,
			newID,
		)
		if err != nil {
			t.Fatalf("expected plain INSERT on contact_submissions to succeed for portal_app, got: %v", err)
		}

		var returnedID string
		err = conn.QueryRow(
			ctx,
			`INSERT INTO contact_submissions (id, name, email, message) VALUES ($1::uuid, 'Grace Hopper', 'grace@navy.mil', 'Returning clause must be rejected.') RETURNING id`,
			contracts.NewUUIDv4(),
		).Scan(&returnedID)
		assertPGDenied(t, err, "INSERT ... RETURNING on contact_submissions")

		_, err = conn.Exec(ctx, `UPDATE contact_submissions SET name = 'Mutated' WHERE id = $1::uuid`, newID)
		assertPGDenied(t, err, "UPDATE on contact_submissions")

		_, err = conn.Exec(ctx, `DELETE FROM contact_submissions WHERE id = $1::uuid`, newID)
		assertPGDenied(t, err, "DELETE on contact_submissions")
	})

	// 3. DDL and destructive DELETE denied.
	t.Run("DDL and DELETE denied on public schema tables", func(t *testing.T) {
		_, err := conn.Exec(ctx, `CREATE TABLE public.portal_unauthorized_ddl (id int)`)
		assertPGDenied(t, err, "CREATE TABLE in public schema")

		_, err = conn.Exec(ctx, `DELETE FROM agensi_skills WHERE slug = 'nonexistent'`)
		assertPGDenied(t, err, "DELETE on agensi_skills")

		_, err = conn.Exec(ctx, `DELETE FROM analytics_events WHERE id = -1`)
		assertPGDenied(t, err, "DELETE on analytics_events")
	})

	// 4. rate_limit_buckets RLS enforces strict scope_key prefix isolation.
	t.Run("rate_limit_buckets RLS permits contact:ip:* and analytics:ip:* while denying auth:*, global:*, session:*", func(t *testing.T) {
		for _, allowedKey := range []string{"contact:ip:e2e-rls-check", "analytics:ip:e2e-rls-check"} {
			var turns int
			err := conn.QueryRow(
				ctx,
				`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
				 VALUES ($1, NOW(), 1, 0)
				 ON CONFLICT (scope_key) DO UPDATE SET turns_used = rate_limit_buckets.turns_used + 1
				 RETURNING turns_used`,
				allowedKey,
			).Scan(&turns)
			if err != nil || turns < 1 {
				t.Fatalf("expected RLS upsert allowed for %q, got turns=%d err=%v", allowedKey, turns, err)
			}
		}

		for _, deniedKey := range []string{"auth:login:attacker", "global:ask", "session:guest:attacker"} {
			_, err := conn.Exec(
				ctx,
				`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
				 VALUES ($1, NOW(), 1, 0)`,
				deniedKey,
			)
			assertPGDenied(t, err, "INSERT rate_limit_buckets with scope_key="+deniedKey)
		}

		// SELECT on rate_limit_buckets only exposes contact:ip:*, analytics:ip:*, global:*, session:* (never auth:*).
		var authCount int
		if err := conn.QueryRow(ctx, `SELECT COUNT(*) FROM rate_limit_buckets WHERE scope_key LIKE 'auth:%'`).Scan(&authCount); err != nil {
			t.Fatalf("select count rate_limit_buckets: %v", err)
		}
		if authCount != 0 {
			t.Fatalf("expected 0 auth:* rows visible to portal_app, got %d", authCount)
		}
	})
}
