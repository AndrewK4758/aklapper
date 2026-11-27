DELETE FROM "terminal_directory_entries"
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'changes-in-progress';
--> statement-breakpoint
UPDATE "site_content"
SET
  "metadata_json" = jsonb_set(
    "metadata_json",
    '{actions}',
    COALESCE(
      (
        SELECT jsonb_agg(t.elem ORDER BY t.ord)
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof("metadata_json"->'actions') = 'array'
            THEN "metadata_json"->'actions'
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS t(elem, ord)
        WHERE t.elem->>'to' IS DISTINCT FROM '/changes-in-progress'
      ),
      '[]'::jsonb
    ),
    false
  ),
  "updated_at" = now()
WHERE "key" = 'portal-home'
  AND jsonb_typeof("metadata_json"->'actions') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof("metadata_json"->'actions') = 'array'
        THEN "metadata_json"->'actions'
        ELSE '[]'::jsonb
      END
    ) AS elem
    WHERE elem->>'to' = '/changes-in-progress'
  )
  AND (
    SELECT count(*)
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof("metadata_json"->'actions') = 'array'
        THEN "metadata_json"->'actions'
        ELSE '[]'::jsonb
      END
    ) AS elem
    WHERE elem->>'to' IS DISTINCT FROM '/changes-in-progress'
  ) >= 1;
--> statement-breakpoint
UPDATE "terminal_commands"
SET
  "allowed_routes" = array_remove("allowed_routes", 'changes-in-progress'),
  "description" = replace(
    replace("description", ', /contact, or /changes-in-progress', ', or /contact'),
    ', or /changes-in-progress',
    ''
  ),
  "error_template" = CASE
    WHEN "error_template" IS NULL THEN NULL
    ELSE replace("error_template", ' | cd changes-in-progress', '')
  END
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'cd'
  AND (
    'changes-in-progress' = ANY("allowed_routes")
    OR "description" LIKE '%changes-in-progress%'
    OR COALESCE("error_template", '') LIKE '%changes-in-progress%'
  );
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = replace(
  replace("output", ', /contact, or /changes-in-progress', ', or /contact'),
  ', or /changes-in-progress',
  ''
)
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'help'
  AND "output" LIKE '%changes-in-progress%';
--> statement-breakpoint
UPDATE "terminal_commands"
SET "output" = COALESCE(
  (
    SELECT string_agg(t.line, E'\n' ORDER BY t.ord)
    FROM unnest(string_to_array("output", E'\n')) WITH ORDINALITY AS t(line, ord)
    WHERE btrim(t.line) !~ '^changes-in-progress([[:space:]]|$)'
  ),
  ''
)
WHERE "profile_slug" = 'portal-home'
  AND "name" = 'ls'
  AND "output" ~ '(^|\n)[[:space:]]*changes-in-progress([[:space:]]|$)';
--> statement-breakpoint
UPDATE "terminal_initial_entries"
SET "output" = COALESCE(
  (
    SELECT string_agg(t.line, E'\n' ORDER BY t.ord)
    FROM unnest(string_to_array("output", E'\n')) WITH ORDINALITY AS t(line, ord)
    WHERE btrim(t.line) !~ '^changes-in-progress([[:space:]]|$)'
  ),
  ''
)
WHERE "profile_slug" = 'portal-home'
  AND "command" = 'ls'
  AND "output" ~ '(^|\n)[[:space:]]*changes-in-progress([[:space:]]|$)';
