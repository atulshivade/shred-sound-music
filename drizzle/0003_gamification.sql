CREATE TYPE "public"."reaction_kind" AS ENUM('CLAP', 'SHRED');--> statement-breakpoint
CREATE TABLE "performance_reaction" (
	"performance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "reaction_kind" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "performance_reaction_performance_id_user_id_kind_pk" PRIMARY KEY("performance_id","user_id","kind")
);
--> statement-breakpoint
CREATE TABLE "xp_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performance_reaction" ADD CONSTRAINT "performance_reaction_performance_id_performance_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_reaction" ADD CONSTRAINT "performance_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xp_event" ADD CONSTRAINT "xp_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "performance_reaction_performance_idx" ON "performance_reaction" USING btree ("performance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xp_event_user_source_unique" ON "xp_event" USING btree ("user_id","source_key");--> statement-breakpoint
CREATE INDEX "xp_event_user_idx" ON "xp_event" USING btree ("user_id");