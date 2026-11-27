DROP POLICY IF EXISTS "rate_limit_buckets_admin_all" ON "public"."rate_limit_buckets";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_app') THEN
		EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "admin_app"';
		EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "admin_app"';
		EXECUTE 'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "public" FROM "admin_app"';
		EXECUTE 'REVOKE ALL ON SCHEMA "public" FROM "admin_app"';
		IF EXISTS (
			SELECT 1
			FROM information_schema.schemata
			WHERE schema_name = 'drizzle'
		) THEN
			EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "drizzle" FROM "admin_app"';
			EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "drizzle" FROM "admin_app"';
			EXECUTE 'REVOKE ALL ON SCHEMA "drizzle" FROM "admin_app"';
		END IF;
	END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."webauthn_credentials" DROP COLUMN IF EXISTS "backup_state";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."webauthn_credentials" DROP COLUMN IF EXISTS "backup_eligible";
