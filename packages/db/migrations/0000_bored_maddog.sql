CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE "blocklist" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"reason" text,
	"ref" text
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "channel_curation" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"alt_names" text[] DEFAULT '{}' NOT NULL,
	"network" text,
	"country_code" text NOT NULL,
	"categories" text[] DEFAULT '{}' NOT NULL,
	"is_nsfw" boolean DEFAULT false NOT NULL,
	"website" text,
	"launched" text,
	"closed" text,
	"replaced_by" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"flag" text,
	"languages" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feeds" (
	"channel_id" text NOT NULL,
	"feed_id" text NOT NULL,
	"name" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"broadcast_area" text[] DEFAULT '{}' NOT NULL,
	"timezones" text[] DEFAULT '{}' NOT NULL,
	"languages" text[] DEFAULT '{}' NOT NULL,
	"format" text,
	CONSTRAINT "feeds_channel_id_feed_id_pk" PRIMARY KEY("channel_id","feed_id")
);
--> statement-breakpoint
CREATE TABLE "languages" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logos" (
	"channel_id" text NOT NULL,
	"feed_id" text DEFAULT '' NOT NULL,
	"url" text NOT NULL,
	"cdn_url" text,
	"width" integer,
	"height" integer,
	"format" text,
	"in_use" boolean DEFAULT true NOT NULL,
	CONSTRAINT "logos_channel_id_feed_id_url_pk" PRIMARY KEY("channel_id","feed_id","url")
);
--> statement-breakpoint
CREATE TABLE "playback_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stream_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"result" text NOT NULL,
	"error_type" text,
	"ttff_ms" integer,
	"anon_session_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_checks" (
	"id" bigserial NOT NULL,
	"stream_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ok" boolean NOT NULL,
	"http_status" smallint,
	"is_https" boolean NOT NULL,
	"has_cors" boolean DEFAULT false NOT NULL,
	"needs_headers" boolean DEFAULT false NOT NULL,
	"latency_ms" integer,
	"height" integer,
	"error_code" text,
	CONSTRAINT "stream_checks_id_checked_at_pk" PRIMARY KEY("id","checked_at")
) PARTITION BY RANGE ("checked_at");
--> statement-breakpoint
CREATE TABLE "stream_checks_default" PARTITION OF "stream_checks" DEFAULT;
--> statement-breakpoint
-- Creates the monthly partition containing ts if missing. Called by the health checker.
CREATE OR REPLACE FUNCTION ensure_stream_checks_partition(ts timestamptz) RETURNS void AS $$
DECLARE
  start_ts timestamptz := date_trunc('month', ts);
  name text := 'stream_checks_' || to_char(start_ts, 'YYYYMM');
BEGIN
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF stream_checks FOR VALUES FROM (%L) TO (%L)', name, start_ts, start_ts + interval '1 month');
END $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TABLE "stream_health" (
	"stream_id" uuid PRIMARY KEY NOT NULL,
	"score" smallint DEFAULT 0 NOT NULL,
	"web_playable" boolean DEFAULT false NOT NULL,
	"native_playable" boolean DEFAULT false NOT NULL,
	"height" integer,
	"last_ok_at" timestamp with time zone,
	"fail_streak" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"feed_id" text,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"referrer" text,
	"user_agent" text,
	"quality" text,
	"labels" text[] DEFAULT '{}' NOT NULL,
	"source" text DEFAULT 'iptv-org' NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"counts" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "takedown_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"org" text,
	"details" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "channel_curation_status_idx" ON "channel_curation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "channels_categories_gin" ON "channels" USING gin ("categories");--> statement-breakpoint
CREATE INDEX "channels_name_trgm" ON "channels" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "channels_country_idx" ON "channels" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "feeds_languages_gin" ON "feeds" USING gin ("languages");--> statement-breakpoint
CREATE INDEX "playback_reports_stream_time_idx" ON "playback_reports" USING btree ("stream_id","created_at");--> statement-breakpoint
CREATE INDEX "stream_checks_stream_idx" ON "stream_checks" USING btree ("stream_id","checked_at");--> statement-breakpoint
CREATE INDEX "stream_health_web_idx" ON "stream_health" USING btree ("web_playable","score");--> statement-breakpoint
CREATE UNIQUE INDEX "streams_url_unique" ON "streams" USING btree ("url");--> statement-breakpoint
CREATE INDEX "streams_channel_idx" ON "streams" USING btree ("channel_id");