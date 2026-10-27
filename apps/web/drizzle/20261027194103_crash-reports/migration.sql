CREATE TABLE "crash_report" (
	"id" text PRIMARY KEY,
	"kind" text NOT NULL,
	"platform" text NOT NULL,
	"client_version" text NOT NULL,
	"loader_version" text NOT NULL,
	"discord_version" text NOT NULL,
	"os_version" text NOT NULL,
	"device_model" text NOT NULL,
	"addon_id" text,
	"addon_version" text,
	"addon_trust" text,
	"phase" text,
	"seconds" double precision,
	"message" text,
	"stack" text,
	"received_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "crash_report_addonId_receivedAt_idx" ON "crash_report" ("addon_id","received_at");--> statement-breakpoint
CREATE INDEX "crash_report_receivedAt_idx" ON "crash_report" ("received_at");