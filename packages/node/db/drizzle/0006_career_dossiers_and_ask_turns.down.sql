UPDATE "quota_policies" SET "max_turns_per_session" = 5 WHERE "role" = 'guest' AND "max_turns_per_session" = 10;
--> statement-breakpoint
DROP INDEX IF EXISTS "ask_turns_conv_turn_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "ask_turns_session_conv_created_idx";
--> statement-breakpoint
ALTER TABLE IF EXISTS "ask_turns" DROP CONSTRAINT IF EXISTS "ask_turns_prompt_text_length_check";
--> statement-breakpoint
ALTER TABLE IF EXISTS "ask_turns" DROP COLUMN IF EXISTS "prompt_text";
--> statement-breakpoint
ALTER TABLE IF EXISTS "ask_turns" DROP COLUMN IF EXISTS "turn_index";
--> statement-breakpoint
ALTER TABLE IF EXISTS "ask_turns" DROP COLUMN IF EXISTS "conversation_id";
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('"career_dossiers"') IS NOT NULL THEN
		DROP TRIGGER IF EXISTS "career_dossiers_refresh_search_tsv_trg" ON "career_dossiers";
	END IF;
END
$$;
--> statement-breakpoint
DROP INDEX IF EXISTS "career_dossiers_publish_sort_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "career_dossiers_search_tsv_gin_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "career_dossiers";
--> statement-breakpoint
DROP FUNCTION IF EXISTS career_dossiers_refresh_search_tsv();
