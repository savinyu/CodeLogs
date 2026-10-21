ALTER TABLE "users" ADD COLUMN "username_changed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "users_github_login_idx" ON "users" USING btree ("github_login");--> statement-breakpoint
-- Lookups match usernames exactly so they use the unique index; lowercase any older mixed-case one (unless that clashes).
UPDATE "users" AS u SET "username" = lower(u."username") WHERE u."username" <> lower(u."username") AND NOT EXISTS (SELECT 1 FROM "users" AS o WHERE o."username" = lower(u."username"));
--> statement-breakpoint
UPDATE "users" SET "github_login" = lower("github_login") WHERE "github_login" <> lower("github_login");
