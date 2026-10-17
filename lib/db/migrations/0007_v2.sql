CREATE TYPE "public"."friendship_status" AS ENUM('pending', 'accepted');--> statement-breakpoint
CREATE TABLE "daily_marks" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"platform" "platform" NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_marks_user_id_day_platform_external_id_pk" PRIMARY KEY("user_id","day","platform","external_id")
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"requester_id" text NOT NULL,
	"addressee_id" text NOT NULL,
	"status" "friendship_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_at" timestamp with time zone,
	CONSTRAINT "friendships_requester_id_addressee_id_pk" PRIMARY KEY("requester_id","addressee_id"),
	CONSTRAINT "friendships_not_self" CHECK ("friendships"."requester_id" <> "friendships"."addressee_id")
);
--> statement-breakpoint
CREATE TABLE "sheet_follows" (
	"user_id" text NOT NULL,
	"sheet_id" text NOT NULL,
	"following" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheet_follows_user_id_sheet_id_pk" PRIMARY KEY("user_id","sheet_id")
);
--> statement-breakpoint
CREATE TABLE "sheet_ticks" (
	"user_id" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sheet_ticks_user_id_slug_pk" PRIMARY KEY("user_id","slug")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_goal" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "global_board" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_marks" ADD CONSTRAINT "daily_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_addressee_id_users_id_fk" FOREIGN KEY ("addressee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_follows" ADD CONSTRAINT "sheet_follows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sheet_ticks" ADD CONSTRAINT "sheet_ticks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "friendships_pair_uq" ON "friendships" USING btree (least("requester_id", "addressee_id"),greatest("requester_id", "addressee_id"));--> statement-breakpoint
CREATE INDEX "friendships_addressee_idx" ON "friendships" USING btree ("addressee_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_daily_goal_range" CHECK ("users"."daily_goal" between 1 and 20);