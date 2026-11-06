CREATE TABLE "daily_stats" (
	"day" date NOT NULL,
	"platform" text NOT NULL,
	"sessions" integer NOT NULL,
	"attempts" integer NOT NULL,
	"ok" integer NOT NULL,
	"errors" jsonb NOT NULL,
	"visitors" jsonb NOT NULL,
	"ttff_p50" integer,
	"ttff_p90" integer,
	CONSTRAINT "daily_stats_day_platform_pk" PRIMARY KEY("day","platform")
);
--> statement-breakpoint
ALTER TABLE "playback_reports" ADD COLUMN "visitor_age" text;