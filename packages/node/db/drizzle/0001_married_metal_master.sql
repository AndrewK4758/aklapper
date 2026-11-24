CREATE TABLE "contact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"attachment_name" text,
	"attachment_mime_type" text,
	"attachment_size_bytes" integer,
	"attachment_sha256" text,
	"attachment_content_base64" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_name_length_check" CHECK (char_length(btrim("contact_submissions"."name")) >= 2 AND char_length(btrim("contact_submissions"."name")) <= 120),
	CONSTRAINT "contact_phone_format_check" CHECK ("contact_submissions"."phone" IS NULL OR (char_length(btrim("contact_submissions"."phone")) >= 7 AND char_length(btrim("contact_submissions"."phone")) <= 32 AND "contact_submissions"."phone" ~ '^[0-9+(). -]+$')),
	CONSTRAINT "contact_email_format_check" CHECK (char_length(btrim("contact_submissions"."email")) <= 254 AND "contact_submissions"."email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
	CONSTRAINT "contact_message_length_check" CHECK (char_length(btrim("contact_submissions"."message")) >= 10 AND char_length(btrim("contact_submissions"."message")) <= 4000),
	CONSTRAINT "contact_attachment_consistency_check" CHECK ((
        "contact_submissions"."attachment_name" IS NULL
        AND "contact_submissions"."attachment_mime_type" IS NULL
        AND "contact_submissions"."attachment_size_bytes" IS NULL
        AND "contact_submissions"."attachment_sha256" IS NULL
        AND "contact_submissions"."attachment_content_base64" IS NULL
      ) OR (
        "contact_submissions"."attachment_name" IS NOT NULL
        AND char_length(btrim("contact_submissions"."attachment_name")) >= 1
        AND char_length(btrim("contact_submissions"."attachment_name")) <= 255
        AND "contact_submissions"."attachment_mime_type" IN (
          'application/pdf',
          'text/plain',
          'text/markdown',
          'image/png',
          'image/jpeg',
          'image/webp',
          'application/json',
          'text/csv'
        )
        AND "contact_submissions"."attachment_size_bytes" IS NOT NULL
        AND "contact_submissions"."attachment_size_bytes" >= 1
        AND "contact_submissions"."attachment_size_bytes" <= 5242880
        AND "contact_submissions"."attachment_sha256" IS NOT NULL
        AND "contact_submissions"."attachment_sha256" ~ '^[a-fA-F0-9]{64}$'
        AND "contact_submissions"."attachment_content_base64" IS NOT NULL
        AND char_length("contact_submissions"."attachment_content_base64") >= 1
      ))
);
