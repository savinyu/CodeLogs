CREATE TABLE "platform_opt_outs" (
	"user_id" text NOT NULL,
	"platform" "platform" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_opt_outs_user_id_platform_pk" PRIMARY KEY("user_id","platform")
);
--> statement-breakpoint
ALTER TABLE "platform_opt_outs" ADD CONSTRAINT "platform_opt_outs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;