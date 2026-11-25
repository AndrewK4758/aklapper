DELETE FROM "sandbox_runs" WHERE "is_golden" = true;
--> statement-breakpoint
DROP INDEX IF EXISTS "sandbox_turns_run_phase_uidx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sandbox_runs_session_prompt_hash_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sandbox_runs_prompt_hash_ready_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "sandbox_runs_golden_created_idx";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP CONSTRAINT IF EXISTS "sandbox_runs_golden_immutable_check";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP CONSTRAINT IF EXISTS "sandbox_runs_execution_mode_check";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP COLUMN IF EXISTS "gate_audit_json";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP COLUMN IF EXISTS "spec_json";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP COLUMN IF EXISTS "execution_mode";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP COLUMN IF EXISTS "prompt_hash";
--> statement-breakpoint
ALTER TABLE IF EXISTS "sandbox_runs" DROP COLUMN IF EXISTS "is_golden";
