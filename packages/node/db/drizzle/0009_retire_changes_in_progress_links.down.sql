INSERT INTO "terminal_directory_entries" ("profile_slug", "name", "description", "sort_order", "enabled")
SELECT 'portal-home', 'changes-in-progress', 'Maintenance preview', 6, true
WHERE EXISTS (
  SELECT 1
  FROM "terminal_profiles"
  WHERE "slug" = 'portal-home'
)
ON CONFLICT ("profile_slug", "name") DO NOTHING;
--> statement-breakpoint
UPDATE "site_content"
SET
  "metadata_json" = jsonb_set(
    "metadata_json",
    '{actions}',
    ("metadata_json"->'actions') || jsonb_build_array(
      jsonb_build_object(
        'label', 'Maintenance Preview → /changes-in-progress',
        'to', '/changes-in-progress',
        'variant', 'default'
      )
    ),
    false
  ),
  "updated_at" = now()
WHERE "key" = 'portal-home'
  AND jsonb_typeof("metadata_json"->'actions') = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof("metadata_json"->'actions') = 'array'
        THEN "metadata_json"->'actions'
        ELSE '[]'::jsonb
      END
    ) AS elem
    WHERE elem->>'to' = '/changes-in-progress'
  );
--> statement-breakpoint
UPDATE "terminal_commands"
SET
  "allowed_routes" = CASE
    WHEN 'changes-in-progress' = ANY("allowed_routes") THEN "allowed_routes"
    ELSE array_append("allowed_routes", 'changes-in-progress')
  END,
  "description" = CASE
    WHEN "description" LIKE '%changes-in-progress%' THEN "description"
    ELSE replace("description", ', or /contact', ', /contact, or /changes-in-progress')
  END,
  "error_template" = CASE
    WHEN "error_template" IS NULL THEN NULL
    WHEN "error_template" LIKE '%changes-in-progress%' THEN "error_template"
    ELSE replace("error_template", ' | cd contact', ' | cd contact | cd changes-in-progress')
  END
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'cd'
  AND (
    NOT ('changes-in-progress' = ANY("allowed_routes"))
    OR "description" NOT LIKE '%changes-in-progress%'
    OR ("error_template" IS NOT NULL AND "error_template" NOT LIKE '%changes-in-progress%')
  );
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = replace("output", ', or /contact', ', /contact, or /changes-in-progress')
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'help'
  AND "output" NOT LIKE '%changes-in-progress%'
  AND "output" LIKE '%, or /contact%';
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = CASE
  WHEN "output" = '' THEN 'changes-in-progress   # Maintenance preview'
  ELSE "output" || E'\n' || 'changes-in-progress   # Maintenance preview'
END
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'ls'
  AND "output" !~ '(^|\n)[[:space:]]*changes-in-progress([[:space:]]|$)';
--> statement-breakpoint
UPDATE "terminal_initial_entries"
SET "output" = CASE
  WHEN "output" = '' THEN 'changes-in-progress   # Maintenance preview'
  ELSE "output" || E'\n' || 'changes-in-progress   # Maintenance preview'
END
WHERE "profile_slug" = 'portal-home'
  AND "command" = 'ls'
  AND "output" !~ '(^|\n)[[:space:]]*changes-in-progress([[:space:]]|$)';
