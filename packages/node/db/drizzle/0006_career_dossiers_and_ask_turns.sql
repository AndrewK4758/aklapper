CREATE TABLE IF NOT EXISTS "career_dossiers" (
	"slug" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"domain_label" text NOT NULL,
	"role_title" text NOT NULL,
	"timeframe" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"summary_body" text NOT NULL,
	"sections_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publish_status" text DEFAULT 'draft' NOT NULL,
	"sanitization_verified_at" timestamp with time zone,
	"denylist_hash" text,
	"search_tsv" tsvector DEFAULT ''::tsvector NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "career_dossiers_kind_check" CHECK (kind IN ('profile_core', 'experience', 'project', 'architecture', 'leadership')),
	CONSTRAINT "career_dossiers_publish_status_check" CHECK (publish_status IN ('draft', 'published')),
	CONSTRAINT "career_dossiers_published_verified_check" CHECK (publish_status = 'draft' OR sanitization_verified_at IS NOT NULL)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION career_dossiers_refresh_search_tsv()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	v_weight_a text;
	v_weight_b text;
	v_weight_c text;
	v_weight_d text;
BEGIN
	v_weight_a := COALESCE(NEW.title, '');
	v_weight_b := COALESCE(NEW.domain_label, '')
		|| ' '
		|| COALESCE(NEW.role_title, '')
		|| ' '
		|| COALESCE(array_to_string(COALESCE(NEW.skills, '{}'::text[]), ' '), '');
	v_weight_c := COALESCE(NEW.summary_body, '');
	v_weight_d := CASE
		WHEN jsonb_typeof(COALESCE(NEW.sections_json, '[]'::jsonb)) = 'array' THEN
			COALESCE(
				(
					SELECT string_agg(
						CASE
							WHEN jsonb_typeof(elem) = 'object'
								THEN COALESCE(elem->>'heading', '') || ' ' || COALESCE(elem->>'body', '')
							ELSE ''
						END,
						' '
					)
					FROM jsonb_array_elements(COALESCE(NEW.sections_json, '[]'::jsonb)) AS elem
				),
				''
			)
		ELSE ''
	END;

	NEW.search_tsv := COALESCE(
		setweight(to_tsvector('english', v_weight_a), 'A')
		|| setweight(to_tsvector('simple', v_weight_a), 'A')
		|| setweight(to_tsvector('english', v_weight_b), 'B')
		|| setweight(to_tsvector('simple', v_weight_b), 'B')
		|| setweight(to_tsvector('english', v_weight_c), 'C')
		|| setweight(to_tsvector('simple', v_weight_c), 'C')
		|| setweight(to_tsvector('english', v_weight_d), 'D')
		|| setweight(to_tsvector('simple', v_weight_d), 'D'),
		''::tsvector
	);

	RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "career_dossiers_refresh_search_tsv_trg" ON "career_dossiers";
--> statement-breakpoint
CREATE TRIGGER "career_dossiers_refresh_search_tsv_trg"
BEFORE INSERT OR UPDATE ON "career_dossiers"
FOR EACH ROW
EXECUTE FUNCTION career_dossiers_refresh_search_tsv();
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "career_dossiers_search_tsv_gin_idx" ON "career_dossiers" USING gin ("search_tsv");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "career_dossiers_publish_sort_idx" ON "career_dossiers" USING btree ("publish_status","sort_order","slug");
--> statement-breakpoint
ALTER TABLE "ask_turns" ADD COLUMN IF NOT EXISTS "conversation_id" text;
--> statement-breakpoint
ALTER TABLE "ask_turns" ADD COLUMN IF NOT EXISTS "turn_index" integer;
--> statement-breakpoint
ALTER TABLE "ask_turns" ADD COLUMN IF NOT EXISTS "prompt_text" text;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'ask_turns_prompt_text_length_check'
			AND conrelid = '"ask_turns"'::regclass
	) THEN
		ALTER TABLE "ask_turns"
			ADD CONSTRAINT "ask_turns_prompt_text_length_check"
			CHECK (prompt_text IS NULL OR char_length(prompt_text) <= 1000);
	END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ask_turns_session_conv_created_idx" ON "ask_turns" USING btree ("session_id","conversation_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ask_turns_conv_turn_idx" ON "ask_turns" USING btree ("session_id","conversation_id","turn_index") WHERE "conversation_id" IS NOT NULL AND "turn_index" IS NOT NULL;
--> statement-breakpoint
UPDATE "quota_policies" SET "max_turns_per_session" = 10 WHERE "role" = 'guest' AND "max_turns_per_session" = 5;
