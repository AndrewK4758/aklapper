ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "app" text DEFAULT 'portal' NOT NULL;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "is_bot" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "visitor_hash" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "guest_session_id" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "city" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "timezone" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "asn" integer;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "asn_org" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "referrer_host" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "referrer_category" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "landing_path" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "ref_param" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "utm_source" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "utm_medium" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "utm_campaign" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "utm_content" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "device_type" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "os_name" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "browser_name" text;
--> statement-breakpoint
ALTER TABLE "analytics_sessions" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN IF NOT EXISTS "analytics_session_id" text;
--> statement-breakpoint
ALTER TABLE "contact_submissions" ADD COLUMN IF NOT EXISTS "guest_session_id" text;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'contact_submissions_analytics_session_id_fk'
			AND conrelid = '"contact_submissions"'::regclass
	) THEN
		ALTER TABLE "contact_submissions"
			ADD CONSTRAINT "contact_submissions_analytics_session_id_fk"
			FOREIGN KEY ("analytics_session_id")
			REFERENCES "analytics_sessions"("session_id")
			ON DELETE SET NULL
			ON UPDATE NO ACTION;
	END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_session_created_idx" ON "analytics_events" USING btree ("session_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_events_type_created_path_idx" ON "analytics_events" USING btree ("type","created_at" DESC,"path");
--> statement-breakpoint
UPDATE "analytics_sessions" AS s
SET "app" = 'admin'
WHERE s."app" = 'portal'
	AND EXISTS (
		SELECT 1
		FROM "analytics_events" AS e
		WHERE e."session_id" = s."session_id"
			AND e."metadata_json"->>'app' = 'admin'
	);
--> statement-breakpoint
UPDATE "analytics_sessions"
SET "last_seen_at" = "started_at"
WHERE "last_seen_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_app_bot_started_idx" ON "analytics_sessions" USING btree ("app","is_bot","started_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_hash_started_idx" ON "analytics_sessions" USING btree ("app","visitor_hash","started_at" DESC) WHERE "visitor_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_guest_session_idx" ON "analytics_sessions" USING btree ("guest_session_id","started_at" DESC) WHERE "guest_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_referrer_host_started_idx" ON "analytics_sessions" USING btree ("referrer_host","started_at" DESC) WHERE "referrer_host" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "analytics_sessions_geo_started_idx" ON "analytics_sessions" USING btree ("country","region","started_at" DESC) WHERE "country" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_submissions_analytics_session_idx" ON "contact_submissions" USING btree ("analytics_session_id") WHERE "analytics_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_submissions_guest_session_idx" ON "contact_submissions" USING btree ("guest_session_id") WHERE "guest_session_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_turns_session_created_idx" ON "ask_turns" USING btree ("session_id","created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_turns_created_at_idx" ON "ask_turns" USING btree ("created_at" DESC);
