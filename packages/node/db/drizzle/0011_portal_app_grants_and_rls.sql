DO $$
DECLARE
	v_can_create_role boolean;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
		SELECT (rolsuper OR rolcreaterole)
		INTO v_can_create_role
		FROM pg_roles
		WHERE rolname = current_user;

		IF COALESCE(v_can_create_role, false) THEN
			CREATE ROLE "portal_app" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
		ELSE
			RAISE EXCEPTION
				'PostgreSQL role "portal_app" does not exist and current role "%" lacks CREATEROLE/SUPERUSER. Provision role "portal_app" out-of-band (via db:provision-portal-role or superuser bootstrap) before running migration 0011_portal_app_grants_and_rls.',
				current_user;
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "portal_app";
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "portal_app";
--> statement-breakpoint
REVOKE ALL ON SCHEMA "public" FROM "portal_app";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.schemata
		WHERE schema_name = 'drizzle'
	) THEN
		EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "drizzle" FROM "portal_app"';
		EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "drizzle" FROM "portal_app"';
		EXECUTE 'REVOKE ALL ON SCHEMA "drizzle" FROM "portal_app"';
	END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "public" TO "portal_app";
--> statement-breakpoint
GRANT SELECT ON TABLE
	"public"."site_content",
	"public"."terminal_profiles",
	"public"."terminal_initial_entries",
	"public"."terminal_commands",
	"public"."terminal_directory_entries",
	"public"."career_dossiers",
	"public"."cadence_presets",
	"public"."quota_policies"
TO "portal_app";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE
	"public"."agensi_skills",
	"public"."agensi_sync_state",
	"public"."analytics_sessions",
	"public"."rate_limit_buckets"
TO "portal_app";
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "public"."analytics_events" TO "portal_app";
--> statement-breakpoint
GRANT USAGE, SELECT ON SEQUENCE "public"."analytics_events_id_seq" TO "portal_app";
--> statement-breakpoint
GRANT INSERT ON TABLE "public"."contact_submissions" TO "portal_app";
--> statement-breakpoint
ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'rate_limit_buckets'
			AND policyname = 'rate_limit_buckets_portal_select'
	) THEN
		CREATE POLICY "rate_limit_buckets_portal_select"
			ON "public"."rate_limit_buckets"
			FOR SELECT
			TO "portal_app"
			USING (
				"scope_key" LIKE 'session:%'
				OR "scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	ELSE
		ALTER POLICY "rate_limit_buckets_portal_select"
			ON "public"."rate_limit_buckets"
			TO "portal_app"
			USING (
				"scope_key" LIKE 'session:%'
				OR "scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'rate_limit_buckets'
			AND policyname = 'rate_limit_buckets_portal_insert'
	) THEN
		CREATE POLICY "rate_limit_buckets_portal_insert"
			ON "public"."rate_limit_buckets"
			FOR INSERT
			TO "portal_app"
			WITH CHECK (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	ELSE
		ALTER POLICY "rate_limit_buckets_portal_insert"
			ON "public"."rate_limit_buckets"
			TO "portal_app"
			WITH CHECK (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_policies
		WHERE schemaname = 'public'
			AND tablename = 'rate_limit_buckets'
			AND policyname = 'rate_limit_buckets_portal_update'
	) THEN
		CREATE POLICY "rate_limit_buckets_portal_update"
			ON "public"."rate_limit_buckets"
			FOR UPDATE
			TO "portal_app"
			USING (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			)
			WITH CHECK (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	ELSE
		ALTER POLICY "rate_limit_buckets_portal_update"
			ON "public"."rate_limit_buckets"
			TO "portal_app"
			USING (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			)
			WITH CHECK (
				"scope_key" LIKE 'contact:ip:%'
				OR "scope_key" LIKE 'analytics:ip:%'
			);
	END IF;
END
$$;
