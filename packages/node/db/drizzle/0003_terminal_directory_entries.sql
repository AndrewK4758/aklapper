CREATE TABLE "terminal_directory_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "terminal_directory_entries" ADD CONSTRAINT "terminal_directory_entries_profile_slug_terminal_profiles_slug_fk" FOREIGN KEY ("profile_slug") REFERENCES "public"."terminal_profiles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "terminal_directory_entries_profile_name_idx" ON "terminal_directory_entries" USING btree ("profile_slug","name");