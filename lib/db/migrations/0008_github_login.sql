ALTER TABLE "users" ADD COLUMN "github_login" text;--> statement-breakpoint
-- Every username so far is a GitHub login (GitHub was the only sign-in).
UPDATE "users" SET "github_login" = "username" WHERE "username" IS NOT NULL AND "id" IN (SELECT "user_id" FROM "accounts" WHERE "provider_id" = 'github');
