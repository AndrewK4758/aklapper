ALTER TABLE "sandbox_runs" ADD COLUMN IF NOT EXISTS "is_golden" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD COLUMN IF NOT EXISTS "prompt_hash" text;
--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD COLUMN IF NOT EXISTS "execution_mode" text DEFAULT 'fast' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD COLUMN IF NOT EXISTS "spec_json" jsonb;
--> statement-breakpoint
ALTER TABLE "sandbox_runs" ADD COLUMN IF NOT EXISTS "gate_audit_json" jsonb;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'sandbox_runs_execution_mode_check'
			AND conrelid = '"sandbox_runs"'::regclass
	) THEN
		ALTER TABLE "sandbox_runs"
			ADD CONSTRAINT "sandbox_runs_execution_mode_check"
			CHECK (execution_mode IN ('golden', 'cached', 'live', 'fast', 'fallback'));
	END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'sandbox_runs_golden_immutable_check'
			AND conrelid = '"sandbox_runs"'::regclass
	) THEN
		ALTER TABLE "sandbox_runs"
			ADD CONSTRAINT "sandbox_runs_golden_immutable_check"
			CHECK (NOT is_golden OR (status = 'ready' AND gate_verdict = 'approved' AND execution_mode = 'golden'));
	END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sandbox_runs_golden_created_idx" ON "sandbox_runs" USING btree ("is_golden","created_at" DESC) WHERE "is_golden" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sandbox_runs_prompt_hash_ready_idx" ON "sandbox_runs" USING btree ("prompt_hash","is_golden" DESC,"created_at" DESC) WHERE "status" = 'ready' AND "prompt_hash" IS NOT NULL AND "execution_mode" IN ('live', 'fast', 'golden');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sandbox_runs_session_prompt_hash_idx" ON "sandbox_runs" USING btree ("session_id","prompt_hash","created_at" DESC) WHERE "status" = 'ready' AND "prompt_hash" IS NOT NULL AND "execution_mode" IN ('live', 'fast');
--> statement-breakpoint
DELETE FROM "sandbox_turns" a
USING "sandbox_turns" b
WHERE a.run_id = b.run_id
	AND a.phase = b.phase
	AND a.id < b.id;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sandbox_turns_run_phase_uidx" ON "sandbox_turns" USING btree ("run_id","phase");
