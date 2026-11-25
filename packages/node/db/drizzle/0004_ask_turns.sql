CREATE TABLE IF NOT EXISTS "ask_turns" (
	"attempt_id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"mode" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"status" text NOT NULL,
	"tokens_reserved" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"result_json" jsonb,
	"error_code" text,
	"correlation_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_turns_session_expires_idx" ON "ask_turns" USING btree ("session_id","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_turns_status_lease_idx" ON "ask_turns" USING btree ("status","lease_expires_at");