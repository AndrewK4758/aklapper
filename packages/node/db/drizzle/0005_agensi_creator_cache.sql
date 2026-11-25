CREATE TABLE IF NOT EXISTS "agensi_sync_state" (
	"creator_handle" text PRIMARY KEY NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_status" text DEFAULT 'idle' NOT NULL,
	"last_error" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"etag" text
);
--> statement-breakpoint
ALTER TABLE "agensi_skills" ADD COLUMN IF NOT EXISTS "creator_handle" text;--> statement-breakpoint
ALTER TABLE "agensi_skills" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agensi_skills" ADD COLUMN IF NOT EXISTS "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agensi_skills" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'seed' NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agensi_skills_creator_published_sort_idx" ON "agensi_skills" USING btree ("creator_handle","is_published","sort_order","slug");
