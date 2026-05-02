CREATE TYPE "public"."challenge_status" AS ENUM('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."instrument" AS ENUM('ACOUSTIC_GUITAR', 'ELECTRIC_GUITAR', 'BASS_GUITAR', 'KEYBOARD', 'PIANO', 'SYNTHESIZER', 'DRUMS', 'VOCALS', 'VIOLIN', 'FLUTE', 'SAXOPHONE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."performance_status" AS ENUM('PENDING', 'PUBLISHED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."skill_level" AS ENUM('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'STUDENT');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('LOCAL', 'BUNNY', 'VIMEO', 'EMBED');--> statement-breakpoint
CREATE TABLE "account" (
	"userId" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "account_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "challenge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"cover_image_url" text,
	"deadline" timestamp NOT NULL,
	"status" "challenge_status" DEFAULT 'ACTIVE' NOT NULL,
	"points" integer DEFAULT 100 NOT NULL,
	"instrument_focus" "instrument",
	"skill_level_target" "skill_level",
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"note" text NOT NULL,
	"timestamp_sec" integer,
	"rhythm_score" integer,
	"technique_score" integer,
	"musicality_score" integer,
	"is_private" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_like" (
	"performance_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "performance_like_performance_id_user_id_pk" PRIMARY KEY("performance_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text,
	"caption" text,
	"instrument" "instrument" NOT NULL,
	"skill_level" "skill_level" NOT NULL,
	"video_provider" "video_provider" DEFAULT 'LOCAL' NOT NULL,
	"video_url" text NOT NULL,
	"video_external_id" text,
	"video_duration_seconds" integer,
	"thumbnail_url" text,
	"status" "performance_status" DEFAULT 'PUBLISHED' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_best_performer" boolean DEFAULT false NOT NULL,
	"likes_count" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "top_performer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"performance_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"selected_by_id" uuid NOT NULL,
	"reason" text,
	"period" text DEFAULT 'CHALLENGE' NOT NULL,
	"selected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'STUDENT' NOT NULL,
	"primary_instrument" "instrument",
	"skill_level" "skill_level",
	"bio" text,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verificationToken" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationToken_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_performance_id_performance_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_like" ADD CONSTRAINT "performance_like_performance_id_performance_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_like" ADD CONSTRAINT "performance_like_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance" ADD CONSTRAINT "performance_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance" ADD CONSTRAINT "performance_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_performer" ADD CONSTRAINT "top_performer_performance_id_performance_id_fk" FOREIGN KEY ("performance_id") REFERENCES "public"."performance"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_performer" ADD CONSTRAINT "top_performer_challenge_id_challenge_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "top_performer" ADD CONSTRAINT "top_performer_selected_by_id_user_id_fk" FOREIGN KEY ("selected_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_status_idx" ON "challenge" USING btree ("status");--> statement-breakpoint
CREATE INDEX "challenge_deadline_idx" ON "challenge" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "challenge_instrument_idx" ON "challenge" USING btree ("instrument_focus");--> statement-breakpoint
CREATE INDEX "feedback_performance_idx" ON "feedback" USING btree ("performance_id");--> statement-breakpoint
CREATE INDEX "feedback_teacher_idx" ON "feedback" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "performance_challenge_idx" ON "performance" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "performance_student_idx" ON "performance" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "performance_instrument_idx" ON "performance" USING btree ("instrument");--> statement-breakpoint
CREATE INDEX "performance_skill_idx" ON "performance" USING btree ("skill_level");--> statement-breakpoint
CREATE INDEX "performance_best_idx" ON "performance" USING btree ("is_best_performer");--> statement-breakpoint
CREATE UNIQUE INDEX "top_performer_performance_unique" ON "top_performer" USING btree ("performance_id");--> statement-breakpoint
CREATE INDEX "top_performer_challenge_idx" ON "top_performer" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");