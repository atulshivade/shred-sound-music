CREATE TYPE "public"."service_notice_audience" AS ENUM('ALL', 'STUDENT', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."test_case_status" AS ENUM('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."test_run_kind" AS ENUM('SMOKE', 'FULL_E2E', 'RETEST');--> statement-breakpoint
CREATE TYPE "public"."test_run_status" AS ENUM('QUEUED', 'RUNNING', 'PASSED', 'FAILED', 'TIMED_OUT');--> statement-breakpoint
CREATE TABLE "service_notice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"audience" "service_notice_audience" DEFAULT 'ALL' NOT NULL,
	"public_message" text NOT NULL,
	"admin_detail" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ends_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_case_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" "test_case_status" DEFAULT 'PENDING' NOT NULL,
	"project_name" text,
	"duration_ms" integer,
	"public_summary" text,
	"admin_detail" text,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "test_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "test_run_kind" NOT NULL,
	"status" "test_run_status" DEFAULT 'QUEUED' NOT NULL,
	"triggered_by_id" uuid NOT NULL,
	"parent_run_id" uuid,
	"base_url" text NOT NULL,
	"github_run_url" text,
	"passed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "performance" ALTER COLUMN "status" SET DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "service_notice" ADD CONSTRAINT "service_notice_run_id_test_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_notice" ADD CONSTRAINT "service_notice_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_case_result" ADD CONSTRAINT "test_case_result_run_id_test_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."test_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_run" ADD CONSTRAINT "test_run_triggered_by_id_user_id_fk" FOREIGN KEY ("triggered_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_notice_active_idx" ON "service_notice" USING btree ("is_active","audience");--> statement-breakpoint
CREATE INDEX "test_case_result_run_idx" ON "test_case_result" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "test_case_result_status_idx" ON "test_case_result" USING btree ("status");--> statement-breakpoint
CREATE INDEX "test_run_status_created_idx" ON "test_run" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "test_run_triggered_by_idx" ON "test_run" USING btree ("triggered_by_id");--> statement-breakpoint
CREATE INDEX "performance_status_idx" ON "performance" USING btree ("status");