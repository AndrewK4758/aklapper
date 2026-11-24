CREATE TABLE "agensi_skills" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"value" real,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"ip_hash" text NOT NULL,
	"referrer" text,
	"country" text,
	"region" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"role" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cadence_presets" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starter_prompt" text NOT NULL,
	"expected_kind" text NOT NULL,
	"starter_artifact_html" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"slug" text PRIMARY KEY NOT NULL,
	"key_shortcut" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"target_k8s_deploy" text,
	"namespace" text,
	"admin_only" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_policies" (
	"role" text PRIMARY KEY NOT NULL,
	"max_turns_per_session" integer NOT NULL,
	"max_tokens_per_run" integer NOT NULL,
	"max_daily_global_tokens" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"scope_key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"turns_used" integer DEFAULT 0 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmap_milestones" (
	"slug" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"ip_hash" text NOT NULL,
	"menu_slug" text NOT NULL,
	"prompt" text NOT NULL,
	"status" text NOT NULL,
	"gate_verdict" text DEFAULT 'pending' NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"artifact_html" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_turns" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"phase" text NOT NULL,
	"agent_name" text NOT NULL,
	"status" text NOT NULL,
	"payload_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"key" text PRIMARY KEY NOT NULL,
	"markdown_body" text NOT NULL,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_commands" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'static' NOT NULL,
	"output" text DEFAULT '' NOT NULL,
	"target_route" text,
	"allowed_routes" text[] DEFAULT '{}' NOT NULL,
	"error_template" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_initial_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_slug" text NOT NULL,
	"command" text NOT NULL,
	"output" text NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"duration_label" text NOT NULL,
	"timestamp_label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terminal_profiles" (
	"slug" text PRIMARY KEY NOT NULL,
	"banner_title" text NOT NULL,
	"banner_meta" text NOT NULL,
	"os_label" text DEFAULT '⚡' NOT NULL,
	"directory" text NOT NULL,
	"vcs_branch" text NOT NULL,
	"vcs_state" text DEFAULT 'clean' NOT NULL,
	"context_label" text NOT NULL,
	"placeholder" text NOT NULL,
	"quick_commands" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "totp_secrets" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"encrypted_secret" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"backup_codes_hash" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"role" text DEFAULT 'guest' NOT NULL,
	"password_hash_argon2" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"credential_id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"transports" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_analytics_sessions_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analytics_sessions"("session_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_turns" ADD CONSTRAINT "sandbox_turns_run_id_sandbox_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."sandbox_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_commands" ADD CONSTRAINT "terminal_commands_profile_slug_terminal_profiles_slug_fk" FOREIGN KEY ("profile_slug") REFERENCES "public"."terminal_profiles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "terminal_initial_entries" ADD CONSTRAINT "terminal_initial_entries_profile_slug_terminal_profiles_slug_fk" FOREIGN KEY ("profile_slug") REFERENCES "public"."terminal_profiles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "totp_secrets" ADD CONSTRAINT "totp_secrets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terminal_commands_profile_name_idx" ON "terminal_commands" USING btree ("profile_slug","name");--> statement-breakpoint
CREATE UNIQUE INDEX "terminal_initial_entries_profile_sort_idx" ON "terminal_initial_entries" USING btree ("profile_slug","sort_order");