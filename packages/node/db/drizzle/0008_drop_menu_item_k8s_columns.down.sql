ALTER TABLE IF EXISTS "menu_items" ADD COLUMN IF NOT EXISTS "target_k8s_deploy" text;
--> statement-breakpoint
ALTER TABLE IF EXISTS "menu_items" ADD COLUMN IF NOT EXISTS "namespace" text;
