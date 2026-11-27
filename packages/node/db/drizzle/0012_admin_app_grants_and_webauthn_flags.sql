ALTER TABLE "public"."webauthn_credentials" ADD COLUMN IF NOT EXISTS "backup_eligible" boolean;
--> statement-breakpoint
ALTER TABLE "public"."webauthn_credentials" ADD COLUMN IF NOT EXISTS "backup_state" boolean;
--> statement-breakpoint
DO $$
DECLARE
	v_can_create_role boolean;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_app') THEN
		SELECT (rolsuper OR rolcreaterole)
		INTO v_can_create_role
		FROM pg_roles
		WHERE rolname = current_user;

		IF COALESCE(v_can_create_role, false) THEN
			CREATE ROLE "admin_app" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
		ELSE
			RAISE EXCEPTION
				'PostgreSQL role "admin_app" does not exist and current role "%" lacks CREATEROLE/SUPERUSER. Provision role "admin_app" out-of-band (via db:provision-admin-role or superuser bootstrap) before running migration 0012_admin_app_grants_and_webauthn_flags.',
				current_user;
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "admin_app";
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "admin_app";
--> statement-breakpoint
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM "admin_app";
--> statement-breakpoint
REVOKE ALL ON SCHEMA "public" FROM "admin_app";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.schemata
		WHERE schema_name = 'drizzle'
	) THEN
		EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "drizzle" FROM "admin_app"';
		EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "drizzle" FROM "admin_app"';
		EXECUTE 'REVOKE ALL ON SCHEMA "drizzle" FROM "admin_app"';
	END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "admin_app";
--> statement-breakpoint
GRANT SELECT ON TABLE
	"public"."users",
	"public"."sandbox_turns",
	"public"."ask_turns"
TO "admin_app";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
	"public"."webauthn_credentials",
	"public"."auth_sessions",
	"public"."webauthn_challenges",
	"public"."quota_policies",
	"public"."site_content",
	"public"."terminal_profiles",
	"public"."agensi_skills",
	"public"."agensi_sync_state",
	"public"."analytics_sessions"
TO "admin_app";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
	"public"."totp_secrets",
	"public"."rate_limit_buckets",
	"public"."menu_items",
	"public"."terminal_commands",
	"public"."terminal_initial_entries",
	"public"."terminal_directory_entries",
	"public"."cadence_presets",
	"public"."career_dossiers"
TO "admin_app";
--> statement-breakpoint
GRANT SELECT, DELETE ON TABLE "public"."contact_submissions" TO "admin_app";
--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE "public"."sandbox_runs" TO "admin_app";
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "public"."analytics_events" TO "admin_app";
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE
	"public"."terminal_commands_id_seq",
	"public"."terminal_initial_entries_id_seq",
	"public"."terminal_directory_entries_id_seq",
	"public"."analytics_events_id_seq"
TO "admin_app";
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."career_dossiers_refresh_search_tsv"() TO "admin_app";
--> statement-breakpoint
DROP POLICY IF EXISTS "rate_limit_buckets_admin_all" ON "public"."rate_limit_buckets";
--> statement-breakpoint
CREATE POLICY "rate_limit_buckets_admin_all"
	ON "public"."rate_limit_buckets"
	FOR ALL
	TO "admin_app"
	USING (true)
	WITH CHECK (true);
