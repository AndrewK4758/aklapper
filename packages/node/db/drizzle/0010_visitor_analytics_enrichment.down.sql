DROP INDEX IF EXISTS "ask_turns_created_at_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "ask_turns_session_created_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "contact_submissions_guest_session_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "contact_submissions_analytics_session_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_sessions_geo_started_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_sessions_referrer_host_started_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_sessions_guest_session_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_sessions_visitor_hash_started_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_sessions_app_bot_started_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_events_type_created_path_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "analytics_events_session_created_idx";
--> statement-breakpoint
ALTER TABLE IF EXISTS "contact_submissions" DROP CONSTRAINT IF EXISTS "contact_submissions_analytics_session_id_fk";
--> statement-breakpoint
ALTER TABLE IF EXISTS "contact_submissions" DROP COLUMN IF EXISTS "guest_session_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "contact_submissions" DROP COLUMN IF EXISTS "analytics_session_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "last_seen_at";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "browser_name";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "os_name";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "device_type";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "utm_content";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "utm_campaign";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "utm_medium";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "utm_source";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "ref_param";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "landing_path";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "referrer_category";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "referrer_host";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "asn_org";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "asn";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "timezone";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "city";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "guest_session_id";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "visitor_hash";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "is_bot";
--> statement-breakpoint
ALTER TABLE IF EXISTS "analytics_sessions" DROP COLUMN IF EXISTS "app";
