CREATE TABLE "contest_results" (
	"account_id" uuid NOT NULL,
	"contest_key" text NOT NULL,
	"name" text NOT NULL,
	"held_at" timestamp with time zone NOT NULL,
	"rank" integer,
	"old_rating" integer,
	"new_rating" integer,
	"rated" boolean DEFAULT true NOT NULL,
	CONSTRAINT "contest_results_account_id_contest_key_pk" PRIMARY KEY("account_id","contest_key")
);
--> statement-breakpoint
ALTER TABLE "contest_results" ADD CONSTRAINT "contest_results_account_id_platform_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."platform_accounts"("id") ON DELETE cascade ON UPDATE no action;