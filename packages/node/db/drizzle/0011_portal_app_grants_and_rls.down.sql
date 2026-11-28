DROP POLICY IF EXISTS "rate_limit_buckets_portal_update" ON "public"."rate_limit_buckets";
--> statement-breakpoint
DROP POLICY IF EXISTS "rate_limit_buckets_portal_insert" ON "public"."rate_limit_buckets";
--> statement-breakpoint
DROP POLICY IF EXISTS "rate_limit_buckets_portal_select" ON "public"."rate_limit_buckets";
--> statement-breakpoint
ALTER TABLE IF EXISTS "public"."rate_limit_buckets" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
		EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM "portal_app"';
		EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM "portal_app"';
		EXECUTE 'REVOKE ALL ON SCHEMA "public" FROM "portal_app"';
		IF EXISTS (
			SELECT 1
			FROM information_schema.schemata
			WHERE schema_name = 'drizzle'
		) THEN
			EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "drizzle" FROM "portal_app"';
			EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA "drizzle" FROM "portal_app"';
			EXECUTE 'REVOKE ALL ON SCHEMA "drizzle" FROM "portal_app"';
		END IF;
	END IF;
END
$$;
