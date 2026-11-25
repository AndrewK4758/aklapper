ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "target_k8s_deploy";
--> statement-breakpoint
ALTER TABLE "menu_items" DROP COLUMN IF EXISTS "namespace";
--> statement-breakpoint
UPDATE "menu_items"
SET "description" = 'Prompt-to-artifact showcase backed by Cloud Run Go services and Qdrant recall'
WHERE "slug" = 'cadence' AND "description" LIKE '%GKE%';
--> statement-breakpoint
UPDATE "site_content"
SET
  "metadata_json" = jsonb_set("metadata_json", '{statusBadge,source}', '"cloud-run"'::jsonb, false),
  "updated_at" = now()
WHERE "key" = 'portal-chrome'
  AND "metadata_json"->'statusBadge'->>'source' = 'gke-autopilot';
--> statement-breakpoint
UPDATE "site_content"
SET
  "metadata_json" = jsonb_set("metadata_json", '{tuiBadge,source}', '"cloud-run"'::jsonb, false),
  "updated_at" = now()
WHERE "key" = 'portal-home'
  AND "metadata_json"->'tuiBadge'->>'source' = 'gke-autopilot';
--> statement-breakpoint
UPDATE "terminal_initial_entries"
SET "output" = replace("output", 'Cloud Run + GKE Autopilot', 'Cloud Run (4-service Docker architecture)')
WHERE "output" LIKE '%GKE Autopilot%';
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = replace("output", 'gke-autopilot: 0 pods (scale-to-0)', 'cloud-run: scale-to-0 ready')
WHERE "output" LIKE '%gke-autopilot%';
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = replace("output", 'Cloud Run (edge SSR) + GKE Autopilot (scale-to-0 workloads)', 'Cloud Run (4-service scale-to-0) + Direct VPC Egress PG19')
WHERE "output" LIKE '%GKE Autopilot%';
--> statement-breakpoint
UPDATE "roadmap_milestones"
SET "label" = replace(replace("label", 'GKE Autopilot', 'Cloud Run'), 'Kubernetes', 'Cloud Run')
WHERE "label" LIKE '%GKE%' OR "label" LIKE '%Kubernetes%';
